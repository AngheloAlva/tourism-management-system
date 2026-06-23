"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { generateAgencyTransferVoucherNumber } from "@/shared/utils/generate-agency-transfer-voucher"
import { registerCashFlowFromTransfer } from "@/project/cash-flow/utils/cash-flow-internal"
import { notifyTransferCreatedByEmail } from "@/project/notifications/actions/automatic-email.actions"
import { canCurrentUserInteractPaths } from "@/project/roles/actions/role.actions"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { AuditService } from "@/lib/audit/service"
import { requestApproval } from "@/project/approvals/actions/approval.actions"
import { computeFingerprint } from "@/project/approvals/utils/fingerprint"
import { buildSnapshot } from "@/project/approvals/utils/snapshot"
import { APPROVAL_ACTION } from "@/generated/prisma/enums"
import { todayInSantiago } from "@/shared/utils/calendar-day"
import { isLargeTransferChange } from "../utils/transfer-change-size"
import {
	prepareTransferUpdate,
	applyTransferUpdateTx,
} from "../server/apply-transfer-update"

import type { Prisma } from "@/generated/prisma/client"

import type { TransferFormData } from "../schemas/transfer.schema"
import type {
	TRANSFER_TYPE,
	PAYMENT_METHOD,
	TRANSFER_PAYMENT_STATUS,
} from "@/generated/prisma/enums"

export interface TransferWithDetails {
	id: string
	date: Date
	voucher: number
	type: "OUTGOING" | "INCOMING"
	status: string
	cancelledAt: Date | null
	cancelReason: string | null
	cancelledById: string | null
	paymentStatus: "PENDING" | "ENTRANCE_ONLY" | "TOUR_ONLY" | "FULLY_PAID"
	comments: string | null
	createdAt: Date
	updatedAt: Date
	saleRecord: {
		id: string
		voucher: number
		type: "SALE" | "QUOTE"
		passengers: Array<{
			id: string
			name: string | null
			document: string | null
			age: number | null
			nationality: string | null
			diet: "NORMAL" | "VEGETARIAN" | "VEGAN" | "CELIAC" | "OTHER" | null
			dietOther: string | null
			phone: string | null
			hotel: string | null
			email: string | null
		}>
	} | null
	agency: {
		id: string
		name: string
	}
	priceDetails: Array<{
		id: string
		passengerName: string
		sourcePassengerId?: string | null
		tourPrice: number
		entrancePrice: number
		totalPrice: number
		ageCategory: string
	}>
	eventBookings: Array<{
		id: string
		passengerCount: number
		event: {
			id: string
			date: Date
			mode: "REGULAR" | "PRIVATE"
			tour: {
				id: string
				name: string
			}
		}
	}>
	passengers: Array<{
		id: string
		name: string | null
		document: string | null
		age: number | null
		nationality: string | null
	}>
	payments: Array<{
		id: string
		refund: boolean
		method:
			| "CASH"
			| "TRANSFER"
			| "CREDIT_CARD"
			| "DEBIT_CARD"
			| "PAYMENT_LINK_DEBIT"
			| "PAYMENT_LINK_CREDIT"
		amount: number
		date: Date
		comments: string | null
		documentNumber: string | null
	}>
	createdByUser: {
		id: string
		name: string
	}
}

export interface TransferFilters {
	paymentStatus?: "PENDING" | "ENTRANCE_ONLY" | "TOUR_ONLY" | "FULLY_PAID"
	agencyName?: string
	startDate?: Date
	endDate?: Date
	search?: string
	showCancelled?: boolean
}

export interface PaginatedTransfers {
	data: TransferWithDetails[]
	total: number
	page: number
	pageSize: number
}

const TRANSFER_SORTABLE_FIELDS = ["status", "voucher", "date", "comments"] as const
export type TransferSort = { field: string; order: "asc" | "desc" }

async function getAuthUser() {
	const session = await auth.api.getSession({
		headers: await headers(),
	})

	if (!session?.user) {
		throw new Error("No autenticado")
	}

	return session.user
}

export async function getTransfers(
	filters?: TransferFilters,
	page = 1,
	pageSize = 50,
	sort?: TransferSort | null
): Promise<PaginatedTransfers> {
	try {
		await getAuthUser()

		const where: Prisma.AgencyTransferWhereInput = {
			type: "OUTGOING",
			...(!filters?.showCancelled && { status: "ACTIVE" }),
		}

		if (filters?.paymentStatus) {
			where.paymentStatus = filters.paymentStatus
		}

		if (filters?.agencyName) {
			where.agency = {
				name: {
					contains: filters.agencyName,
					mode: "insensitive",
				},
			}
		}

		if (filters?.startDate || filters?.endDate) {
			where.date = {}
			if (filters.startDate) {
				where.date.gte = filters.startDate
			}
			if (filters.endDate) {
				where.date.lte = filters.endDate
			}
		}

		if (filters?.search) {
			const term = filters.search.trim()
			const numericTerm = Number(term)

			where.AND = [
				...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
				{
					OR: [
						{ agency: { name: { contains: term, mode: "insensitive" } } },
						{ saleRecord: { passengers: { some: { name: { contains: term, mode: "insensitive" } } } } },
						...(Number.isFinite(numericTerm) && numericTerm > 0
							? [{ voucher: numericTerm }, { saleRecord: { voucher: numericTerm } }]
							: []),
					],
				},
			]
		}

		const [transfers, total] = await Promise.all([
			prisma.agencyTransfer.findMany({
				where,
				include: {
					createdByUser: true,
					saleRecord: {
						include: {
							passengers: true,
						},
					},
					agency: {
						select: {
							id: true,
							name: true,
						},
					},
					priceDetails: true,
					payments: true,
					eventBookings: {
						include: {
							event: {
								include: {
									tour: {
										select: {
											id: true,
											name: true,
										},
									},
									transferService: { select: { id: true, name: true } },
								},
							},
						},
					},
					passengers: true,
				},
				orderBy: (() => {
					const isValidSort =
						sort && (TRANSFER_SORTABLE_FIELDS as readonly string[]).includes(sort.field)
					return isValidSort
						? ({ [sort.field]: sort.order } as Prisma.AgencyTransferOrderByWithRelationInput)
						: { createdAt: "desc" as const }
				})(),
				skip: (page - 1) * pageSize,
				take: pageSize,
			}),
			prisma.agencyTransfer.count({ where }),
		])

		return {
			data: transfers as unknown as TransferWithDetails[],
			total,
			page,
			pageSize,
		}
	} catch (error) {
		console.error("Error fetching transfers:", error)
		throw new Error("Error al obtener los traspasos")
	}
}

export async function getTransferById(id: string): Promise<TransferWithDetails | null> {
	try {
		await getAuthUser()

		const transfer = await prisma.agencyTransfer.findUnique({
			where: { id },
			include: {
				createdByUser: true,
				saleRecord: {
					include: {
						passengers: true,
					},
				},
				agency: {
					select: {
						id: true,
						name: true,
					},
				},
				priceDetails: true,
				payments: true,
				eventBookings: {
					include: {
						event: {
							include: {
								tour: {
									select: {
										id: true,
										name: true,
									},
								},
								transferService: { select: { id: true, name: true } },
							},
						},
					},
				},
				passengers: true,
			},
		})

		if (!transfer) return null
		return transfer as unknown as TransferWithDetails
	} catch (error) {
		console.error("Error fetching transfer:", error)
		throw new Error("Error al obtener el traspaso")
	}
}

export async function createTransfer(data: TransferFormData) {
	try {
		const canInteract = await canCurrentUserInteractPaths([
			"/dashboard/traspasos",
			"/dashboard/navegacion-traspasos",
		])
		if (!canInteract) {
			throw new Error("No autorizado para interactuar con traspasos")
		}

		const h = await headers()
		const session = await auth.api.getSession({
			headers: h,
		})

		if (!session?.user?.id) {
			throw new Error("No autorizado")
		}

		if (!data.saleRecordId) {
			throw new Error("Debe seleccionar un voucher")
		}
		if (!data.agencyId) {
			throw new Error("Debe seleccionar una agencia")
		}

		const transferredEvents = data.eventTransfers.filter((et) => et.transferEvent)

		if (transferredEvents.length === 0) {
			throw new Error("Debe seleccionar al menos un evento para transferir")
		}

		const selectedPassengersByEvent = transferredEvents
			.map((eventTransfer) => ({
				eventId: eventTransfer.eventId,
				passengerPrices: (eventTransfer.passengerPrices || []).filter(
					(passenger) =>
						passenger.isSelected &&
						!passenger.isAlreadyTransferred &&
						passenger.sourceSaleRecordId === data.saleRecordId
				),
			}))
			.filter((eventTransfer) => eventTransfer.passengerPrices.length > 0)

		const selectedPassengerPrices = selectedPassengersByEvent.flatMap((et) => et.passengerPrices)

		if (selectedPassengerPrices.length === 0) {
			throw new Error("Debe seleccionar al menos un pasajero para transferir")
		}

		const uniqueSelectedPassengerPrices = Array.from(
			new Map(
				selectedPassengerPrices.map((passenger) => [passenger.passengerId, passenger])
			).values()
		)

		const selectedPassengerIds = uniqueSelectedPassengerPrices
			.map((passenger) => passenger.passengerId)
			.filter(Boolean)

		if (selectedPassengerIds.length === 0) {
			throw new Error("No se pudo identificar los pasajeros seleccionados para transferir")
		}

		const selectedEventIds = Array.from(new Set(selectedPassengersByEvent.map((et) => et.eventId)))
		const alreadyTransferredPassengers = await prisma.transferPriceDetail.findMany({
			where: {
				sourcePassengerId: {
					in: selectedPassengerIds,
				},
				transfer: {
					type: "OUTGOING",
					eventBookings: {
						some: {
							eventId: {
								in: selectedEventIds,
							},
						},
					},
				},
			},
			select: {
				sourcePassengerId: true,
			},
		})

		const alreadyTransferredIds = new Set(
			alreadyTransferredPassengers
				.map((passenger) => passenger.sourcePassengerId)
				.filter((id): id is string => Boolean(id))
		)

		if (alreadyTransferredIds.size > 0) {
			const duplicatedNames = uniqueSelectedPassengerPrices
				.filter((passenger) => alreadyTransferredIds.has(passenger.passengerId))
				.map((passenger) => passenger.passengerName)
				.slice(0, 5)

			throw new Error(
				`Algunos pasajeros ya fueron traspasados y no pueden repetirse: ${duplicatedNames.join(", ")}`
			)
		}

		const eventBookingsToCreate = selectedPassengersByEvent
			.map((eventTransfer) => {
				const passengerPrices = eventTransfer.passengerPrices.filter(
					(passenger) => !alreadyTransferredIds.has(passenger.passengerId)
				)

				if (passengerPrices.length === 0) return null

				const counts = passengerPrices.reduce(
					(acc, curr) => {
						acc.total++
						if (curr.ageCategory === "adult") acc.adults++
						if (curr.ageCategory === "child") acc.children++
						if (curr.ageCategory === "senior") acc.seniors++
						return acc
					},
					{ total: 0, adults: 0, children: 0, seniors: 0 }
				)

				return {
					eventId: eventTransfer.eventId,
					passengerCount: counts.total,
					adultsCount: counts.adults,
					childrenCount: counts.children,
					seniorsCount: counts.seniors,
				}
			})
			.filter((eventBooking): eventBooking is NonNullable<typeof eventBooking> =>
				Boolean(eventBooking)
			)

		if (eventBookingsToCreate.length === 0) {
			throw new Error("No hay pasajeros disponibles para transferir en los eventos seleccionados")
		}

		let voucherNumber = await generateAgencyTransferVoucherNumber()

		let isUnique = (await prisma.agencyTransfer.count({ where: { voucher: voucherNumber } })) === 0
		while (!isUnique) {
			voucherNumber = await generateAgencyTransferVoucherNumber()
			isUnique = (await prisma.agencyTransfer.count({ where: { voucher: voucherNumber } })) === 0
		}

		const agency = await prisma.transferAgency.findUnique({
			where: { id: data.agencyId },
			select: { name: true },
		})

		const transfer = await prisma.agencyTransfer.create({
			data: {
				voucher: voucherNumber,
				createdBy: session.user.id,
				type: data.type as TRANSFER_TYPE,
				agencyId: data.agencyId,
				date: data.date,
				paymentStatus: data.paymentStatus as TRANSFER_PAYMENT_STATUS,
				comments: data.comments,
				saleRecordId: data.saleRecordId,

				passengers: {
					create: uniqueSelectedPassengerPrices.map((pp) => ({
						name: pp.passengerName,
					})),
				},

				priceDetails: {
					create: uniqueSelectedPassengerPrices.map((pp) => ({
						passengerName: pp.passengerName,
						sourcePassengerId: pp.passengerId,
						ageCategory: pp.ageCategory,
						tourPrice: pp.tourPrice,
						entrancePrice: pp.entrancePrice,
						totalPrice: pp.totalPrice,
					})),
				},

				eventBookings: {
					create: eventBookingsToCreate,
				},

				payments: {
					create: (data.payments || []).map((payment) => ({
						amount: parseFloat(payment.amount),
						method: payment.method as PAYMENT_METHOD,
						date: payment.date,
						documentNumber: payment.documentNumber,
						comments: payment.comments,
						refund: payment.refund,
						isTransferPayment: true,
					})),
				},
			},
		})

		// Registrar pagos en el flujo de caja
		if (data.payments && data.payments.length > 0) {
			const cashFlowPromises = data.payments
				.filter((p) => !p.refund && parseFloat(p.amount) > 0)
				.map((payment) =>
					registerCashFlowFromTransfer({
						transferId: transfer.id,
						transferVoucher: voucherNumber,
						amount: parseFloat(payment.amount),
						paymentMethod: payment.method as
							| "CASH"
							| "TRANSFER"
							| "CREDIT_CARD"
							| "DEBIT_CARD"
							| "PAYMENT_LINK_DEBIT"
							| "PAYMENT_LINK_CREDIT",
						transferType: data.type as "OUTGOING" | "INCOMING",
						agencyName: agency?.name || "Agencia",
						userId: session.user.id,
					}).catch((err) =>
						console.error("Error registering transfer payment in cash flow:", err)
					)
				)
			await Promise.all(cashFlowPromises)
		}

		await notifyTransferCreatedByEmail(transfer.id)

		return { success: true, data: transfer }
	} catch (error) {
		console.error("Error creating transfer:", error)
		return {
			success: false,
			error: error instanceof Error ? error.message : "Error al crear el traspaso",
		}
	}
}

/**
 * Solicita autorización para eliminar un traspaso.
 * Usa el flujo asincrónico — el executor ejecuta el hard delete al aprobarse.
 */
export async function deleteTransfer(id: string, reason: string) {
	try {
		await getAuthUser()
		const canInteract = await canCurrentUserInteractPaths([
			"/dashboard/traspasos",
			"/dashboard/navegacion-traspasos",
		])
		if (!canInteract) {
			return { success: false, error: "No autorizado para interactuar con traspasos" }
		}

		if (!reason.trim()) {
			return { success: false, error: "Debe indicar el motivo" }
		}

		const transfer = await prisma.agencyTransfer.findUnique({
			where: { id },
			select: { id: true, status: true, voucher: true, type: true, updatedAt: true },
		})

		if (!transfer) {
			return { success: false, error: "Traspaso no encontrado" }
		}

		const fingerprint = computeFingerprint(transfer)
		const snapshot = buildSnapshot("transfers", {
			id: transfer.id,
			status: transfer.status,
			voucher: transfer.voucher,
			type: transfer.type,
		})

		const result = await requestApproval({
			action: APPROVAL_ACTION.DELETE_TRANSFER,
			targetType: "agency-transfer",
			targetId: id,
			payload: { reason: reason.trim() },
			reason: reason.trim(),
			targetFingerprint: fingerprint,
			snapshot,
			source: { path: "/dashboard/traspasos", ui: "delete-transfer-dialog" },
		})

		if ("error" in result) {
			return { success: false, error: result.message }
		}

		return {
			success: true,
			approvalRequired: result.approvalRequired,
			requestId: result.approvalRequired ? result.requestId : undefined,
		}
	} catch (error) {
		console.error("Error requesting transfer deletion:", error)
		return { success: false, error: "Error al solicitar la eliminación del traspaso" }
	}
}

/**
 * Obtiene eventos futuros que tienen ventas confirmadas (no cotizaciones)
 * y que no han sido completamente traspasados
 */
export interface EventForTransfer {
	id: string
	date: Date
	startTime: string | null
	mode: "REGULAR" | "PRIVATE"
	tour: {
		id: string
		name: string
		priceCategories: Array<{
			name: string
			isDefault: boolean
			ageMin: number | null
			ageMax: number | null
			receptionPrice: number
			transferPrice: number
			minPrice: number | null
			maxPrice: number | null
			isSpecial: boolean
			/** Sum of this category's non-special active entry prices (per-passenger entrance fee). */
			entranceTotal: number
		}>
	}
	totalPassengers: number
	totalTransferredPassengers: number
	totalAvailablePassengers: number
	isFullyTransferred: boolean
	saleRecords: Array<{
		id: string
		voucher: number
		passengerCount: number
		transferredPassengerCount: number
		availablePassengerCount: number
		isFullyTransferred: boolean
		passengers: Array<{
			id: string
			name: string | null
			age: number | null
			alreadyTransferred: boolean
		}>
	}>
}

export async function getEventsForTransfer(excludeTransferId?: string): Promise<EventForTransfer[]> {
	try {
		await getAuthUser()

		// event.date is @db.Date — compare against Santiago calendar day start.
		const today = todayInSantiago()
		// Transfers aren't always done the same day, so allow selecting events from
		// up to one month back. UTC components keep this aligned with @db.Date values.
		const oneMonthAgo = new Date(
			Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, today.getUTCDate())
		)

		const events = await prisma.event.findMany({
			where: {
				bookings: {
					some: {
						saleRecord: {
							type: "SALE",
						},
					},
				},
				...(excludeTransferId ? {} : { date: { gte: oneMonthAgo } }),
			},
			include: {
				transferService: {
					select: {
						id: true,
						name: true,
						receptionPricePerPassenger: true,
					},
				},
				tour: {
					select: {
						id: true,
						name: true,
						priceCategories: {
							where: { active: true },
							select: {
								name: true,
								isDefault: true,
								ageMin: true,
								ageMax: true,
								receptionPrice: true,
								transferPrice: true,
								minPrice: true,
								maxPrice: true,
								isSpecial: true,
								entries: {
									where: { active: true },
									select: { price: true, isSpecial: true },
								},
							},
						},
					},
				},
				bookings: {
					where: {
						saleRecord: {
							type: "SALE",
						},
					},
					include: {
						saleRecord: {
							select: {
								id: true,
								voucher: true,
								passengers: {
									select: {
										id: true,
										name: true,
										age: true,
									},
								},
							},
						},
					},
				},
			},
			orderBy: {
				date: "asc",
			},
		})

		const eventIds = events.map((event) => event.id)
		const transferredDetailsByEvent =
			eventIds.length > 0
				? await prisma.transferEventBooking.findMany({
						where: {
							eventId: { in: eventIds },
							transfer: {
								type: "OUTGOING",
								...(excludeTransferId && { id: { not: excludeTransferId } }),
							},
						},
						select: {
							eventId: true,
							transfer: {
								select: {
									priceDetails: {
										select: {
											sourcePassengerId: true,
											passengerName: true,
										},
									},
								},
							},
						},
					})
				: []

		const transferredPassengerIdsByEvent = new Map<string, Set<string>>()
		const transferredPassengerNamesByEvent = new Map<string, Set<string>>()

		for (const booking of transferredDetailsByEvent) {
			if (!transferredPassengerIdsByEvent.has(booking.eventId)) {
				transferredPassengerIdsByEvent.set(booking.eventId, new Set<string>())
			}
			if (!transferredPassengerNamesByEvent.has(booking.eventId)) {
				transferredPassengerNamesByEvent.set(booking.eventId, new Set<string>())
			}

			const idsSet = transferredPassengerIdsByEvent.get(booking.eventId)!
			const namesSet = transferredPassengerNamesByEvent.get(booking.eventId)!

			for (const priceDetail of booking.transfer.priceDetails) {
				if (priceDetail.sourcePassengerId) {
					idsSet.add(priceDetail.sourcePassengerId)
				}
				const normalizedName = priceDetail.passengerName?.trim().toLowerCase()
				// Fallback por nombre solo para registros históricos sin sourcePassengerId.
				if (!priceDetail.sourcePassengerId && normalizedName) {
					namesSet.add(normalizedName)
				}
			}
		}

		const mappedEvents = events
			.map((event) => {
				const normalizedTour: EventForTransfer["tour"] | null = event.tour
					? {
							id: event.tour.id,
							name: event.tour.name,
							priceCategories: event.tour.priceCategories.map((pc) => ({
								name: pc.name,
								isDefault: pc.isDefault,
								ageMin: pc.ageMin,
								ageMax: pc.ageMax,
								receptionPrice: pc.receptionPrice,
								transferPrice: pc.transferPrice,
								minPrice: pc.minPrice,
								maxPrice: pc.maxPrice,
								isSpecial: pc.isSpecial,
								// Per-passenger entrance fee: sum of this category's non-special
								// active entries (mirrors buildEntrySnapshotsFromTour in sales).
								entranceTotal: pc.entries
									.filter((entry) => !entry.isSpecial)
									.reduce((sum, entry) => sum + entry.price, 0),
							})),
						}
					: event.transferService
						? {
								id: event.transferService.id,
								name: event.transferService.name,
								priceCategories: [
									{
										name: "Pasajero",
										isDefault: true,
										ageMin: null,
										ageMax: null,
										receptionPrice: event.transferService.receptionPricePerPassenger,
										transferPrice: 0,
										minPrice: null,
										maxPrice: null,
										isSpecial: false,
										entranceTotal: 0,
									},
								],
							}
						: null

				if (!normalizedTour) return null

				const transferredIds = transferredPassengerIdsByEvent.get(event.id) || new Set<string>()
				const transferredNames = transferredPassengerNamesByEvent.get(event.id) || new Set<string>()

				const saleRecords = event.bookings.map((booking) => {
					const passengers = booking.saleRecord.passengers.map((passenger) => {
						const normalizedName = passenger.name?.trim().toLowerCase()
						const alreadyTransferred =
							transferredIds.has(passenger.id) ||
							(normalizedName ? transferredNames.has(normalizedName) : false)

						return {
							id: passenger.id,
							name: passenger.name,
							age: passenger.age,
							alreadyTransferred,
						}
					})

					const transferredPassengerCount = passengers.filter((p) => p.alreadyTransferred).length
					const availablePassengerCount = passengers.length - transferredPassengerCount

					return {
						id: booking.saleRecord.id,
						voucher: booking.saleRecord.voucher,
						passengerCount: booking.passengerCount,
						transferredPassengerCount,
						availablePassengerCount,
						isFullyTransferred: passengers.length > 0 && availablePassengerCount === 0,
						passengers,
					}
				})

				const totalPassengers = saleRecords.reduce(
					(sum, saleRecord) => sum + saleRecord.passengerCount,
					0
				)
				const totalTransferredPassengers = saleRecords.reduce(
					(sum, saleRecord) => sum + saleRecord.transferredPassengerCount,
					0
				)
				const totalAvailablePassengers = saleRecords.reduce(
					(sum, saleRecord) => sum + saleRecord.availablePassengerCount,
					0
				)

				return {
					id: event.id,
					date: event.date,
					startTime: event.startTime,
					mode: event.mode,
					tour: normalizedTour,
					totalPassengers,
					totalTransferredPassengers,
					totalAvailablePassengers,
					isFullyTransferred: totalPassengers > 0 && totalAvailablePassengers === 0,
					saleRecords,
				}
			})
			.filter((event): event is NonNullable<typeof event> => Boolean(event))

		// Excluir eventos totalmente traspasados para mantener la selección limpia.
		return mappedEvents.filter((event) => !event.isFullyTransferred)
	} catch (error) {
		console.error("Error fetching events for transfer:", error)
		return []
	}
}

/**
 * Updates an existing OUTGOING transfer.
 *
 * Routing logic (W-3 fix + approval gate):
 * - Validates auth + permission + transfer guards (cancelled, type)
 * - Calls prepareTransferUpdate (conflict check) and classifies the change as LARGE or SMALL
 * - If LARGE and user is not admin:
 *   - No reason → returns { success:true, approvalRequired:true, needsReason:true }
 *   - With reason → creates ApprovalRequest and returns { success:true, approvalRequired:true, requestId }
 *   - No DB mutation in either case
 * - If SMALL or user is admin → executes applyTransferUpdateTx inside $transaction (W-3: atomic)
 *
 * Return union:
 *   { success: true }
 *   { success: true; approvalRequired: true; needsReason: true }
 *   { success: true; approvalRequired: true; requestId: string }
 *   { success: false; error: string }
 */
export async function updateTransfer(
	id: string,
	data: TransferFormData,
	reason?: string
): Promise<
	| { success: true }
	| { success: true; approvalRequired: true; needsReason: true }
	| { success: true; approvalRequired: true; requestId: string }
	| { success: false; error: string }
> {
	try {
		const canInteract = await canCurrentUserInteractPaths([
			"/dashboard/traspasos",
			"/dashboard/navegacion-traspasos",
		])
		if (!canInteract) {
			throw new Error("No autorizado para interactuar con traspasos")
		}

		const h = await headers()
		const session = await auth.api.getSession({ headers: h })

		if (!session?.user?.id) {
			throw new Error("No autorizado")
		}

		const user = session.user

		// 1. Fetch current transfer with all relations needed by prepareTransferUpdate + snapshot
		const current = await prisma.agencyTransfer.findUnique({
			where: { id },
			include: {
				agency: { select: { name: true } },
				priceDetails: { select: { id: true, sourcePassengerId: true, totalPrice: true } },
				passengers: { select: { id: true } },
				eventBookings: {
					include: {
						event: { select: { id: true, date: true } },
					},
				},
				payments: { select: { id: true } },
			},
		})

		if (!current) return { success: false, error: "Traspaso no encontrado" }
		if (current.status === "CANCELLED") {
			return { success: false, error: "No se puede editar un traspaso cancelado" }
		}
		if (current.type !== "OUTGOING") {
			return { success: false, error: "Solo se pueden editar traspasos de tipo salida" }
		}

		// 2. Snapshot oldData for audit
		const oldData = {
			agencyId: current.agencyId,
			saleRecordId: current.saleRecordId,
			paymentStatus: current.paymentStatus,
			comments: current.comments,
			passengerCount: current.passengers.length,
			totalAmount: current.priceDetails.reduce((s, p) => s + p.totalPrice, 0),
		}

		// 3. Prepare update (validates passenger selection, checks conflicts, resolves agency name)
		//    throws with a user-facing message on conflict or validation failure
		let prepared: Awaited<ReturnType<typeof prepareTransferUpdate>>
		try {
			prepared = await prepareTransferUpdate(id, data, current)
		} catch (prepErr) {
			return {
				success: false,
				error: prepErr instanceof Error ? prepErr.message : "Error al preparar el traspaso",
			}
		}

		// 4. Classify change size (LARGE vs SMALL)
		const currentSnap = {
			eventIds: new Set(current.eventBookings.map((b) => b.event.id)),
			passengerIds: new Set(
				current.priceDetails
					.map((d) => d.sourcePassengerId)
					.filter((pid): pid is string => Boolean(pid))
			),
		}
		const nextSnap = {
			eventIds: new Set(prepared.eventBookingsToCreate.map((b) => b.eventId)),
			passengerIds: new Set(prepared.uniqueSelectedPassengerPrices.map((p) => p.passengerId)),
		}
		const isLarge = isLargeTransferChange(currentSnap, nextSnap)

		// 5. Approval gate: LARGE + non-admin → route through approval system
		if (isLarge && user.role !== "admin") {
			if (!reason?.trim()) {
				return { success: true, approvalRequired: true as const, needsReason: true as const }
			}

			const fingerprint = computeFingerprint(current)
			const snapshot = buildSnapshot("transfers", {
				id: current.id,
				status: current.status,
				date: current.date,
				type: current.type,
				passengerCount: current.passengers.length,
			})

			const approvalResult = await requestApproval({
				action: APPROVAL_ACTION.UPDATE_TRANSFER,
				targetType: "agency-transfer",
				targetId: id,
				payload: data,
				reason: reason.trim(),
				targetFingerprint: fingerprint,
				snapshot,
				source: { path: "/dashboard/navegacion-traspasos", ui: "transfer-edit-form" },
			})

			if ("error" in approvalResult) {
				return { success: false, error: approvalResult.message }
			}

			if (approvalResult.approvalRequired) {
				return { success: true, approvalRequired: true as const, requestId: approvalResult.requestId }
			}

			// Gate approved the request immediately (approvalRequired: false) → fall through to direct execution
		}

		// 6. Direct path: SMALL change OR admin → execute atomically via applyTransferUpdateTx
		//    W-3 fix: reversal + new INCOME cash entries are now inside the same $transaction
		await prisma.$transaction((tx) =>
			applyTransferUpdateTx(tx, id, data, prepared, user.id)
		)

		// 7. Audit (outside transaction)
		const newData = {
			agencyId: data.agencyId,
			saleRecordId: data.saleRecordId ?? null,
			paymentStatus: data.paymentStatus,
			comments: data.comments ?? null,
			passengerCount: prepared.uniqueSelectedPassengerPrices.length,
			totalAmount: prepared.uniqueSelectedPassengerPrices.reduce((s, pp) => s + pp.totalPrice, 0),
		}
		await AuditService.logUpdate("AgencyTransfer", id, user, oldData, newData)

		// 8. Revalidate
		revalidatePath("/dashboard/navegacion-traspasos")

		return { success: true }
	} catch (error) {
		console.error("Error updating transfer:", error)
		return {
			success: false,
			error: error instanceof Error ? error.message : "Error al actualizar el traspaso",
		}
	}
}

/**
 * Solicita autorización para cancelar un traspaso.
 * Usa el flujo asincrónico — el executor cancela y revierte entradas de caja al aprobarse.
 */
export async function cancelTransfer(id: string, reason?: string) {
	try {
		await getAuthUser()
		const canInteract = await canCurrentUserInteractPaths([
			"/dashboard/traspasos",
			"/dashboard/navegacion-traspasos",
		])
		if (!canInteract) {
			return { success: false, error: "No autorizado para interactuar con traspasos" }
		}

		const transfer = await prisma.agencyTransfer.findUnique({
			where: { id },
			select: {
				id: true,
				voucher: true,
				status: true,
				type: true,
				updatedAt: true,
			},
		})

		if (!transfer) return { success: false, error: "Traspaso no encontrado" }
		if (transfer.status === "CANCELLED") return { success: false, error: "El traspaso ya está cancelado" }
		if (transfer.type !== "OUTGOING") return { success: false, error: "Solo se pueden cancelar traspasos de tipo salida" }

		const fingerprint = computeFingerprint(transfer)
		const snapshot = buildSnapshot("transfers", {
			id: transfer.id,
			status: transfer.status,
			voucher: transfer.voucher,
			type: transfer.type,
		})

		const result = await requestApproval({
			action: APPROVAL_ACTION.CANCEL_TRANSFER,
			targetType: "agency-transfer",
			targetId: id,
			payload: { reason: reason?.trim() ?? "" },
			reason: reason?.trim() ?? "Cancelación solicitada",
			targetFingerprint: fingerprint,
			snapshot,
			source: { path: "/dashboard/traspasos", ui: "cancel-transfer-dialog" },
		})

		if ("error" in result) {
			return { success: false, error: result.message }
		}

		return {
			success: true,
			approvalRequired: result.approvalRequired,
			requestId: result.approvalRequired ? result.requestId : undefined,
		}
	} catch (error) {
		console.error("Error requesting transfer cancellation:", error)
		return {
			success: false,
			error: error instanceof Error ? error.message : "Error al solicitar la cancelación del traspaso",
		}
	}
}
