"use server"

import { endOfDay, startOfDay } from "date-fns"
import { headers } from "next/headers"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { calculateBookingRevenue } from "@/project/sales/utils/booking-revenue"
import { canCurrentUserInteractPath } from "@/project/roles/actions/role.actions"
import { CommissionKind } from "@/generated/prisma/enums"
import { USER_ROLE } from "@/project/users/constants/roles"
import { getEventDisplayName } from "@/project/events/utils/event-display"

import type {
	OperatorOption,
	CommissionSale,
	CommissionBooking,
	CommissionDetail,
	CommissionFilters,
	CommissionSummary,
	CommissionPdfFilters,
	MarkCommissionAsPaidInput,
} from "../types/commission.types"

/**
 * Tours excluded from REGULAR commission flow (Volcanes, Uyuni).
 * These tours are paid via the SPECIAL commission flow instead.
 * See spec: commissions-special-tours.
 * Future: lift this to a DB flag (e.g. Tour.isSpecialCommission) to remove the regex fragility.
 */
const EXCLUDED_COMMISSION_TOUR_PATTERNS = [/volc[áa]n/i, /uyuni/i]

function isExcludedFromCommissions(tourName?: string | null) {
	if (!tourName) return false
	return EXCLUDED_COMMISSION_TOUR_PATTERNS.some((pattern) => pattern.test(tourName))
}

/** Alias for semantic clarity: returns true when a tour name matches the special-tours list */
function isSpecialTourName(name?: string | null): boolean {
	return isExcludedFromCommissions(name)
}

/**
 * Returns true when a tour name matches the given kind:
 * - SPECIAL → tour is in the Volcanes/Uyuni list
 * - REGULAR → tour is NOT in the list
 */
function matchesKind(name: string | null | undefined, kind: CommissionKind): boolean {
	return kind === CommissionKind.SPECIAL ? isSpecialTourName(name) : !isSpecialTourName(name)
}

/**
 * Runtime guard — throws on any value that isn't a valid CommissionKind.
 * Keeps the codebase consistent with the existing throw-on-invalid pattern.
 */
function assertKind(kind: unknown): asserts kind is CommissionKind {
	if (kind !== CommissionKind.REGULAR && kind !== CommissionKind.SPECIAL) {
		throw new Error(`Invalid commission kind: ${String(kind)}`)
	}
}

async function getAuthUser() {
	const session = await auth.api.getSession({
		headers: await headers(),
	})

	if (!session?.user) {
		throw new Error("No autenticado")
	}

	return session.user
}

/**
 * Returns the operatorId the current user is allowed to query.
 * - ADMIN → may query the requested operatorId (passes through).
 * - Anyone else → forced to their own user id, regardless of what the client sent.
 * This protects the commissions endpoints from a non-admin reading another user's data
 * by tampering with client-side state.
 */
async function resolveAllowedOperatorId(requestedOperatorId: string): Promise<string> {
	const user = await getAuthUser()
	const role = (user as { role?: string }).role
	if (role === USER_ROLE.ADMIN) return requestedOperatorId
	return user.id
}

// ─── Shared booking select shape (used across multiple actions) ────────────────

const BOOKING_SELECT = {
	id: true,
	cancelled: true,
	passengerCount: true,
	event: {
		select: {
			id: true,
			date: true,
			status: true,
			serviceKind: true,
			tour: {
				select: {
					name: true,
				},
			},
			transferService: {
				select: {
					id: true,
					name: true,
				},
			},
		},
	},
	priceEntries: {
		select: {
			count: true,
			priceSnapshot: true,
			receptionSnapshot: true,
			categoryName: true,
		},
	},
	entrySnapshots: {
		select: {
			count: true,
			priceSnapshot: true,
		},
	},
} as const

/**
 * Shared filter predicate for the WHERE clause.
 * Filters bookings to: COMPLETED, in date range, sold by the given operator (User.sellerId), not cancelled.
 * "Operator" in this codebase = User with role OPERADORA (the seller), NOT the Provider company.
 * Tour-name (kind) matching is done in JS after fetch because Prisma doesn't support regex WHERE.
 */
function buildBookingWhere(
	operatorId: string,
	startDate: Date,
	endDate: Date
) {
	return {
		cancelled: false,
		saleRecord: {
			sellerId: operatorId,
			type: "SALE" as const,
			status: { not: "CANCELLED" as const },
		},
		event: {
			status: "COMPLETED" as const,
			date: { gte: startDate, lte: endDate },
		},
	}
}

/**
 * Map a raw Prisma booking (with commissions loaded) into a CommissionBooking.
 * commissions[] must have been filtered to { where: { kind } } in the select.
 */
function mapBooking(
	booking: {
		id: string
		event: {
			id: string
			date: Date
			status: string
			serviceKind: string
			tour: { name: string } | null
			transferService: { id: string; name: string } | null
		}
		priceEntries: Array<{ count: number; priceSnapshot: number; receptionSnapshot: number; categoryName: string }>
		entrySnapshots: Array<{ count: number; priceSnapshot: number }>
		commissions: Array<{
			id: string
			kind: CommissionKind
			percentage: number
			baseAmount: number
			commissionAmount: number
			totalPaid: number
			paidAt: Date
			notes: string | null
			paidBy: { id: string; name: string | null }
		}>
	}
): CommissionBooking {
	const revenue = calculateBookingRevenue(booking.priceEntries, booking.entrySnapshots)

	const commissionRow = booking.commissions[0] ?? null
	const detail: CommissionDetail | null = commissionRow
		? {
				id: commissionRow.id,
				kind: commissionRow.kind,
				percentage: commissionRow.percentage,
				baseAmount: commissionRow.baseAmount,
				commissionAmount: commissionRow.commissionAmount,
				totalPaid: commissionRow.totalPaid,
				paidAt: commissionRow.paidAt,
				paidBy: commissionRow.paidBy,
				notes: commissionRow.notes,
			}
		: null

	return {
		id: booking.id,
		eventId: booking.event.id,
		date: booking.event.date,
		tourName: getEventDisplayName(booking.event),
		tourType: booking.event.serviceKind,
		entries: booking.priceEntries.map((e) => ({ name: e.categoryName, count: e.count })),
		saleAmount: revenue.grandTotal,
		entranceFees: revenue.totalEntrance,
		tourOnlyAmount: revenue.grandTotal - revenue.totalEntrance,
		commissionPaid: commissionRow !== null,
		commission: detail,
	}
}

// ─── T-C1: getCommissionOperators ─────────────────────────────────────────────

/**
 * Returns sellers (any User set as SaleRecord.sellerId, regardless of role) who have at least
 * one unpaid eligible booking in the given period.
 *
 * "Operator" = the SELLER of the voucher via SaleRecord.sellerId, NOT the Provider company.
 * No role filter is applied: an admin or read-only user who is the seller of an eligible
 * booking still appears here. Commission flows: company pays commission to the SELLER USER.
 *
 * A booking is eligible when:
 *   - saleRecord.sellerId = user.id (the user is the seller)
 *   - event.status = COMPLETED
 *   - event.date in [startDate, endDate]
 *   - tour name matches the requested kind (JS post-filter)
 *   - no EventBookingCommission row exists for (bookingId, kind)
 *
 * bookingsCount counts only UNPAID eligible bookings.
 */
export async function getCommissionOperators(
	kind: CommissionKind,
	dateRange: { startDate: Date; endDate: Date }
): Promise<OperatorOption[]> {
	assertKind(kind)

	try {
		await getAuthUser()

		const startDate = startOfDay(dateRange.startDate)
		const endDate = endOfDay(dateRange.endDate)

		// Fetch all COMPLETED + in-period + not-cancelled bookings, grouped by sellerId.
		// We include commissions to derive paid state per booking.
		const bookings = await prisma.eventBooking.findMany({
			where: {
				cancelled: false,
				saleRecord: {
					type: "SALE",
					status: { not: "CANCELLED" },
				},
				event: {
					status: "COMPLETED",
					date: { gte: startDate, lte: endDate },
				},
			},
			select: {
				id: true,
				saleRecord: {
					select: {
						sellerId: true,
					},
				},
				event: {
					select: {
						tour: { select: { name: true } },
					},
				},
				commissions: {
					where: { kind },
					select: { id: true },
				},
			},
		})

		// Aggregate per seller (User): count unpaid + kind-matching bookings
		const operatorMap = new Map<string, { unpaidCount: number }>()

		for (const booking of bookings) {
			const sellerId = booking.saleRecord.sellerId
			if (!matchesKind(booking.event.tour?.name, kind)) continue
			const isPaid = booking.commissions.length > 0
			if (isPaid) continue

			const existing = operatorMap.get(sellerId)
			if (existing) {
				existing.unpaidCount++
			} else {
				operatorMap.set(sellerId, { unpaidCount: 1 })
			}
		}

		if (operatorMap.size === 0) return []

		// Fetch User names for the sellers with unpaid bookings
		const users = await prisma.user.findMany({
			where: {
				id: { in: [...operatorMap.keys()] },
			},
			select: {
				id: true,
				name: true,
			},
			orderBy: { name: "asc" },
		})

		return users.map((u) => ({
			id: u.id,
			name: u.name,
			bookingsCount: operatorMap.get(u.id)?.unpaidCount ?? 0,
		}))
	} catch (error) {
		console.error("Error fetching commission operators:", error)
		throw new Error("Error al obtener las operadoras")
	}
}

// ─── T-C2: getCommissionSales ─────────────────────────────────────────────────

/**
 * Returns vouchers (SaleRecords) with only in-period, in-kind, COMPLETED bookings embedded.
 * Each booking carries its own commissionPaid flag derived from EventBookingCommission row existence.
 *
 * A voucher with bookings in multiple months appears once per queried month, showing only
 * the bookings whose event.date falls in the requested period — this is intentional.
 *
 * The old "earliestEventDate" post-filter is ELIMINATED. Filtering is SQL-native via event.date.
 */
export async function getCommissionSales(
	filters: CommissionFilters,
	kind: CommissionKind
): Promise<CommissionSale[]> {
	assertKind(kind)

	try {
		if (!filters.operatorId) {
			return []
		}

		const allowedOperatorId = await resolveAllowedOperatorId(filters.operatorId)

		const startDate = startOfDay(filters.startDate)
		const endDate = endOfDay(filters.endDate)

		// Query at booking level: each row is an EventBooking that satisfies all filters.
		// Tour-name (kind) matching is done in JS post-fetch (no Prisma regex support).
		const bookings = await prisma.eventBooking.findMany({
			where: buildBookingWhere(allowedOperatorId, startDate, endDate),
			select: {
				...BOOKING_SELECT,
				saleRecord: {
					select: {
						id: true,
						voucher: true,
						fileNumber: true,
						createdAt: true,
						channel: true,
					},
				},
				commissions: {
					where: { kind },
					select: {
						id: true,
						kind: true,
						percentage: true,
						baseAmount: true,
						commissionAmount: true,
						totalPaid: true,
						paidAt: true,
						notes: true,
						paidBy: { select: { id: true, name: true } },
					},
				},
			},
			orderBy: { event: { date: "asc" } },
		})

		// Post-filter: keep only bookings whose tour name matches the requested kind
		const matchingBookings = bookings.filter((b) => matchesKind(b.event.tour?.name, kind))

		// Group by saleRecord to produce CommissionSale[]
		const saleMap = new Map<
			string,
			{ meta: CommissionSale["id"] extends string ? CommissionSale : never; bookingRows: CommissionBooking[] }
		>()

		// We need a helper type-safe grouping approach
		const saleMetaMap = new Map<
			string,
			{
				id: string
				voucher: number
				fileNumber: string | null
				createdAt: Date
				channel: string
			}
		>()
		const saleBookingsMap = new Map<string, CommissionBooking[]>()

		for (const booking of matchingBookings) {
			const sale = booking.saleRecord
			if (!saleMetaMap.has(sale.id)) {
				saleMetaMap.set(sale.id, {
					id: sale.id,
					voucher: sale.voucher,
					fileNumber: sale.fileNumber,
					createdAt: sale.createdAt,
					channel: sale.channel,
				})
			}
			if (!saleBookingsMap.has(sale.id)) {
				saleBookingsMap.set(sale.id, [])
			}
			saleBookingsMap.get(sale.id)!.push(mapBooking(booking as Parameters<typeof mapBooking>[0]))
		}

		// Build CommissionSale array, skipping any voucher that ended up with no bookings
		const result: CommissionSale[] = []
		for (const [saleId, meta] of saleMetaMap.entries()) {
			const bookingList = saleBookingsMap.get(saleId) ?? []
			if (bookingList.length === 0) continue

			const totalSaleAmount = bookingList.reduce((sum, b) => sum + b.saleAmount, 0)
			const totalEntranceFees = bookingList.reduce((sum, b) => sum + b.entranceFees, 0)

			result.push({
				id: meta.id,
				voucher: meta.voucher,
				fileNumber: meta.fileNumber,
				createdAt: meta.createdAt,
				channel: meta.channel,
				bookings: bookingList,
				totalSaleAmount,
				totalEntranceFees,
				totalTourOnly: totalSaleAmount - totalEntranceFees,
				kind,
			})
		}

		// Sort by earliest booking date within each sale
		result.sort((a, b) => {
			const aDate = Math.min(...a.bookings.map((bk) => new Date(bk.date).getTime()))
			const bDate = Math.min(...b.bookings.map((bk) => new Date(bk.date).getTime()))
			return aDate - bDate
		})

		return result
	} catch (error) {
		console.error("Error fetching commission sales:", error)
		throw new Error("Error al obtener las ventas para comisiones")
	}
}

// ─── T-C3: getCommissionSummary ───────────────────────────────────────────────

/**
 * Aggregates booking-level commission data for the given period + operator + kind.
 * totalCommissionPaid = sum of EventBookingCommission.totalPaid for paid bookings.
 */
export async function getCommissionSummary(
	filters: CommissionFilters,
	kind: CommissionKind
): Promise<CommissionSummary> {
	assertKind(kind)

	try {
		const sales = await getCommissionSales(filters, kind)

		const allBookings = sales.flatMap((s) => s.bookings)

		// totalSales: count of vouchers with at least one matching booking (consistent with UI grouping)
		const totalSales = sales.length

		const totalSaleAmount = sales.reduce((sum, s) => sum + s.totalSaleAmount, 0)
		const totalEntranceFees = sales.reduce((sum, s) => sum + s.totalEntranceFees, 0)
		const totalTourOnly = sales.reduce((sum, s) => sum + s.totalTourOnly, 0)

		// Sum totalPaid from the persisted commission rows for paid bookings
		const totalCommissionPaid = allBookings.reduce((sum, b) => {
			return sum + (b.commission?.totalPaid ?? 0)
		}, 0)

		return {
			totalSales,
			totalSaleAmount,
			totalEntranceFees,
			totalTourOnly,
			totalCommissionPaid,
		}
	} catch (error) {
		console.error("Error fetching commission summary:", error)
		throw new Error("Error al calcular el resumen de comisiones")
	}
}

// ─── T-C4: markCommissionsAsPaid ──────────────────────────────────────────────

/**
 * Marks individual bookings as commission-paid by creating EventBookingCommission rows.
 * Input now accepts bookingIds instead of the former saleIds.
 *
 * - Re-fetches booking revenue server-side (never trusts client-supplied amounts).
 * - Verifies event.status = COMPLETED and tour matches kind; silently skips ineligible.
 * - Uses createMany({ skipDuplicates: true }) inside a transaction for concurrency safety.
 * - Two concurrent calls with the same bookingIds result in exactly one row per booking.
 */
export async function markCommissionsAsPaid(input: MarkCommissionAsPaidInput) {
	assertKind(input.kind)

	try {
		const user = await getAuthUser()

		const canInteract = await canCurrentUserInteractPath("/comisiones")
		if (!canInteract) throw new Error("No tiene permisos para modificar comisiones")

		if (!input.bookingIds.length) {
			throw new Error("Debe seleccionar al menos una reserva")
		}

		if (input.percentage <= 0) {
			throw new Error("El porcentaje debe ser mayor a 0")
		}

		const result = await prisma.$transaction(
			async (tx) => {
				// Re-fetch booking revenue server-side — never trust client.
				const bookings = await tx.eventBooking.findMany({
					where: {
						id: { in: input.bookingIds },
						cancelled: false,
						event: { status: "COMPLETED" },
					},
					select: {
						id: true,
						event: {
							select: {
								tour: { select: { name: true } },
							},
						},
						priceEntries: {
							select: { count: true, priceSnapshot: true, receptionSnapshot: true },
						},
						entrySnapshots: {
							select: { count: true, priceSnapshot: true },
						},
					},
				})

				// Filter to bookings whose tour matches the requested kind
				const eligibleBookings = bookings.filter((b) =>
					matchesKind(b.event.tour?.name, input.kind)
				)

				if (eligibleBookings.length === 0) {
					return { success: true, created: 0, skipped: input.bookingIds.length }
				}

				const rows = eligibleBookings.map((b) => {
					const revenue = calculateBookingRevenue(b.priceEntries, b.entrySnapshots)
					const baseAmount = revenue.grandTotal - revenue.totalEntrance
					const commissionAmount = Math.round((baseAmount * input.percentage) / 100)

					return {
						eventBookingId: b.id,
						kind: input.kind,
						percentage: input.percentage,
						baseAmount,
						commissionAmount,
						totalPaid: commissionAmount,
						notes: input.notes ?? null,
						paidById: user.id,
					}
				})

				// skipDuplicates absorbs concurrent calls cleanly via the unique(eventBookingId, kind) constraint
				await tx.eventBookingCommission.createMany({
					data: rows,
					skipDuplicates: true,
				})

				const skipped = input.bookingIds.length - eligibleBookings.length
				return { success: true, created: rows.length, skipped }
			},
			{ timeout: 30000 }
		)

		return result
	} catch (error) {
		console.error("Error marking commissions as paid:", error)
		return {
			success: false,
			error: error instanceof Error ? error.message : "Error al marcar comisiones como pagadas",
		}
	}
}

// ─── T-C5: getCommissionPdfData ───────────────────────────────────────────────

/**
 * Returns booking-level data for PDF generation.
 * Same booking-level filtering as getCommissionSales.
 * Each booking carries its own paid indicator — the PDF template can render two sections.
 *
 * A voucher straddling two months appears in each month's PDF showing only in-period bookings.
 */
export async function getCommissionPdfData(filters: CommissionPdfFilters) {
	assertKind(filters.kind)

	try {
		if (!filters.operatorId) {
			throw new Error("Debe seleccionar una operadora")
		}

		const allowedOperatorId = await resolveAllowedOperatorId(filters.operatorId)
		const allowedFilters = { ...filters, operatorId: allowedOperatorId }

		const [operator, sales] = await Promise.all([
			prisma.user.findUnique({
				where: { id: allowedOperatorId },
				select: {
					id: true,
					name: true,
				},
			}),
			getCommissionSales(allowedFilters, allowedFilters.kind),
		])

		if (!operator) {
			throw new Error("Operadora no encontrada")
		}

		const totalSaleAmount = sales.reduce((sum, s) => sum + s.totalSaleAmount, 0)
		const totalEntranceFees = sales.reduce((sum, s) => sum + s.totalEntranceFees, 0)
		const totalTourOnly = sales.reduce((sum, s) => sum + s.totalTourOnly, 0)
		const commissionAmount = Math.round(totalTourOnly * (filters.percentage / 100))

		return {
			operator: {
				id: operator.id,
				name: operator.name,
			},
			period: {
				startDate: filters.startDate,
				endDate: filters.endDate,
			},
			sales,
			kind: filters.kind,
			percentage: filters.percentage,
			totals: {
				totalSaleAmount,
				totalEntranceFees,
				totalTourOnly,
				commissionAmount,
			},
			generatedAt: new Date(),
		}
	} catch (error) {
		console.error("Error fetching commission PDF data:", error)
		throw new Error("Error al obtener los datos para el PDF de comisiones")
	}
}
