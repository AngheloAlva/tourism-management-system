"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import type { Prisma } from "@/generated/prisma/client"
import { EVENT_SERVICE_KIND } from "@/generated/prisma/enums"
import { parseCalendarDay, formatCalendarDay } from "@/shared/utils/calendar-day"
import type { ReceptionFormData } from "../schemas/reception.schema"
import { generateAgencyTransferVoucherNumber } from "@/shared/utils/generate-agency-transfer-voucher"
import { registerCashFlowFromTransfer } from "@/project/cash-flow/utils/cash-flow-internal"
import { notifyReceptionByEmail } from "@/project/notifications/actions/automatic-email.actions"
import { revalidatePath } from "next/cache"
import { AuditService } from "@/lib/audit/service"
import { canCurrentUserInteractPath } from "@/project/roles/actions/role.actions"
import { requestApproval } from "@/project/approvals/actions/approval.actions"
import { computeFingerprint } from "@/project/approvals/utils/fingerprint"
import { buildSnapshot } from "@/project/approvals/utils/snapshot"
import { APPROVAL_ACTION } from "@/generated/prisma/enums"

export interface ReceptionWithDetails {
	id: string
	voucher: number
	type: "INCOMING"
	status: string
	cancelledAt: Date | null
	cancelReason: string | null
	cancelledById: string | null
	date: Date
	paymentStatus: "PENDING" | "ENTRANCE_ONLY" | "TOUR_ONLY" | "FULLY_PAID"
	comments: string | null
	createdAt: Date
	updatedAt: Date
	agency: {
		id: string
		name: string
	}
	priceDetails: Array<{
		id: string
		passengerName: string
		tourPrice: number
		entrancePrice: number
		totalPrice: number
		ageCategory: string
		eventBookingId: string | null
	}>
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
		allergies: string[]
		hotels: Array<{
			id: string
			hotelName: string
			checkIn: Date | null
			checkOut: Date | null
			order: number
		}>
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
		voucherUrl: string | null
		isTransferPayment: boolean
	}>
	eventBookings: Array<{
		id: string
		passengerCount: number
		event: {
			id: string
			date: Date
			serviceKind: "TOUR" | "TRANSFER"
			startTime: string | null
			endTime: string | null
			comments: string | null
			mode: "REGULAR" | "PRIVATE"
			tour: {
				id: string
				name: string
				generalSummaryEs: string | null
				generalSummaryEn: string | null
				generalSummaryPt: string | null
				scheduleEs: string | null
				scheduleEn: string | null
				schedulePt: string | null
				includesEs: string | null
				includesEn: string | null
				includesPt: string | null
				pickupEs: string | null
				pickupEn: string | null
				pickupPt: string | null
				whatToBringEs: string | null
				whatToBringEn: string | null
				whatToBringPt: string | null
				altitudeEs: string | null
				altitudeEn: string | null
				altitudePt: string | null
			} | null
			transferService: {
				id: string
				name: string
			} | null
		}
	}>
	createdByUser: {
		id: string
		name: string
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

async function requireReceptionInteraction() {
	const canInteract = await canCurrentUserInteractPath("/recepcion")
	if (!canInteract) throw new Error("No tiene permisos para modificar recepciones")
}

export interface ReceptionFilters {
	paymentStatus?: "PENDING" | "ENTRANCE_ONLY" | "TOUR_ONLY" | "FULLY_PAID"
	agencyName?: string
	startDate?: Date
	endDate?: Date
	search?: string
	showCancelled?: boolean
}

export interface PaginatedReceptions {
	data: ReceptionWithDetails[]
	total: number
	page: number
	pageSize: number
}

const RECEPTION_SORTABLE_FIELDS = ["voucher", "comments"] as const
export type ReceptionSort = { field: string; order: "asc" | "desc" }

// Get receptions (INCOMING AgencyTransfers)
export async function getReceptions(
	filters?: ReceptionFilters,
	page = 1,
	pageSize = 50,
	sort?: ReceptionSort | null
): Promise<PaginatedReceptions> {
	try {
		await getAuthUser()

		const where: Prisma.AgencyTransferWhereInput = {
			type: "INCOMING",
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
						{ passengers: { some: { name: { contains: term, mode: "insensitive" } } } },
						...(Number.isFinite(numericTerm) && numericTerm > 0
							? [{ voucher: numericTerm }]
							: []),
					],
				},
			]
		}

		const [receptions, total] = await Promise.all([
			prisma.agencyTransfer.findMany({
				where,
				include: {
					agency: {
						select: {
							id: true,
							name: true,
						},
					},
					priceDetails: true,
					passengers: true,
					payments: true,
					createdByUser: true,
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
									transferService: {
										select: {
											id: true,
											name: true,
										},
									},
								},
							},
						},
					},
				},
				orderBy: (() => {
					const isValidSort =
						sort && (RECEPTION_SORTABLE_FIELDS as readonly string[]).includes(sort.field)
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
			data: receptions as unknown as ReceptionWithDetails[],
			total,
			page,
			pageSize,
		}
	} catch (error) {
		console.error("Error fetching receptions:", error)
		throw new Error("Error al obtener las recepciones")
	}
}

export async function getReceptionById(id: string): Promise<ReceptionWithDetails | null> {
	try {
		await getAuthUser()

		const reception = await prisma.agencyTransfer.findUnique({
			where: {
				id,
			},
			include: {
				agency: {
					select: {
						id: true,
						name: true,
					},
				},
				priceDetails: true,
				passengers: {
					include: {
						hotels: true,
					},
				},
				payments: true,
				eventBookings: {
					include: {
						event: {
							include: {
								tour: {
									select: {
										id: true,
										name: true,
										generalSummaryEs: true,
										generalSummaryEn: true,
										generalSummaryPt: true,
										scheduleEs: true,
										scheduleEn: true,
										schedulePt: true,
										includesEs: true,
										includesEn: true,
										includesPt: true,
										pickupEs: true,
										pickupEn: true,
										pickupPt: true,
										whatToBringEs: true,
										whatToBringEn: true,
										whatToBringPt: true,
										altitudeEs: true,
										altitudeEn: true,
										altitudePt: true,
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
					},
				},
			},
		})

		if (!reception || reception.type !== "INCOMING") return null
		return reception as unknown as ReceptionWithDetails
	} catch (error) {
		console.error("Error fetching reception:", error)
		throw new Error("Error al obtener la recepción")
	}
}

interface PriceDetail {
	passengerName: string
	ageCategory: string
	tourPrice: number
	entrancePrice: number
	totalPrice: number
	eventBookingId: string
}

function buildPriceDetailsForEvent(
	eventDetail: ReceptionFormData["eventDetails"][number],
	eventBookingId: string,
): PriceDetail[] {
	const details: PriceDetail[] = []
	const { priceEntries, entrySnapshots } = eventDetail

	// Pre-group entrance fees by category for O(n+m) instead of O(n*m)
	const entranceByCat = new Map<string, number>()
	for (const snap of entrySnapshots) {
		if ((snap.count || 0) === 0) continue
		const current = entranceByCat.get(snap.categoryName) ?? 0
		entranceByCat.set(snap.categoryName, current + (snap.count || 0) * (snap.price || 0))
	}

	for (const pe of priceEntries) {
		if ((pe.count || 0) === 0) continue
		const tourRevenue = (pe.count || 0) * (pe.reception || 0)
		const categoryEntradas = entranceByCat.get(pe.categoryName) ?? 0

		details.push({
			passengerName: `${pe.categoryName} (${pe.count})`,
			ageCategory: pe.categoryName,
			tourPrice: tourRevenue,
			entrancePrice: categoryEntradas,
			totalPrice: tourRevenue + categoryEntradas,
			eventBookingId,
		})
	}

	return details
}

function buildEmptyPlaceholderPriceDetail(
	passengerCount: number,
	eventBookingId: string,
): PriceDetail {
	return {
		passengerName: `Pasajeros (${passengerCount})`,
		ageCategory: "General",
		tourPrice: 0,
		entrancePrice: 0,
		totalPrice: 0,
		eventBookingId,
	}
}

function buildEventCreatePayload(
	event: ReceptionFormData["eventDetails"][number],
	isTransferService: boolean,
): Prisma.EventCreateWithoutTransfersInput {
	return {
		// Normalize client-supplied Date (local midnight) to UTC midnight for @db.Date field.
		date: parseCalendarDay(formatCalendarDay(event.date, "yyyy-MM-dd")),
		serviceKind: isTransferService ? EVENT_SERVICE_KIND.TRANSFER : EVENT_SERVICE_KIND.TOUR,
		...(isTransferService
			? { transferService: { connect: { id: event.tourId } } }
			: { tour: { connect: { id: event.tourId } } }),
		mode: event.mode,
		startTime: event.startTime,
		endTime: event.endTime,
		comments: event.comments,
		...(event.flyTime && {
			flyTime: event.flyTime,
			flyDate: event.flyDate,
			flyName: event.flyName,
		}),
	}
}

function buildPassengerPayload(passengers: ReceptionFormData["passengers"]) {
	return passengers.map((passenger) => ({
		name: passenger.name || null,
		document: passenger.rut || null,
		age: passenger.age ? Number(passenger.age) : null,
		nationality: passenger.nacionality || null,
		diet: passenger.diet_type || null,
		dietOther: passenger.dietOther || null,
		phone: passenger.phone || null,
		email: passenger.email || null,
		allergies: passenger.allergies ?? [],
		hotels: {
			create: (passenger.hotels ?? [])
				.filter((h) => h.hotelName?.trim())
				.map((h, i) => ({
					hotelName: h.hotelName!.trim(),
					checkIn: h.checkIn ? parseCalendarDay(formatCalendarDay(h.checkIn, "yyyy-MM-dd")) : null,
					checkOut: h.checkOut ? parseCalendarDay(formatCalendarDay(h.checkOut, "yyyy-MM-dd")) : null,
					order: i,
				})),
		},
	}))
}

export async function createReception(data: ReceptionFormData) {
	try {
		const user = await getAuthUser()

		await requireReceptionInteraction()

		if (!data.agencyId) {
			throw new Error("Debe seleccionar una agencia")
		}

		// Determine which tourIds are TransferServices vs Tours
		const tourIds = data.eventDetails.map((e) => e.tourId).filter(Boolean)
		const transferServices = await prisma.transferService.findMany({
			where: { id: { in: tourIds } },
			select: { id: true },
		})
		const transferServiceIds = new Set(transferServices.map((service) => service.id))

		const [voucher, agency] = await Promise.all([
			generateAgencyTransferVoucherNumber(),
			prisma.transferAgency.findUnique({
				where: { id: data.agencyId },
				select: { name: true },
			}),
		])

		const reception = await prisma.$transaction(async (tx) => {
			// Step 1: AgencyTransfer shell — passengers + payments only. NO priceDetails, NO eventBookings.
			const transfer = await tx.agencyTransfer.create({
				data: {
					voucher,
					type: "INCOMING",
					date: new Date(),
					paymentStatus: data.paymentStatus,
					comments: data.comments || null,
					agencyId: data.agencyId,
					createdBy: user.id,
					passengers: {
						create: buildPassengerPayload(data.passengers),
					},
					...(data.payments &&
						data.payments.length > 0 && {
							payments: {
								create: data.payments.map((payment) => ({
									refund: payment.refund || false,
									method: payment.method,
									amount: Number(payment.amount),
									date: payment.date,
									documentNumber: payment.documentNumber || null,
									comments: payment.comments || null,
									voucherUrl: null,
									isTransferPayment: true,
								})),
							},
						}),
				},
			})

			// Step 2: create eventBookings sequentially to capture IDs paired with eventDetails index.
			const bookingIds: string[] = []
			for (const event of data.eventDetails) {
				const isTransferService = transferServiceIds.has(event.tourId)
				const booking = await tx.transferEventBooking.create({
					data: {
						transfer: { connect: { id: transfer.id } },
						passengerCount: data.passengers.length,
						event: {
							create: buildEventCreatePayload(event, isTransferService),
						},
					},
					select: { id: true },
				})
				bookingIds.push(booking.id)
			}

			// Step 3: build priceDetails with resolved eventBookingId and insert in one batch.
			const priceDetailRows: PriceDetail[] = []
			for (const [i, eventDetail] of data.eventDetails.entries()) {
				priceDetailRows.push(...buildPriceDetailsForEvent(eventDetail, bookingIds[i]))
			}

			// Edge case: no price rows but passengers exist — attach a zero placeholder to first booking.
			if (priceDetailRows.length === 0 && data.passengers.length > 0 && bookingIds.length > 0) {
				priceDetailRows.push(buildEmptyPlaceholderPriceDetail(data.passengers.length, bookingIds[0]))
			}

			if (priceDetailRows.length > 0) {
				await tx.transferPriceDetail.createMany({
					data: priceDetailRows.map((row) => ({ ...row, transferId: transfer.id })),
				})
			}

			return transfer
		})

		// Registrar pagos en el flujo de caja (INCOMING = egreso, pagamos a la agencia)
		if (data.payments && data.payments.length > 0) {
			const cashFlowPromises = data.payments
				.filter((p) => !p.refund && Number(p.amount) > 0)
				.map((payment) =>
					registerCashFlowFromTransfer({
						transferId: reception.id,
						transferVoucher: voucher,
						amount: Number(payment.amount),
						paymentMethod: payment.method as
							| "CASH"
							| "TRANSFER"
							| "CREDIT_CARD"
							| "DEBIT_CARD"
							| "PAYMENT_LINK_DEBIT"
							| "PAYMENT_LINK_CREDIT",
						transferType: "INCOMING",
						agencyName: agency?.name || "Agencia",
						userId: user.id,
					}).catch((err) =>
						console.error("Error registering reception payment in cash flow:", err)
					)
				)
			await Promise.all(cashFlowPromises)
		}

		await notifyReceptionByEmail(reception.id)

		return { success: true, data: reception }
	} catch (error) {
		console.error("Error creating reception:", error)
		if (error instanceof Error) {
			return { success: false, error: error.message }
		}
		return { success: false, error: "Error al crear la recepción" }
	}
}

export async function updateReception(id: string, data: ReceptionFormData) {
	try {
		const user = await getAuthUser()

		await requireReceptionInteraction()

		// Fetch full current reception for guards and audit snapshot
		const current = await prisma.agencyTransfer.findUnique({
			where: { id },
			include: {
				agency: { select: { name: true } },
				priceDetails: true,
				passengers: { include: { hotels: true } },
				eventBookings: { include: { event: true } },
				payments: true,
			},
		})

		if (!current) return { success: false, error: "Recepción no encontrada" }
		if (current.status === "CANCELLED")
			return { success: false, error: "No se puede editar una recepción cancelada" }
		if (current.type !== "INCOMING") return { success: false, error: "No es una recepción" }

		// Snapshot for audit
		const oldData = {
			agencyId: current.agencyId,
			paymentStatus: current.paymentStatus,
			comments: current.comments,
			passengerCount: current.passengers.length,
			totalAmount: current.priceDetails.reduce((s, p) => s + p.totalPrice, 0),
		}

		// Determine which new tourIds are TransferServices vs Tours
		const tourIds = data.eventDetails.map((e) => e.tourId).filter(Boolean)
		const transferServices = await prisma.transferService.findMany({
			where: { id: { in: tourIds } },
			select: { id: true },
		})
		const transferServiceIds = new Set(transferServices.map((s) => s.id))

		const agencyName =
			data.agencyId === current.agencyId
				? current.agency.name
				: ((await prisma.transferAgency.findUnique({
						where: { id: data.agencyId },
						select: { name: true },
					}))?.name ?? "Agencia")

		await prisma.$transaction(async (tx) => {
			// Step 0: Delete old children in FK-safe order
			await tx.transferPriceDetail.deleteMany({ where: { transferId: id } })
			await tx.passengerHotel.deleteMany({ where: { passenger: { transferId: id } } })
			await tx.paymentRecord.deleteMany({ where: { transferId: id } })
			await tx.passenger.deleteMany({ where: { transferId: id } })

			// Delete old eventBookings and their owned Event records
			const oldBookings = await tx.transferEventBooking.findMany({
				where: { transferId: id },
				select: { eventId: true },
			})
			await tx.transferEventBooking.deleteMany({ where: { transferId: id } })
			if (oldBookings.length > 0) {
				const oldEventIds = oldBookings.map((b) => b.eventId)
				// Receptions OWN their events — safe to delete as they are not shared with sales
				await tx.event.deleteMany({
					where: {
						id: { in: oldEventIds },
						bookings: { none: {} },
					},
				})
			}

			// Reverse old SUPPLIER_PAYMENT cash entries (INCOMING = negative amount)
			const oldCashEntries = await tx.cashBoxEntry.findMany({
				where: { transferId: id, type: "SUPPLIER_PAYMENT" },
			})
			if (oldCashEntries.length > 0) {
				await tx.cashBoxEntry.createMany({
					data: oldCashEntries.map((entry) => ({
						type: entry.type,
						amount: -entry.amount,
						currency: entry.currency,
						originalAmount: entry.originalAmount ? -entry.originalAmount : null,
						description: `[REVERSAL] ${entry.description}`,
						reference: entry.reference,
						transferId: entry.transferId,
						paymentMethod: entry.paymentMethod,
						cashBoxId: entry.cashBoxId,
						createdById: user.id,
					})),
				})
			}

			// Step 1: Update AgencyTransfer scalars + recreate passengers + payments only.
			// NO priceDetails, NO eventBookings nested here.
			await tx.agencyTransfer.update({
				where: { id },
				data: {
					agencyId: data.agencyId,
					date: data.date,
					paymentStatus: data.paymentStatus,
					comments: data.comments || null,
					passengers: {
						create: buildPassengerPayload(data.passengers),
					},
					...(data.payments &&
						data.payments.length > 0 && {
							payments: {
								create: data.payments.map((payment) => ({
									refund: payment.refund || false,
									method: payment.method,
									amount: Number(payment.amount),
									date: payment.date,
									documentNumber: payment.documentNumber || null,
									comments: payment.comments || null,
									voucherUrl: null,
									isTransferPayment: true,
								})),
							},
						}),
				},
			})

			// Step 2: create new eventBookings sequentially, capture IDs paired with eventDetails index.
			const bookingIds: string[] = []
			for (const event of data.eventDetails) {
				const isTransferService = transferServiceIds.has(event.tourId)
				const booking = await tx.transferEventBooking.create({
					data: {
						transfer: { connect: { id } },
						passengerCount: data.passengers.length,
						event: {
							create: buildEventCreatePayload(event, isTransferService),
						},
					},
					select: { id: true },
				})
				bookingIds.push(booking.id)
			}

			// Step 3: build priceDetails with resolved eventBookingId and insert in one batch.
			const priceDetailRows: PriceDetail[] = []
			for (const [i, eventDetail] of data.eventDetails.entries()) {
				priceDetailRows.push(...buildPriceDetailsForEvent(eventDetail, bookingIds[i]))
			}

			// Edge case: no price rows but passengers exist — attach a zero placeholder to first booking.
			if (priceDetailRows.length === 0 && data.passengers.length > 0 && bookingIds.length > 0) {
				priceDetailRows.push(buildEmptyPlaceholderPriceDetail(data.passengers.length, bookingIds[0]))
			}

			if (priceDetailRows.length > 0) {
				await tx.transferPriceDetail.createMany({
					data: priceDetailRows.map((row) => ({ ...row, transferId: id })),
				})
			}
		})

		// 5. Register new payments in cash flow (OUTSIDE transaction — creates/finds CashBox)
		if (data.payments && data.payments.length > 0) {
			const cashFlowPromises = data.payments
				.filter((p) => !p.refund && Number(p.amount) > 0)
				.map((payment) =>
					registerCashFlowFromTransfer({
						transferId: id,
						transferVoucher: current.voucher,
						amount: Number(payment.amount),
						paymentMethod: payment.method as
							| "CASH"
							| "TRANSFER"
							| "CREDIT_CARD"
							| "DEBIT_CARD"
							| "PAYMENT_LINK_DEBIT"
							| "PAYMENT_LINK_CREDIT",
						transferType: "INCOMING",
						agencyName: agencyName,
						userId: user.id,
					}).catch((err) =>
						console.error("Error registering updated reception payment in cash flow:", err)
					)
				)
			await Promise.all(cashFlowPromises)
		}

		// 6. Audit
		const auditTotalAmount = data.eventDetails
			.flatMap((eventDetail) => buildPriceDetailsForEvent(eventDetail, "audit"))
			.reduce((s, p) => s + p.totalPrice, 0)
		const newData = {
			agencyId: data.agencyId,
			paymentStatus: data.paymentStatus,
			comments: data.comments || null,
			passengerCount: data.passengers.length,
			totalAmount: auditTotalAmount,
		}
		await AuditService.logUpdate("AgencyTransfer", id, user, oldData, newData)

		revalidatePath("/dashboard/navegacion-recepciones")

		return { success: true }
	} catch (error) {
		console.error("Error updating reception:", error)
		if (error instanceof Error) {
			return { success: false, error: error.message }
		}
		return { success: false, error: "Error al actualizar la recepción" }
	}
}

/**
 * Solicita autorización para eliminar una recepción.
 * El executor ejecuta el hard delete al aprobarse.
 */
export async function deleteReception(id: string, reason: string) {
	try {
		await getAuthUser()

		await requireReceptionInteraction()

		if (!reason.trim()) {
			return { success: false, error: "Debe indicar el motivo" }
		}

		const reception = await prisma.agencyTransfer.findUnique({
			where: { id },
			select: { type: true, voucher: true, status: true, updatedAt: true },
		})

		if (!reception || reception.type !== "INCOMING") {
			return { success: false, error: "Recepción no encontrada" }
		}

		const fingerprint = computeFingerprint(reception)
		const snapshot = buildSnapshot("receptions", {
			id,
			status: reception.status,
			voucher: reception.voucher,
		})

		const result = await requestApproval({
			action: APPROVAL_ACTION.DELETE_RECEPTION,
			targetType: "agency-transfer",
			targetId: id,
			payload: { reason: reason.trim() },
			reason: reason.trim(),
			targetFingerprint: fingerprint,
			snapshot,
			source: { path: "/dashboard/recepciones", ui: "delete-reception" },
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
		console.error("Error requesting reception deletion:", error)
		return { success: false, error: "Error al solicitar la eliminación de la recepción" }
	}
}

/**
 * Solicita autorización para cancelar una recepción.
 * El executor cancela y revierte entradas de caja al aprobarse.
 */
export async function cancelReception(id: string, reason?: string) {
	try {
		await getAuthUser()

		await requireReceptionInteraction()

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

		if (!transfer) return { success: false, error: "Recepción no encontrada" }
		if (transfer.status === "CANCELLED") return { success: false, error: "La recepción ya está cancelada" }
		if (transfer.type !== "INCOMING") return { success: false, error: "Solo se pueden cancelar recepciones de tipo entrada" }

		const fingerprint = computeFingerprint(transfer)
		const snapshot = buildSnapshot("receptions", {
			id: transfer.id,
			status: transfer.status,
			voucher: transfer.voucher,
		})

		const result = await requestApproval({
			action: APPROVAL_ACTION.CANCEL_RECEPTION,
			targetType: "agency-transfer",
			targetId: id,
			payload: { reason: reason?.trim() ?? "" },
			reason: reason?.trim() ?? "Cancelación solicitada",
			targetFingerprint: fingerprint,
			snapshot,
			source: { path: "/dashboard/recepciones", ui: "cancel-transfer-dialog" },
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
		console.error("Error requesting reception cancellation:", error)
		return {
			success: false,
			error: error instanceof Error ? error.message : "Error al cancelar la recepción",
		}
	}
}
