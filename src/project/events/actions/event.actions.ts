"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { format } from "date-fns"

import { formatCalendarDay, parseCalendarDay, todayInSantiago } from "@/shared/utils/calendar-day"

import {
	UpdateEventSchema,
	updateEventSchema,
	BulkAssignSchema,
	bulkAssignSchema,
} from "../schemas/update-event.schema"
import { rescheduleEventSchema } from "../schemas/reschedule-event.schema"
import type {
	PassengerConflict,
	ProviderConflictSummary,
	RescheduleEventResult,
} from "../schemas/reschedule-event.schema"
import { timeRangesOverlap } from "../utils/time-overlap"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { canCurrentUserInteractPath } from "@/project/roles/actions/role.actions"
import { requestApproval } from "@/project/approvals/actions/approval.actions"
import { computeFingerprint } from "@/project/approvals/utils/fingerprint"
import { buildSnapshot } from "@/project/approvals/utils/snapshot"
import { APPROVAL_ACTION } from "@/generated/prisma/enums"

import type { Prisma } from "@/generated/prisma/client"
import {
	applyFirstEventDate,
	applyFirstEventDateForSales,
} from "@/project/sales/server/first-event-date"

interface ProviderChange {
	field: "guideId" | "driverId" | "vehicleId"
	oldValue: string | null
	newValue: string | null
	oldName: string | null
	newName: string | null
	role: "Guía" | "Conductor" | "Vehículo"
}

async function writeProviderAuditLogs(
	eventId: string,
	changes: ProviderChange[],
	user: { id: string; name: string; email: string }
): Promise<void> {
	if (changes.length === 0) return

	await prisma.auditLog.createMany({
		data: changes.map((change) => {
			const oldLabel = change.oldName || "sin asignar"
			const newLabel = change.newName || "sin asignar"
			return {
				action: "UPDATE",
				entityType: "Event",
				entityId: eventId,
				userId: user.id,
				userName: user.name,
				userEmail: user.email,
				oldValues: { [change.field]: change.oldValue } as Prisma.InputJsonValue,
				newValues: { [change.field]: change.newValue } as Prisma.InputJsonValue,
				description: `Asignación de ${change.role}: ${oldLabel} → ${newLabel}`,
			}
		}),
	})
}

function getProviderDisplayName(
	provider: {
		fullName?: string | null
		companyName?: string | null
		vehicleBrand?: string | null
		vehicleModel?: string | null
		vehiclePlate?: string | null
	} | null,
	field: "guideId" | "driverId" | "vehicleId"
): string | null {
	if (!provider) return null
	if (field === "vehicleId") {
		return (
			[
				provider.vehicleBrand,
				provider.vehicleModel,
				provider.vehiclePlate ? `(${provider.vehiclePlate})` : null,
			]
				.filter(Boolean)
				.join(" ") ||
			provider.companyName ||
			null
		)
	}
	return provider.fullName || provider.companyName || null
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

export async function getEvents(startDate?: Date, endDate?: Date) {
	try {
		await getAuthUser()

		const where: Prisma.EventWhereInput = {
			status: {
				not: "CANCELLED",
			},
			bookings: {
				some: {
					saleRecord: {
						type: "SALE",
					},
				},
			},
		}

		if (startDate && endDate) {
			where.date = {
				gte: startDate,
				lte: endDate,
			}
		}

		const events = await prisma.event.findMany({
			where,
			include: {
				transferService: {
					select: {
						id: true,
						name: true,
					},
				},
				tour: {
					select: {
						name: true,
					},
				},
				bookings: {
					select: {
						id: true,
						saleRecordId: true,
						passengerCount: true,
						saleRecord: {
							select: {
								customerVoucherEmailSentAt: true,
								voucher: true,
								seller: { select: { name: true } },
								wholesaleAgency: { select: { name: true } },
								passengers: {
									select: {
										id: true,
										name: true,
										document: true,
										nationality: true,
										phone: true,
										age: true,
										diet: true,
										dietOther: true,
										allergies: true,
										hotels: {
											orderBy: { order: "asc" },
										},
									},
								},
							},
						},
						bookingPassengers: {
							select: {
								id: true,
								passengerId: true,
								excluded: true,
								excludeReason: true,
								passenger: {
									select: {
										id: true,
										name: true,
										document: true,
										nationality: true,
										phone: true,
										age: true,
										diet: true,
										dietOther: true,
										allergies: true,
										hotels: {
											orderBy: { order: "asc" },
										},
									},
								},
							},
						},
					},
				},
				guide: { select: { fullName: true } },
				driver: { select: { fullName: true } },
				vehicle: { select: { vehicleBrand: true, vehicleModel: true, vehiclePlate: true } },
				cateringProvider: { select: { companyName: true, fullName: true } },
				_count: {
					select: {
						bookings: true,
						transfers: true,
					},
				},
			},
			orderBy: {
				date: "asc",
			},
		})

		const eventIds = events.map((event) => event.id)
		const transferDetailsByEvent =
			eventIds.length > 0
				? await prisma.transferEventBooking.findMany({
						where: {
							eventId: { in: eventIds },
							transfer: {
								type: "OUTGOING",
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

		const transferredIdsByEvent = new Map<string, Set<string>>()
		const transferredNamesByEvent = new Map<string, Set<string>>()

		for (const transferBooking of transferDetailsByEvent) {
			if (!transferredIdsByEvent.has(transferBooking.eventId)) {
				transferredIdsByEvent.set(transferBooking.eventId, new Set<string>())
			}
			if (!transferredNamesByEvent.has(transferBooking.eventId)) {
				transferredNamesByEvent.set(transferBooking.eventId, new Set<string>())
			}

			const idsSet = transferredIdsByEvent.get(transferBooking.eventId)!
			const namesSet = transferredNamesByEvent.get(transferBooking.eventId)!

			for (const priceDetail of transferBooking.transfer.priceDetails) {
				if (priceDetail.sourcePassengerId) {
					idsSet.add(priceDetail.sourcePassengerId)
				}
				const normalizedName = priceDetail.passengerName?.trim().toLowerCase()
				if (!priceDetail.sourcePassengerId && normalizedName) {
					namesSet.add(normalizedName)
				}
			}
		}

		const mappedEvents = events
			.map((event) => {
				const normalizedTour =
					event.tour ||
					(event.transferService
						? {
								name: event.transferService.name,
							}
						: null)

				if (!normalizedTour) return null

				const transferredIds = transferredIdsByEvent.get(event.id) || new Set<string>()
				const transferredNames = transferredNamesByEvent.get(event.id) || new Set<string>()

				const activeBookings = event.bookings
					.map((booking) => {
						// Build set of excluded passenger IDs from bookingPassengers
						const excludedPassengerIds = new Set(
							booking.bookingPassengers?.filter((bp) => bp.excluded).map((bp) => bp.passengerId) ??
								[]
						)

						const sourcePassengers = booking.saleRecord?.passengers || []
						const remainingPassengers = sourcePassengers.filter((passenger) => {
							if (excludedPassengerIds.has(passenger.id)) return false
							const normalizedName = passenger.name?.trim().toLowerCase()
							const transferredByName = normalizedName
								? transferredNames.has(normalizedName)
								: false
							return !transferredIds.has(passenger.id) && !transferredByName
						})

						const remainingPassengerCount = Math.min(
							booking.passengerCount,
							remainingPassengers.length
						)

						if (remainingPassengerCount <= 0) return null

						return {
							...booking,
							passengerCount: remainingPassengerCount,
							saleRecord: booking.saleRecord
								? {
										...booking.saleRecord,
										passengers: remainingPassengers,
									}
								: booking.saleRecord,
						}
					})
					.filter((booking): booking is NonNullable<typeof booking> => Boolean(booking))

				if (activeBookings.length === 0) return null

				return {
					...event,
					tour: normalizedTour,
					bookings: activeBookings,
					currentBookings: activeBookings.reduce((sum, booking) => sum + booking.passengerCount, 0),
				}
			})
			.filter((event): event is NonNullable<typeof event> => Boolean(event))

		return mappedEvents
	} catch (error) {
		console.error("Error fetching events:", error)
		throw new Error("Error al obtener los eventos")
	}
}

export async function getEventById(id: string) {
	try {
		await getAuthUser()

		const event = await prisma.event.findUnique({
			where: { id },
			include: {
				transferService: true,
				tour: true,
				guide: true,
				driver: true,
				vehicle: true,
				cancelledBy: {
					select: {
						id: true,
						name: true,
						email: true,
					},
				},
				cateringProvider: true,
				bookings: {
					include: {
						saleRecord: {
							select: {
								id: true,
								voucher: true,
								type: true,
								channel: true,
								fileNumber: true,
								discount: true,
								isWholesale: true,
								wholesalePaymentTerm: true,
								wholesaleMarkup: true,
								clientEmail: true,
								contacted: true, // NOTE: Run migration to add this field
								seller: { select: { id: true, name: true } },
								agency: { select: { id: true, name: true } },
								wholesaleAgency: { select: { id: true, name: true } },
								passengers: { include: { hotels: { orderBy: { order: "asc" } } } },
							},
						},
						bookingPassengers: {
							include: {
								passenger: {
									include: {
										hotels: { orderBy: { order: "asc" } },
									},
								},
							},
						},
						priceEntries: {
							select: {
								count: true,
								priceSnapshot: true,
								receptionSnapshot: true,
							},
						},
						entrySnapshots: {
							select: {
								count: true,
								priceSnapshot: true,
							},
						},
					},
				},
				transfers: {
					include: {
						transfer: {
							include: {
								agency: true,
								passengers: true,
							},
						},
					},
				},
			},
		})

		if (!event) return null

		const normalizedTour =
			event.tour ||
			(event.transferService
				? {
						id: event.transferService.id,
						name: event.transferService.name,
					}
				: null)

		return {
			...event,
			tour: normalizedTour,
		}
	} catch (error) {
		console.error("Error fetching event:", error)
		throw new Error("Error al obtener el evento")
	}
}

export async function updateEvent(id: string, data: UpdateEventSchema) {
	try {
		const user = await getAuthUser()
		const canInteract = await canCurrentUserInteractPath("/dashboard/calendario")
		if (!canInteract) {
			return { success: false, error: "No autorizado para interactuar con calendario" }
		}

		const validatedData = updateEventSchema.parse(data)

		// Defense in depth: updateEvent must never cancel an event.
		// The canonical path is cancelEventWithApproval.
		if ((validatedData.status as string) === "CANCELLED") {
			return {
				success: false,
				error: "Para cancelar un evento usá la acción de cancelación con aprobación",
			}
		}

		// Fetch current provider values BEFORE the update (for audit log)
		const eventToUpdate = await prisma.event.findUnique({
			where: { id },
			select: {
				serviceKind: true,
				guideId: true,
				driverId: true,
				vehicleId: true,
				guide: { select: { fullName: true, companyName: true } },
				driver: { select: { fullName: true, companyName: true } },
				vehicle: {
					select: { vehicleBrand: true, vehicleModel: true, vehiclePlate: true, companyName: true },
				},
			},
		})

		if (!eventToUpdate) {
			return { success: false, error: "Evento no encontrado" }
		}

		const isTransferEvent = eventToUpdate.serviceKind === "TRANSFER"

		const newGuideId = isTransferEvent ? null : validatedData.guideId || null
		const newDriverId = validatedData.driverId || null
		const newVehicleId = validatedData.vehicleId || null

		const event = await prisma.event.update({
			where: { id },
			data: {
				status: validatedData.isCompleted ? "CONFIRMED" : validatedData.status,
				startTime: validatedData.startTime,
				endTime: validatedData.endTime,
				guideId: newGuideId,
				driverId: newDriverId,
				vehicleId: newVehicleId,
				cateringProviderId: isTransferEvent ? null : validatedData.cateringProviderId || null,
				comments: validatedData.comments,
				operationalNotes: validatedData.operationalNotes,
				cateringNotes: isTransferEvent ? "" : validatedData.cateringNotes,
				guideCost: isTransferEvent ? 0 : validatedData.guideCost,
				driverCost: validatedData.driverCost,
				vehicleCost: validatedData.vehicleCost,
				cateringCost: isTransferEvent ? 0 : validatedData.cateringCost,
				cateringSelection: isTransferEvent ? [] : validatedData.cateringSelection,
			},
		})

		// Build provider change diffs for audit log
		const providerFields = [
			{
				field: "guideId" as const,
				role: "Guía" as const,
				oldId: eventToUpdate.guideId,
				newId: newGuideId,
				oldProvider: eventToUpdate.guide,
				newProvider: null as typeof eventToUpdate.guide,
			},
			{
				field: "driverId" as const,
				role: "Conductor" as const,
				oldId: eventToUpdate.driverId,
				newId: newDriverId,
				oldProvider: eventToUpdate.driver,
				newProvider: null as typeof eventToUpdate.driver,
			},
			{
				field: "vehicleId" as const,
				role: "Vehículo" as const,
				oldId: eventToUpdate.vehicleId,
				newId: newVehicleId,
				oldProvider: eventToUpdate.vehicle,
				newProvider: null as typeof eventToUpdate.vehicle,
			},
		]

		// Batch-resolve new provider names (avoid N+1)
		const changedFields = providerFields.filter((pf) => pf.oldId !== pf.newId)
		const newProviderIds = changedFields.map((pf) => pf.newId).filter((id): id is string => !!id)

		const newProviders =
			newProviderIds.length > 0
				? await prisma.provider.findMany({
						where: { id: { in: newProviderIds } },
						select: {
							id: true,
							fullName: true,
							companyName: true,
							vehicleBrand: true,
							vehicleModel: true,
							vehiclePlate: true,
						},
					})
				: []
		const newProviderMap = new Map(newProviders.map((p) => [p.id, p]))

		const changes: ProviderChange[] = changedFields.map((pf) => ({
			field: pf.field,
			oldValue: pf.oldId,
			newValue: pf.newId,
			oldName: getProviderDisplayName(
				pf.oldProvider as Parameters<typeof getProviderDisplayName>[0],
				pf.field
			),
			newName: pf.newId
				? getProviderDisplayName(newProviderMap.get(pf.newId) ?? null, pf.field)
				: null,
			role: pf.role,
		}))

		if (changes.length > 0) {
			await writeProviderAuditLogs(id, changes, {
				id: user.id,
				name: user.name ?? "Usuario desconocido",
				email: user.email ?? "",
			})
		}

		revalidatePath("/dashboard/calendario")

		return { success: true, data: event }
	} catch (error) {
		console.error("Error updating event:", error)
		if (error instanceof Error) {
			return { success: false, error: error.message }
		}
		return { success: false, error: "Error al actualizar el evento" }
	}
}

/**
 * Solicita autorización para anular un evento.
 * Usa el nuevo flujo asincrónico: crea ApprovalRequest y notifica al admin.
 * El executor (cancel-event.executor.ts) ejecuta la cancelación al aprobarse.
 *
 * El bypass de admin fue eliminado — admins también crean solicitud
 * y pueden auto-aprobar desde el RequestApprovalDialog.
 */
export async function cancelEventWithApproval(params: {
	eventId: string
	reason: string
}) {
	try {
		const user = await getAuthUser()
		const canInteract = await canCurrentUserInteractPath("/dashboard/calendario")
		if (!canInteract) {
			return { success: false, error: "No autorizado para interactuar con calendario" }
		}

		if (!params.reason.trim()) {
			return { success: false, error: "Debe indicar el motivo de anulación" }
		}

		// Fetch current state for fingerprint + snapshot
		const event = await prisma.event.findUnique({
			where: { id: params.eventId },
			select: {
				id: true,
				status: true,
				updatedAt: true,
				date: true,
				startTime: true,
			},
		})

		if (!event) {
			return { success: false, error: "Evento no encontrado" }
		}

		if (event.status === "CANCELLED") {
			return { success: false, error: "El evento ya está anulado" }
		}

		const fingerprint = computeFingerprint(event)
		const snapshot = buildSnapshot("events", {
			id: event.id,
			status: event.status,
			date: event.date,
			startTime: event.startTime,
		})

		const result = await requestApproval({
			action: APPROVAL_ACTION.CANCEL_EVENT,
			targetType: "event",
			targetId: params.eventId,
			payload: { reason: params.reason.trim() },
			reason: params.reason.trim(),
			targetFingerprint: fingerprint,
			snapshot,
			source: { path: "/dashboard/calendario", ui: "event-detail-panel" },
		})

		if ("error" in result) {
			return { success: false, error: result.message }
		}

		// Domain gated — approval pending (or executed directly if flag was OFF)
		return {
			success: true,
			approvalRequired: result.approvalRequired,
			requestId: result.approvalRequired ? result.requestId : undefined,
		}
	} catch (error) {
		console.error("Error cancelling event:", error)
		if (error instanceof Error) {
			return { success: false, error: error.message }
		}
		return { success: false, error: "Error al anular el evento" }
	}
}

export async function getCancelledEvents(filters?: { startDate?: Date; endDate?: Date }) {
	try {
		await getAuthUser()

		const cancelledEvents = await prisma.event.findMany({
			where: {
				status: "CANCELLED",
				...(filters?.startDate && filters?.endDate
					? {
							cancelledAt: {
								gte: filters.startDate,
								lte: filters.endDate,
							},
						}
					: {}),
			},
			include: {
				transferService: {
					select: {
						id: true,
						name: true,
					},
				},
				tour: {
					select: {
						name: true,
					},
				},
				cancelledBy: {
					select: {
						name: true,
						email: true,
					},
				},
				bookings: {
					select: {
						id: true,
						passengerCount: true,
						saleRecord: {
							select: {
								voucher: true,
							},
						},
					},
				},
			},
			orderBy: {
				cancelledAt: "desc",
			},
		})

		return cancelledEvents.map((event) => ({
			...event,
			tour: event.tour || (event.transferService ? { name: event.transferService.name } : null),
		}))
	} catch (error) {
		console.error("Error fetching cancelled events:", error)
		throw new Error("Error al obtener eventos anulados")
	}
}

export async function checkProviderAvailability(
	providerId: string,
	date: Date,
	startTime: string,
	endTime: string,
	excludeEventId?: string
) {
	try {
		await getAuthUser()

		// event.date is @db.Date — use exact calendar-day equality, not a range.
		// parseCalendarDay normalizes the incoming Date to UTC midnight for Prisma.
		const dayKey = formatCalendarDay(date, "yyyy-MM-dd")
		const calendarDay = parseCalendarDay(dayKey)

		// Find events for this provider on the same day
		const conflictingEvents = await prisma.event.findMany({
			where: {
				date: calendarDay,
				id: { not: excludeEventId },
				status: { not: "CANCELLED" },
				OR: [
					{ guideId: providerId },
					{ driverId: providerId },
					{ vehicleId: providerId },
					{ cateringProviderId: providerId },
				],
			},
			select: {
				id: true,
				startTime: true,
				endTime: true,
				tour: { select: { name: true } },
				transferService: { select: { id: true, name: true } },
			},
		})

		// Simple overlap check
		// Assuming startTime and endTime are "HH:mm" strings
		const isOverlapping = conflictingEvents.some((event) => {
			if (!event.startTime || !event.endTime || !startTime || !endTime) return true // Conservative: clash if no times
			return (
				(startTime >= event.startTime && startTime < event.endTime) ||
				(endTime > event.startTime && endTime <= event.endTime) ||
				(startTime <= event.startTime && endTime >= event.endTime)
			)
		})

		return { success: true, isAvailable: !isOverlapping, conflicts: conflictingEvents }
	} catch (error) {
		console.error("Error checking availability:", error)
		return { success: false, error: "Error al verificar disponibilidad" }
	}
}

// ==================== BOOKING REASSIGNMENT ====================

export interface MoveBookingParams {
	bookingId: string
	targetEventId: string
	reason: string
	force?: boolean
}

export interface MoveBookingResult {
	success: boolean
	error?: string
	capacityExceeded?: boolean
	capacityInfo?: {
		targetCurrentBookings: number
		targetMaxCapacity: number
		passengerCount: number
		resultingBookings: number
	}
}

export interface MoveBookingsParams {
	bookingIds: string[]
	targetEventId: string
	reason: string
	force?: boolean
}

export interface MoveBookingsResult {
	success: boolean
	error?: string
	moved: number
	capacityExceeded?: boolean
	capacityInfo?: {
		targetCurrentBookings: number
		targetMaxCapacity: number
		totalPassengerCount: number
		resultingBookings: number
	}
}

export interface EligibleTargetEvent {
	id: string
	date: Date
	startTime: string | null
	endTime: string | null
	maxCapacity: number
	currentBookings: number
	tour: { name: string } | null
	transferService: { id: string; name: string } | null
}

export async function moveBooking(params: MoveBookingParams): Promise<MoveBookingResult> {
	try {
		const user = await getAuthUser()
		const canInteract = await canCurrentUserInteractPath("/dashboard/calendario")
		if (!canInteract) {
			return { success: false, error: "No autorizado para interactuar con calendario" }
		}

		const { bookingId, targetEventId, reason, force } = params

		if (!reason.trim()) {
			return { success: false, error: "Debe indicar el motivo de reasignación" }
		}

		const result = await prisma.$transaction(async (tx) => {
			// Get booking with sale record for voucher info
			const booking = await tx.eventBooking.findUnique({
				where: { id: bookingId },
				include: {
					saleRecord: { select: { voucher: true } },
				},
			})

			if (!booking) {
				return { success: false as const, error: "Reserva no encontrada" }
			}

			if (booking.eventId === targetEventId) {
				return { success: false as const, error: "El evento origen y destino son iguales" }
			}

			// Get target event
			const targetEvent = await tx.event.findUnique({
				where: { id: targetEventId },
				select: {
					id: true,
					maxCapacity: true,
					currentBookings: true,
					status: true,
					date: true,
					tour: { select: { name: true } },
					transferService: { select: { name: true } },
				},
			})

			if (!targetEvent) {
				return { success: false as const, error: "Evento destino no encontrado" }
			}

			if (targetEvent.status === "CANCELLED") {
				return { success: false as const, error: "El evento destino está anulado" }
			}

			// Capacity pre-check
			const resultingBookings = targetEvent.currentBookings + booking.passengerCount
			if (resultingBookings > targetEvent.maxCapacity && !force) {
				return {
					success: false as const,
					capacityExceeded: true,
					capacityInfo: {
						targetCurrentBookings: targetEvent.currentBookings,
						targetMaxCapacity: targetEvent.maxCapacity,
						passengerCount: booking.passengerCount,
						resultingBookings,
					},
				}
			}

			// Get source event for audit log
			const sourceEvent = await tx.event.findUnique({
				where: { id: booking.eventId },
				select: {
					id: true,
					date: true,
					tour: { select: { name: true } },
					transferService: { select: { name: true } },
				},
			})

			const sourceEventName =
				sourceEvent?.tour?.name ?? sourceEvent?.transferService?.name ?? "Evento desconocido"
			const targetEventName =
				targetEvent.tour?.name ?? targetEvent.transferService?.name ?? "Evento desconocido"
			const sourceDateStr = sourceEvent?.date ? formatCalendarDay(sourceEvent.date, "dd/MM") : "?"
			const targetDateStr = formatCalendarDay(targetEvent.date, "dd/MM")
			const voucherLabel = booking.saleRecord?.voucher
				? `V-${booking.saleRecord.voucher}`
				: bookingId

			// Update booking
			await tx.eventBooking.update({
				where: { id: bookingId },
				data: { eventId: targetEventId },
			})

			// Decrement source event
			await tx.event.update({
				where: { id: booking.eventId },
				data: { currentBookings: { decrement: booking.passengerCount } },
			})

			// Increment target event
			await tx.event.update({
				where: { id: targetEventId },
				data: { currentBookings: { increment: booking.passengerCount } },
			})

			// Write audit log entries (source OUT + target IN)
			await tx.auditLog.createMany({
				data: [
					{
						action: "UPDATE",
						entityType: "Event",
						entityId: booking.eventId,
						userId: user.id,
						userName: user.name ?? "Usuario desconocido",
						userEmail: user.email ?? "",
						oldValues: { bookingId, eventId: booking.eventId } as Prisma.InputJsonValue,
						newValues: { bookingId, eventId: targetEventId } as Prisma.InputJsonValue,
						metadata: {
							type: "BOOKING_MOVE",
							direction: "OUT",
							passengerCount: booking.passengerCount,
							forced: !!force,
						} as Prisma.InputJsonValue,
						description: `Reasignación de voucher ${voucherLabel} (${booking.passengerCount} pax) → ${targetEventName} ${targetDateStr}. Motivo: ${reason.trim()}`,
					},
					{
						action: "UPDATE",
						entityType: "Event",
						entityId: targetEventId,
						userId: user.id,
						userName: user.name ?? "Usuario desconocido",
						userEmail: user.email ?? "",
						oldValues: { bookingId, eventId: booking.eventId } as Prisma.InputJsonValue,
						newValues: { bookingId, eventId: targetEventId } as Prisma.InputJsonValue,
						metadata: {
							type: "BOOKING_MOVE",
							direction: "IN",
							passengerCount: booking.passengerCount,
							forced: !!force,
						} as Prisma.InputJsonValue,
						description: `Recepción de voucher ${voucherLabel} (${booking.passengerCount} pax) desde ${sourceEventName} ${sourceDateStr}. Motivo: ${reason.trim()}`,
					},
				],
			})

			await applyFirstEventDate(booking.saleRecordId, tx)

			return { success: true as const }
		})

		return result
	} catch (error) {
		console.error("Error moving booking:", error)
		if (error instanceof Error) {
			return { success: false, error: error.message }
		}
		return { success: false, error: "Error al mover la reserva" }
	}
}

export async function moveBookings(params: MoveBookingsParams): Promise<MoveBookingsResult> {
	try {
		const user = await getAuthUser()
		const canInteract = await canCurrentUserInteractPath("/dashboard/calendario")
		if (!canInteract) {
			return { success: false, moved: 0, error: "No autorizado para interactuar con calendario" }
		}

		const { bookingIds, targetEventId, reason, force } = params

		if (bookingIds.length === 0) {
			return { success: false, moved: 0, error: "No se proporcionaron reservas para mover" }
		}

		if (!reason.trim()) {
			return { success: false, moved: 0, error: "Debe indicar el motivo de reasignación" }
		}

		const result = await prisma.$transaction(async (tx) => {
			// Fetch all bookings with sale record info
			const bookings = await tx.eventBooking.findMany({
				where: { id: { in: bookingIds } },
				include: {
					saleRecord: { select: { voucher: true } },
				},
			})

			if (bookings.length !== bookingIds.length) {
				const foundIds = new Set(bookings.map((b) => b.id))
				const missing = bookingIds.filter((id) => !foundIds.has(id))
				return {
					success: false as const,
					moved: 0,
					error: `Reservas no encontradas: ${missing.join(", ")}`,
				}
			}

			// Validate none of the bookings are already on the target event
			const alreadyOnTarget = bookings.filter((b) => b.eventId === targetEventId)
			if (alreadyOnTarget.length > 0) {
				return {
					success: false as const,
					moved: 0,
					error: "Una o más reservas ya están en el evento destino",
				}
			}

			// Get target event
			const targetEvent = await tx.event.findUnique({
				where: { id: targetEventId },
				select: {
					id: true,
					maxCapacity: true,
					currentBookings: true,
					status: true,
					date: true,
					tour: { select: { name: true } },
					transferService: { select: { name: true } },
				},
			})

			if (!targetEvent) {
				return { success: false as const, moved: 0, error: "Evento destino no encontrado" }
			}

			if (targetEvent.status === "CANCELLED") {
				return { success: false as const, moved: 0, error: "El evento destino está anulado" }
			}

			// Compute total passengers
			const totalPassengerCount = bookings.reduce((sum, b) => sum + b.passengerCount, 0)
			const resultingBookings = targetEvent.currentBookings + totalPassengerCount

			// Capacity pre-check
			if (resultingBookings > targetEvent.maxCapacity && !force) {
				return {
					success: false as const,
					moved: 0,
					capacityExceeded: true,
					capacityInfo: {
						targetCurrentBookings: targetEvent.currentBookings,
						targetMaxCapacity: targetEvent.maxCapacity,
						totalPassengerCount,
						resultingBookings,
					},
				}
			}

			const targetEventName =
				targetEvent.tour?.name ?? targetEvent.transferService?.name ?? "Evento desconocido"
			const targetDateStr = formatCalendarDay(targetEvent.date, "dd/MM")

			// Group bookings by source event for efficient count updates
			const bookingsBySource = new Map<string, typeof bookings>()
			for (const booking of bookings) {
				const existing = bookingsBySource.get(booking.eventId) ?? []
				existing.push(booking)
				bookingsBySource.set(booking.eventId, existing)
			}

			// Fetch source events for audit log descriptions
			const sourceEventIds = Array.from(bookingsBySource.keys())
			const sourceEvents = await tx.event.findMany({
				where: { id: { in: sourceEventIds } },
				select: {
					id: true,
					date: true,
					tour: { select: { name: true } },
					transferService: { select: { name: true } },
				},
			})
			const sourceEventMap = new Map(sourceEvents.map((e) => [e.id, e]))

			// Update all bookings to target event
			await tx.eventBooking.updateMany({
				where: { id: { in: bookingIds } },
				data: { eventId: targetEventId },
			})

			// Decrement source event counts
			for (const [sourceEventId, sourceBookings] of bookingsBySource) {
				const paxFromSource = sourceBookings.reduce((sum, b) => sum + b.passengerCount, 0)
				await tx.event.update({
					where: { id: sourceEventId },
					data: { currentBookings: { decrement: paxFromSource } },
				})
			}

			// Increment target event count
			await tx.event.update({
				where: { id: targetEventId },
				data: { currentBookings: { increment: totalPassengerCount } },
			})

			// Write individual audit log entries per booking (2 per booking: OUT + IN)
			const auditEntries: Prisma.AuditLogCreateManyInput[] = []

			for (const booking of bookings) {
				const sourceEvent = sourceEventMap.get(booking.eventId)
				const sourceEventName =
					sourceEvent?.tour?.name ?? sourceEvent?.transferService?.name ?? "Evento desconocido"
				const sourceDateStr = sourceEvent?.date ? formatCalendarDay(sourceEvent.date, "dd/MM") : "?"
				const voucherLabel = booking.saleRecord?.voucher
					? `V-${booking.saleRecord.voucher}`
					: booking.id

				auditEntries.push(
					{
						action: "UPDATE",
						entityType: "Event",
						entityId: booking.eventId,
						userId: user.id,
						userName: user.name ?? "Usuario desconocido",
						userEmail: user.email ?? "",
						oldValues: { bookingId: booking.id, eventId: booking.eventId } as Prisma.InputJsonValue,
						newValues: { bookingId: booking.id, eventId: targetEventId } as Prisma.InputJsonValue,
						metadata: {
							type: "BOOKING_MOVE",
							direction: "OUT",
							passengerCount: booking.passengerCount,
							forced: !!force,
						} as Prisma.InputJsonValue,
						description: `Reasignación de voucher ${voucherLabel} (${booking.passengerCount} pax) → ${targetEventName} ${targetDateStr}. Motivo: ${reason.trim()}`,
					},
					{
						action: "UPDATE",
						entityType: "Event",
						entityId: targetEventId,
						userId: user.id,
						userName: user.name ?? "Usuario desconocido",
						userEmail: user.email ?? "",
						oldValues: { bookingId: booking.id, eventId: booking.eventId } as Prisma.InputJsonValue,
						newValues: { bookingId: booking.id, eventId: targetEventId } as Prisma.InputJsonValue,
						metadata: {
							type: "BOOKING_MOVE",
							direction: "IN",
							passengerCount: booking.passengerCount,
							forced: !!force,
						} as Prisma.InputJsonValue,
						description: `Recepción de voucher ${voucherLabel} (${booking.passengerCount} pax) desde ${sourceEventName} ${sourceDateStr}. Motivo: ${reason.trim()}`,
					}
				)
			}

			await tx.auditLog.createMany({ data: auditEntries })

			const affectedSaleIds = Array.from(new Set(bookings.map((b) => b.saleRecordId)))
			await applyFirstEventDateForSales(affectedSaleIds, tx)

			return { success: true as const, moved: bookings.length }
		})

		return result
	} catch (error) {
		console.error("Error moving bookings:", error)
		if (error instanceof Error) {
			return { success: false, moved: 0, error: error.message }
		}
		return { success: false, moved: 0, error: "Error al mover las reservas" }
	}
}

export async function getFutureEventsForTour(
	tourId: string,
	excludeEventId?: string,
	includePastDays = 0
): Promise<EligibleTargetEvent[]> {
	try {
		await getAuthUser()

		const fromDate = todayInSantiago()
		if (includePastDays > 0) {
			fromDate.setUTCDate(fromDate.getUTCDate() - includePastDays)
		}

		const where: Prisma.EventWhereInput = {
			tourId,
			date: {
				gte: fromDate,
			},
			status: {
				not: "CANCELLED",
			},
		}

		if (excludeEventId) {
			where.id = { not: excludeEventId }
		}

		const events = await prisma.event.findMany({
			where,
			orderBy: {
				date: "asc",
			},
			select: {
				id: true,
				date: true,
				startTime: true,
				endTime: true,
				maxCapacity: true,
				currentBookings: true,
				tour: { select: { name: true } },
				transferService: { select: { id: true, name: true } },
			},
		})

		return events
	} catch (error) {
		console.error("Error fetching future events:", error)
		return []
	}
}

// ==================== BULK ASSIGNMENT ====================

export async function bulkAssignProvider(
	input: BulkAssignSchema
): Promise<{ success: boolean; updated: number; error?: string }> {
	try {
		const user = await getAuthUser()
		const canInteract = await canCurrentUserInteractPath("/dashboard/calendario")
		if (!canInteract) {
			return { success: false, updated: 0, error: "No autorizado para interactuar con calendario" }
		}

		const validated = bulkAssignSchema.parse(input)

		// Build the update data — only include non-undefined fields
		const updateData: Record<string, unknown> = {}

		if (validated.guideId !== undefined) {
			updateData.guideId = validated.guideId || null
		}
		if (validated.driverId !== undefined) {
			updateData.driverId = validated.driverId || null
		}
		if (validated.vehicleId !== undefined) {
			updateData.vehicleId = validated.vehicleId || null
		}
		if (validated.guideCost !== undefined) {
			updateData.guideCost = validated.guideCost
		}
		if (validated.driverCost !== undefined) {
			updateData.driverCost = validated.driverCost
		}
		if (validated.vehicleCost !== undefined) {
			updateData.vehicleCost = validated.vehicleCost
		}

		if (Object.keys(updateData).length === 0) {
			return { success: false, updated: 0, error: "No se proporcionaron campos para actualizar" }
		}

		// Fetch current provider values BEFORE the update (for audit log)
		const events = await prisma.event.findMany({
			where: { id: { in: validated.eventIds } },
			select: {
				id: true,
				serviceKind: true,
				guideId: true,
				driverId: true,
				vehicleId: true,
				guide: { select: { fullName: true, companyName: true } },
				driver: { select: { fullName: true, companyName: true } },
				vehicle: {
					select: { vehicleBrand: true, vehicleModel: true, vehiclePlate: true, companyName: true },
				},
			},
		})

		const updates = events.map((event) => {
			const eventUpdateData = { ...updateData }

			// Skip guide assignment for TRANSFER events
			if (event.serviceKind === "TRANSFER") {
				delete eventUpdateData.guideId
				delete eventUpdateData.guideCost
			}

			return prisma.event.update({
				where: { id: event.id },
				data: eventUpdateData,
			})
		})

		await prisma.$transaction(updates)

		// Resolve new provider names for audit log (only once per unique ID)
		const newProviderIds = new Set<string>()
		if (updateData.guideId && typeof updateData.guideId === "string")
			newProviderIds.add(updateData.guideId)
		if (updateData.driverId && typeof updateData.driverId === "string")
			newProviderIds.add(updateData.driverId)
		if (updateData.vehicleId && typeof updateData.vehicleId === "string")
			newProviderIds.add(updateData.vehicleId)

		const newProviders =
			newProviderIds.size > 0
				? await prisma.provider.findMany({
						where: { id: { in: Array.from(newProviderIds) } },
						select: {
							id: true,
							fullName: true,
							companyName: true,
							vehicleBrand: true,
							vehicleModel: true,
							vehiclePlate: true,
						},
					})
				: []

		const providerMap = new Map(newProviders.map((p) => [p.id, p]))

		// Write audit logs per event
		const auditUser = {
			id: user.id,
			name: user.name ?? "Usuario desconocido",
			email: user.email ?? "",
		}

		for (const event of events) {
			const changes: ProviderChange[] = []
			const fieldsToCheck: Array<{
				field: "guideId" | "driverId" | "vehicleId"
				role: "Guía" | "Conductor" | "Vehículo"
				oldId: string | null
				oldProvider: {
					fullName?: string | null
					companyName?: string | null
					vehicleBrand?: string | null
					vehicleModel?: string | null
					vehiclePlate?: string | null
				} | null
			}> = []

			if (updateData.guideId !== undefined && event.serviceKind !== "TRANSFER") {
				fieldsToCheck.push({
					field: "guideId",
					role: "Guía",
					oldId: event.guideId,
					oldProvider: event.guide,
				})
			}
			if (updateData.driverId !== undefined) {
				fieldsToCheck.push({
					field: "driverId",
					role: "Conductor",
					oldId: event.driverId,
					oldProvider: event.driver,
				})
			}
			if (updateData.vehicleId !== undefined) {
				fieldsToCheck.push({
					field: "vehicleId",
					role: "Vehículo",
					oldId: event.vehicleId,
					oldProvider: event.vehicle,
				})
			}

			for (const pf of fieldsToCheck) {
				const newId = (updateData[pf.field] as string | null) ?? null
				if (pf.oldId !== newId) {
					const newProvider = newId ? (providerMap.get(newId) ?? null) : null
					changes.push({
						field: pf.field,
						oldValue: pf.oldId,
						newValue: newId,
						oldName: getProviderDisplayName(pf.oldProvider, pf.field),
						newName: newProvider ? getProviderDisplayName(newProvider, pf.field) : null,
						role: pf.role,
					})
				}
			}

			if (changes.length > 0) {
				await writeProviderAuditLogs(event.id, changes, auditUser)
			}
		}

		return { success: true, updated: events.length }
	} catch (error) {
		console.error("Error in bulk assignment:", error)
		if (error instanceof Error) {
			return { success: false, updated: 0, error: error.message }
		}
		return { success: false, updated: 0, error: "Error al realizar la asignación masiva" }
	}
}

// ==================== PASSENGER & CONTACT MANAGEMENT ====================

export async function updateSaleRecordContacted(saleRecordId: string, contacted: boolean) {
	try {
		await getAuthUser()
		const canInteract = await canCurrentUserInteractPath("/dashboard/calendario")
		if (!canInteract) {
			return { success: false, error: "No autorizado para interactuar con calendario" }
		}

		// Update this sale record
		await prisma.saleRecord.update({
			where: { id: saleRecordId },
			data: { contacted },
		})

		// If marking as contacted, also mark all other event bookings for this sale as contacted
		// This handles the case where a sale has multiple tours/events
		if (contacted) {
			const saleRecord = await prisma.saleRecord.findUnique({
				where: { id: saleRecordId },
				select: { id: true },
			})

			if (saleRecord) {
				// The contacted field is on SaleRecord, so updating once affects all bookings
				// No additional action needed
			}
		}

		return { success: true }
	} catch (error) {
		console.error("Error updating contacted status:", error)
		return { success: false, error: "Error al actualizar estado de contacto" }
	}
}

export interface UpdatePassengerData {
	id: string
	name?: string | null
	document?: string | null
	age?: number | null
	nationality?: string | null
	diet?: "NORMAL" | "VEGETARIAN" | "VEGAN" | "CELIAC" | "OTHER" | null
	dietOther?: string | null
	phone?: string | null
	hotel?: string | null
	email?: string | null
}

export async function updatePassenger(data: UpdatePassengerData) {
	try {
		await getAuthUser()
		const canInteract = await canCurrentUserInteractPath("/dashboard/calendario")
		if (!canInteract) {
			return { success: false, error: "No autorizado para interactuar con calendario" }
		}

		const { id, hotel, ...updateData } = data

		await prisma.passenger.update({
			where: { id },
			data: {
				...updateData,
				...(hotel !== undefined && {
					hotels: {
						deleteMany: {},
						create: hotel ? [{ hotelName: hotel, order: 0 }] : [],
					},
				}),
			},
		})

		return { success: true }
	} catch (error) {
		console.error("Error updating passenger:", error)
		return { success: false, error: "Error al actualizar pasajero" }
	}
}

export async function updateMultiplePassengers(passengers: UpdatePassengerData[]) {
	try {
		await getAuthUser()
		const canInteract = await canCurrentUserInteractPath("/dashboard/calendario")
		if (!canInteract) {
			return { success: false, error: "No autorizado para interactuar con calendario" }
		}

		// Separate hotel updates from passenger field updates
		const passengerUpdates = passengers.map((p) => {
			const { id, hotel, ...updateData } = p
			return prisma.passenger.update({
				where: { id },
				data: updateData,
			})
		})

		const hotelUpdates = passengers
			.filter((p) => p.hotel !== undefined)
			.flatMap((p) => [
				prisma.passengerHotel.deleteMany({
					where: { passengerId: p.id },
				}),
				...(p.hotel
					? [
							prisma.passengerHotel.create({
								data: {
									passengerId: p.id,
									hotelName: p.hotel,
									order: 0,
								},
							}),
						]
					: []),
			])

		await prisma.$transaction([...passengerUpdates, ...hotelUpdates])

		return { success: true }
	} catch (error) {
		console.error("Error updating passengers:", error)
		return { success: false, error: "Error al actualizar pasajeros" }
	}
}

// ==================== RESCHEDULE EVENT ====================

export async function rescheduleEvent(input: unknown): Promise<RescheduleEventResult> {
	try {
		// Step 1: Auth
		const user = await getAuthUser()

		// Step 2: Permission guard
		const canInteract = await canCurrentUserInteractPath("/dashboard/calendario")
		if (!canInteract) {
			return { success: false, error: "No autorizado para reagendar eventos" }
		}

		// Step 3: Validate input
		const parsed = rescheduleEventSchema.parse(input)

		// Step 4: Fetch event with full provider + booking data
		const event = await prisma.event.findUnique({
			where: { id: parsed.eventId },
			select: {
				id: true,
				date: true,
				startTime: true,
				endTime: true,
				status: true,
				guideId: true,
				driverId: true,
				vehicleId: true,
				cateringProviderId: true,
				tour: { select: { name: true, startTime: true, endTime: true } },
				transferService: { select: { id: true, name: true } },
				bookings: {
					where: { cancelled: false },
					select: { saleRecordId: true, passengerCount: true },
				},
				guide: { select: { fullName: true, companyName: true } },
				driver: { select: { fullName: true, companyName: true } },
				vehicle: {
					select: {
						vehicleBrand: true,
						vehicleModel: true,
						vehiclePlate: true,
						companyName: true,
					},
				},
				cateringProvider: { select: { fullName: true, companyName: true } },
			},
		})

		if (!event) {
			return { success: false, error: "Evento no encontrado" }
		}

		// Step 5: Status gating — hard block
		if (
			event.status === "IN_PROGRESS" ||
			event.status === "COMPLETED" ||
			event.status === "CANCELLED"
		) {
			return {
				success: false,
				error: "El evento no puede reagendarse en su estado actual",
			}
		}

		// Step 6: Past-date gating — compare against Santiago calendar day start.
		const todayStart = todayInSantiago()
		if (parsed.newDate < todayStart) {
			return { success: false, error: "No se puede reagendar a una fecha pasada" }
		}

		// Step 7: Collect unique saleRecordIds from active bookings
		const saleIds = [...new Set(event.bookings.map((b) => b.saleRecordId))]

		// Step 8: Passenger conflict — single findMany (no N+1)
		// Normalize to UTC midnight once here; reused for the DB write below.
		// event.date is @db.Date — use exact calendar-day equality.
		const newDateCalendar = parseCalendarDay(formatCalendarDay(parsed.newDate, "yyyy-MM-dd"))

		const siblings = await prisma.eventBooking.findMany({
			where: {
				saleRecordId: { in: saleIds },
				eventId: { not: parsed.eventId },
				cancelled: false,
				event: {
					status: { not: "CANCELLED" },
					date: newDateCalendar,
				},
			},
			include: {
				event: {
					select: {
						id: true,
						date: true,
						startTime: true,
						endTime: true,
						tour: { select: { name: true } },
						transferService: { select: { id: true, name: true } },
					},
				},
				saleRecord: { select: { voucher: true } },
			},
		})

		const passengerConflicts: PassengerConflict[] = siblings
			.filter((sb) =>
				timeRangesOverlap(
					{ start: parsed.newStartTime ?? null, end: parsed.newEndTime ?? null },
					{ start: sb.event.startTime, end: sb.event.endTime }
				)
			)
			.map((sb) => ({
				voucher: sb.saleRecord.voucher,
				saleRecordId: sb.saleRecordId,
				conflictingEventId: sb.event.id,
				tourName: sb.event.tour?.name ?? null,
				date: sb.event.date,
				startTime: sb.event.startTime,
				endTime: sb.event.endTime,
			}))

		if (passengerConflicts.length > 0) {
			return {
				success: false,
				error: "Conflicto de pasajero detectado",
				passengerConflicts,
			}
		}

		// Step 9: Provider conflict check (soft, override-able)
		const providerConflicts: ProviderConflictSummary[] = []

		const providerSlots: Array<{
			id: string | null
			role: ProviderConflictSummary["role"]
			name: string | null
		}> = [
			{
				id: event.guideId,
				role: "Guía",
				name: event.guide?.fullName ?? event.guide?.companyName ?? null,
			},
			{
				id: event.driverId,
				role: "Conductor",
				name: event.driver?.fullName ?? event.driver?.companyName ?? null,
			},
			{
				id: event.vehicleId,
				role: "Vehículo",
				name: event.vehicle
					? [
							event.vehicle.vehicleBrand,
							event.vehicle.vehicleModel,
							event.vehicle.vehiclePlate ? `(${event.vehicle.vehiclePlate})` : null,
						]
							.filter(Boolean)
							.join(" ") ||
						event.vehicle.companyName ||
						null
					: null,
			},
			{
				id: event.cateringProviderId,
				role: "Catering",
				name: event.cateringProvider?.fullName ?? event.cateringProvider?.companyName ?? null,
			},
		]

		for (const slot of providerSlots) {
			if (!slot.id) continue
			const res = await checkProviderAvailability(
				slot.id,
				parsed.newDate,
				parsed.newStartTime ?? "",
				parsed.newEndTime ?? "",
				parsed.eventId
			)
			if (res.success && !res.isAvailable && res.conflicts) {
				const firstConflict = res.conflicts[0]
				providerConflicts.push({
					role: slot.role,
					providerName: slot.name ?? slot.id,
					conflictingEventId: firstConflict?.id ?? "",
					conflictingTourName: firstConflict?.tour?.name ?? null,
				})
			}
		}

		if (providerConflicts.length > 0 && !parsed.overrideProviderConflict) {
			return {
				success: false,
				error: "Conflicto de proveedor detectado",
				providerConflicts,
			}
		}

		// Tour window violation check (soft — only for audit metadata)
		let outOfTourWindow = false
		if (event.tour?.startTime && event.tour?.endTime) {
			if (
				(parsed.newStartTime && parsed.newStartTime < event.tour.startTime) ||
				(parsed.newEndTime && parsed.newEndTime > event.tour.endTime)
			) {
				outOfTourWindow = true
			}
		}

		// Snapshots for audit log
		const oldSnapshot = {
			date: event.date.toISOString(),
			startTime: event.startTime,
			endTime: event.endTime,
		}
		const newSnapshot = {
			date: parsed.newDate.toISOString(),
			startTime: parsed.newStartTime ?? event.startTime,
			endTime: parsed.newEndTime ?? event.endTime,
		}

		// Format helper for description
		const formatShort = (date: Date, time: string | null | undefined): string => {
			return format(date, "dd/MM") + (time ? ` ${time}` : "")
		}

		// Step 10: Transaction — update event + mark vouchers + audit
		// newDateCalendar is already computed above (Step 8) and reused here.
		await prisma.$transaction(async (tx) => {
			await tx.event.update({
				where: { id: parsed.eventId },
				data: {
					date: newDateCalendar,
					startTime: parsed.newStartTime ?? event.startTime,
					endTime: parsed.newEndTime ?? event.endTime,
				},
			})

			if (saleIds.length > 0) {
				await tx.saleRecord.updateMany({
					where: { id: { in: saleIds } },
					data: { voucherOutdatedAt: new Date() },
				})
				await applyFirstEventDateForSales(saleIds, tx)
			}

			await tx.auditLog.create({
				data: {
					action: "UPDATE",
					entityType: "Event",
					entityId: parsed.eventId,
					userId: user.id,
					userName: user.name ?? "Usuario desconocido",
					userEmail: user.email ?? "",
					oldValues: oldSnapshot as Prisma.InputJsonValue,
					newValues: newSnapshot as Prisma.InputJsonValue,
					metadata: {
						type: "EVENT_RESCHEDULE",
						reason: parsed.reason,
						affectedSaleRecordIds: saleIds,
						affectedBookingCount: event.bookings.length,
						hadProviderConflict: providerConflicts.length > 0,
						overrideProviderConflict: parsed.overrideProviderConflict,
						hadConfirmedStatus: event.status === "CONFIRMED",
						outOfTourWindow,
					} as Prisma.InputJsonValue,
					description:
						`Reprogramación: ${formatShort(event.date, event.startTime)} → ${formatShort(parsed.newDate, parsed.newStartTime)}.` +
						` Afecta ${saleIds.length} voucher(s). Motivo: ${parsed.reason}`,
				},
			})
		})

		// Step 11: Revalidate
		revalidatePath("/dashboard/calendario")
		revalidatePath("/dashboard/registro-de-ventas")
		revalidatePath("/dashboard/navegacion-ventas")

		// Step 12: Return success
		return {
			success: true,
			data: { eventId: parsed.eventId, affectedSaleRecordIds: saleIds },
		}
	} catch (error) {
		// Step 13: Outer catch
		console.error("Error rescheduling event:", error)
		return { success: false, error: "Error al reagendar el evento" }
	}
}

export interface EventHoverProvider {
	role: "Guía" | "Conductor" | "Vehículo" | "Catering"
	name: string
	cost: number
}

export interface EventHoverDetails {
	id: string
	name: string
	date: Date
	startTime: string | null
	endTime: string | null
	totalPax: number
	providers: EventHoverProvider[]
}

export async function getEventHoverDetails(
	eventId: string
): Promise<EventHoverDetails | null> {
	try {
		await getAuthUser()

		const event = await prisma.event.findUnique({
			where: { id: eventId },
			select: {
				id: true,
				date: true,
				startTime: true,
				endTime: true,
				guideCost: true,
				driverCost: true,
				vehicleCost: true,
				cateringCost: true,
				tour: { select: { name: true } },
				transferService: { select: { name: true } },
				guide: { select: { fullName: true, companyName: true } },
				driver: { select: { fullName: true, companyName: true } },
				vehicle: {
					select: {
						vehicleBrand: true,
						vehicleModel: true,
						vehiclePlate: true,
					},
				},
				cateringProvider: { select: { fullName: true, companyName: true } },
				bookings: { select: { passengerCount: true } },
			},
		})

		if (!event) return null

		const providers: EventHoverProvider[] = []

		if (event.guide) {
			providers.push({
				role: "Guía",
				name: event.guide.fullName || event.guide.companyName || "Sin nombre",
				cost: event.guideCost ?? 0,
			})
		}

		if (event.driver) {
			providers.push({
				role: "Conductor",
				name: event.driver.fullName || event.driver.companyName || "Sin nombre",
				cost: event.driverCost ?? 0,
			})
		}

		if (event.vehicle) {
			const vehicleName =
				[event.vehicle.vehicleBrand, event.vehicle.vehicleModel]
					.filter(Boolean)
					.join(" ") ||
				event.vehicle.vehiclePlate ||
				"Vehículo"
			providers.push({
				role: "Vehículo",
				name: event.vehicle.vehiclePlate
					? `${vehicleName} (${event.vehicle.vehiclePlate})`
					: vehicleName,
				cost: event.vehicleCost ?? 0,
			})
		}

		if (event.cateringProvider) {
			providers.push({
				role: "Catering",
				name:
					event.cateringProvider.fullName ||
					event.cateringProvider.companyName ||
					"Sin nombre",
				cost: event.cateringCost ?? 0,
			})
		}

		const totalPax = event.bookings.reduce((acc, b) => acc + b.passengerCount, 0)
		const name = event.tour?.name || event.transferService?.name || "Sin nombre"

		return {
			id: event.id,
			name,
			date: event.date,
			startTime: event.startTime,
			endTime: event.endTime,
			totalPax,
			providers,
		}
	} catch (error) {
		console.error("Error fetching event hover details:", error)
		return null
	}
}
