"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, Loader2 } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { calculateBookingRevenue } from "@/project/sales/utils/booking-revenue"
import { useDebounce } from "@/shared/hooks/use-debounce"
import { useProviders } from "@/project/providers/hooks/use-providers"
import {
	updateEvent,
	getEventById,
	updatePassenger,
	updateSaleRecordContacted,
} from "@/project/events/actions/event.actions"
import { Skeleton } from "@/shared/components/ui/skeleton"
import { Dialog, DialogContent, DialogTitle } from "@/shared/components/ui/dialog"
import { APPROVAL_ACTION } from "@/generated/prisma/enums"
import { RequestApprovalDialog } from "@/project/approvals/components/request/request-approval-dialog"

import { formatCalendarDay } from "@/shared/utils/calendar-day"
import { countRegisteredPassengers, countChargedPassengers } from "../utils/passenger-totals"
import { isPassengerComplete, getProviderServiceCost } from "./event-detail-utils"
import { EventDetailHeader } from "./event-detail-header"
import { EventVouchersSection } from "./event-vouchers-section"
import { EventProvidersSection } from "./event-providers-section"
import { EventDetailFooter } from "./event-detail-footer"
import { ConflictWarningDialog } from "./conflict-warning-dialog"
import { EventAuditLogSection } from "./event-audit-log-section"
import { BookingReassignmentDialog } from "./booking-reassignment-dialog"
import { useConflictDetection } from "../hooks/use-conflict-detection"
import { useBookingReassignment } from "../hooks/use-booking-reassignment"
import type { EventFormData, UpdatePassengerData } from "./event-detail-types"
import type { CalendarViewEvent } from "../types/calendar.types"
import type { ConflictInfo, ProviderRole } from "../types/provider-assignment.types"
import type { EventSuggestions, ProviderScore } from "../types/auto-assignment.types"

const ROLE_LABEL = {
	guide: "Guía",
	driver: "Conductor",
	vehicle: "Vehículo",
} as const

interface EventDetailPanelProps {
	eventId: string | null
	open: boolean
	onClose: () => void
	calendarEvents?: CalendarViewEvent[]
	getEventSuggestions?: (eventId: string) => EventSuggestions | undefined
	getAlternativesForEvent?: (eventId: string, role: ProviderRole) => ProviderScore[]
}

export function EventDetailPanel({ eventId, open, onClose, calendarEvents = [], getEventSuggestions, getAlternativesForEvent }: EventDetailPanelProps) {
	const router = useRouter()
	const { data: session } = authClient.useSession()
	const isAdmin = session?.user?.role === "admin"

	const [isSubmitting, setIsSubmitting] = useState(false)
	const [openVouchers, setOpenVouchers] = useState<string[]>([])
	const [openProviders, setOpenProviders] = useState<string[]>(["guide", "driver", "vehicle"])
	const [passengerEdits, setPassengerEdits] = useState<Record<string, UpdatePassengerData>>({})
	const [savingPassengers, setSavingPassengers] = useState<Record<string, boolean>>({})
	const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
	const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
	const [pendingConflicts, setPendingConflicts] = useState<ConflictInfo[]>([])
	const [pendingProviderChange, setPendingProviderChange] = useState<{
		type: "guide" | "driver" | "vehicle"
		id: string
	} | null>(null)

	const { data: providers } = useProviders()
	const { checkConflict, getConflictsForEvent } = useConflictDetection(calendarEvents)

	const {
		data: event,
		isLoading,
		refetch,
	} = useQuery({
		queryKey: ["event", eventId],
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		queryFn: () => (eventId ? getEventById(eventId) : null) as any,
		enabled: !!eventId,
	})

	const reassignment = useBookingReassignment({ event: event ?? null })

	const [formData, setFormData] = useState<EventFormData>({
		status: "",
		startTime: "",
		endTime: "",
		guideId: "",
		driverId: "",
		vehicleId: "",
		cateringProviderId: "",
		cateringCost: 0,
		cateringSelection: [],
		comments: "",
		operationalNotes: "",
		cateringNotes: "",
		guideCost: 0,
		driverCost: 0,
		vehicleCost: 0,
		isCompleted: false,
	})

	// Debounced passenger data for auto-save
	const debouncedPassengerEdits = useDebounce(passengerEdits, 800)

	useEffect(() => {
		if (event) {
			setFormData({
				status: event.status,
				startTime: event.startTime || "",
				endTime: event.endTime || "",
				guideId: event.guideId || "",
				driverId: event.driverId || "",
				vehicleId: event.vehicleId || "",
				cateringProviderId: event.cateringProviderId || "",
				cateringCost: event.cateringCost || 0,
				cateringSelection:
					(event.cateringSelection as { id: string; name: string; price: number }[]) || [],
				comments: event.comments || "",
				operationalNotes: event.operationalNotes || "",
				cateringNotes: event.cateringNotes || "",
				guideCost: event.guideCost || 0,
				driverCost: event.driverCost || 0,
				vehicleCost: event.vehicleCost || 0,
				isCompleted: event.status === "CONFIRMED",
			})
			// Reset passenger edits when event changes
			setPassengerEdits({})
		}
	}, [event])

	// Auto-save passengers when debounced edits change
	useEffect(() => {
		const savePassengers = async () => {
			const editsToSave = Object.values(debouncedPassengerEdits)
			if (editsToSave.length === 0) return

			for (const edit of editsToSave) {
				if (!edit.id) continue
				setSavingPassengers((prev) => ({ ...prev, [edit.id]: true }))
				try {
					await updatePassenger(edit)
				} catch (error) {
					console.error("Error auto-saving passenger:", error)
				} finally {
					setSavingPassengers((prev) => ({ ...prev, [edit.id]: false }))
				}
			}
		}
		savePassengers()
	}, [debouncedPassengerEdits])

	const isTransfer = event?.serviceKind === "TRANSFER"

	useEffect(() => {
		if (event?.id) {
			setOpenProviders(isTransfer ? ["driver", "vehicle"] : ["guide", "driver", "vehicle"])
		}
	}, [event?.id, isTransfer])

	const totalRevenue = useMemo(() => {
		if (!event?.bookings) return 0
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return event.bookings.reduce((acc: number, booking: any) => {
			const priceEntries = booking.priceEntries || []
			const entrySnapshots = booking.entrySnapshots || []
			const revenue = calculateBookingRevenue(priceEntries, entrySnapshots)
			return acc + revenue.grandTotal
		}, 0)
	}, [event?.bookings])

	// Registered passengers (real roster) — matches the sum of the per-voucher
	// "X pax" badges. Drives the header count and the vehicle capacity warning.
	const registeredPassengers = useMemo(
		() => countRegisteredPassengers(event?.bookings),
		[event?.bookings]
	)

	// Charged passengers (what was actually paid for). When it differs from the
	// registered roster (legacy data, since the overflow guard now blocks new
	// occurrences), the header surfaces a warning badge.
	const chargedPassengers = useMemo(
		() => countChargedPassengers(event?.bookings),
		[event?.bookings]
	)

	// Check for incomplete passengers across all bookings
	const incompletePassengersCount = useMemo(() => {
		if (!event?.bookings) return 0
		let count = 0
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		event.bookings.forEach((booking: any) => {
			// Use bookingPassengers (non-excluded) if available, fall back to saleRecord.passengers
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const activePassengers = booking.bookingPassengers?.length
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				? booking.bookingPassengers.filter((bp: any) => !bp.excluded).map((bp: any) => bp.passenger)
				: booking.saleRecord?.passengers ?? []
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			activePassengers.forEach((p: any) => {
				if (!isPassengerComplete(p)) count++
			})
		})
		return count
	}, [event?.bookings])

	const totalCost =
		(formData.guideCost || 0) +
		(formData.driverCost || 0) +
		(formData.vehicleCost || 0) +
		(formData.cateringCost || 0)
	const profit = totalRevenue - totalCost
	const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0

	// --- Enriched conflicts for banner ---
	const enrichedEventConflicts = useMemo(() => {
		if (!event?.id) return []
		const eventConflicts = getConflictsForEvent(event.id)
		if (eventConflicts.length === 0) return []
		return eventConflicts.map((c) => {
			const provider = providers?.find((p) => p.id === c.providerId)
			return {
				...c,
				providerName: provider?.fullName ?? provider?.companyName ?? c.providerId,
			}
		})
	}, [event?.id, getConflictsForEvent, providers])

	const applyProviderChange = useCallback(
		(type: "guide" | "driver" | "vehicle", id: string) => {
			const updates: Record<string, string | number> = { [`${type}Id`]: id }

			if (id && id !== "none") {
				const provider = providers?.find((p) => p.id === id)
				const providerCost = getProviderServiceCost(provider, type)

				if (providerCost > 0) {
					if (type === "guide") updates.guideCost = providerCost
					if (type === "driver") updates.driverCost = providerCost
					if (type === "vehicle") updates.vehicleCost = providerCost
				}
			} else if (id === "none") {
				updates[`${type}Id`] = ""
			}

			setFormData((prev) => ({ ...prev, ...updates }))
		},
		[providers]
	)

	const handleProviderChange = useCallback(
		(type: "guide" | "driver" | "vehicle", id: string) => {
			// Skip conflict check for deselection
			if (!id || id === "none") {
				applyProviderChange(type, id)
				return
			}

			// Find the current event in calendarEvents to use for conflict detection
			const currentEvent = calendarEvents.find((e) => e.id === event?.id)
			if (!currentEvent) {
				applyProviderChange(type, id)
				return
			}

			const conflict = checkConflict(id, currentEvent)
			if (conflict) {
				const provider = providers?.find((p) => p.id === id)
				const enrichedConflict: ConflictInfo = {
					...conflict,
					providerName: provider?.fullName ?? provider?.companyName ?? "",
					providerType: type,
				}
				setPendingConflicts([enrichedConflict])
				setPendingProviderChange({ type, id })
				setConflictDialogOpen(true)
				return
			}

			applyProviderChange(type, id)
		},
		[applyProviderChange, calendarEvents, checkConflict, event?.id, providers]
	)

	const handleConflictConfirm = useCallback(() => {
		if (pendingProviderChange) {
			applyProviderChange(pendingProviderChange.type, pendingProviderChange.id)
		}
		setConflictDialogOpen(false)
		setPendingConflicts([])
		setPendingProviderChange(null)
	}, [applyProviderChange, pendingProviderChange])

	const handleConflictCancel = useCallback(() => {
		setConflictDialogOpen(false)
		setPendingConflicts([])
		setPendingProviderChange(null)
	}, [])

	const handleContactedChange = useCallback(
		async (saleRecordId: string, contacted: boolean) => {
			try {
				await updateSaleRecordContacted(saleRecordId, contacted)
				refetch()
				toast.success(contacted ? "Marcado como contactado" : "Desmarcado")
			} catch {
				toast.error("Error al actualizar")
			}
		},
		[refetch]
	)

	const handlePassengerChange = useCallback(
		(passengerId: string, field: keyof UpdatePassengerData, value: string | number | null) => {
			setPassengerEdits((prev) => ({
				...prev,
				[passengerId]: {
					...prev[passengerId],
					id: passengerId,
					[field]: value,
				},
			}))
		},
		[]
	)

	const handleSubmit = async () => {
		if (!event) return
		setIsSubmitting(true)
		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const result = await updateEvent(event.id, formData as any)
			if (result.success) {
				toast.success("Evento actualizado")
				refetch()
				router.refresh()
			} else {
				toast.error(result.error)
			}
		} catch {
			toast.error("Error al guardar")
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleCancelSuccess = () => {
		setCancelDialogOpen(false)
		toast.success(
			isAdmin
				? "Solicitud procesada. Revisá el estado en Autorizaciones."
				: "Solicitud enviada. Te avisamos por email cuando se resuelva."
		)
		refetch()
		router.refresh()
	}

	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent className="flex max-h-[95vh] max-w-6xl min-w-[90vw] flex-col gap-0 p-0">
				<DialogTitle className="sr-only">Detalle del evento</DialogTitle>
				{isLoading ? (
					<>
						{/* Header skeleton */}
						<div className="space-y-2 border-b p-4">
							<Skeleton className="h-3 w-40" />
							<Skeleton className="h-6 w-64" />
							<div className="flex items-center gap-2">
								<Skeleton className="h-4 w-24" />
								<Skeleton className="h-5 w-44 rounded-full" />
							</div>
						</div>

						{/* Two column layout skeleton */}
						<div className="grid min-h-0 flex-1 grid-cols-3 divide-x">
							{/* Left column — Vouchers */}
							<div className="col-span-2 space-y-4 overflow-y-auto p-4">
								<div className="flex items-center gap-2">
									<Skeleton className="h-4 w-4" />
									<Skeleton className="h-4 w-28" />
								</div>
								{[1, 2].map((i) => (
									<div key={i} className="space-y-3 rounded-lg border p-4">
										<div className="flex items-center gap-3">
											<Skeleton className="h-5 w-16" />
											<Skeleton className="h-4 w-12" />
											<Skeleton className="h-5 w-32 rounded-full" />
										</div>
										<Skeleton className="h-3 w-48" />
									</div>
								))}
							</div>

							{/* Right column — Providers */}
							<div className="space-y-4 overflow-y-auto p-4">
								<div className="flex items-center gap-2">
									<Skeleton className="h-4 w-4" />
									<Skeleton className="h-4 w-40" />
								</div>
								{["Guía", "Conductor", "Vehículo", "Catering"].map((label) => (
									<div key={label} className="space-y-2 rounded-lg border p-3">
										<div className="flex items-center gap-2">
											<Skeleton className="h-4 w-4" />
											<Skeleton className="h-4 w-20" />
										</div>
										<Skeleton className="h-9 w-full rounded-md" />
									</div>
								))}
								{/* Rentabilidad skeleton */}
								<div className="space-y-2 rounded-lg border p-3">
									<div className="flex items-center gap-2">
										<Skeleton className="h-4 w-4" />
										<Skeleton className="h-4 w-24" />
									</div>
									<div className="space-y-1.5">
										{[1, 2, 3].map((i) => (
											<div key={i} className="flex justify-between">
												<Skeleton className="h-3 w-16" />
												<Skeleton className="h-3 w-12" />
											</div>
										))}
									</div>
								</div>
							</div>
						</div>

						{/* Footer skeleton */}
						<div className="flex items-center justify-between border-t p-4">
							<div className="flex items-center gap-2">
								<Skeleton className="h-5 w-9 rounded-full" />
								<Skeleton className="h-4 w-40" />
							</div>
							<div className="flex gap-2">
								<Skeleton className="h-9 w-28 rounded-md" />
								<Skeleton className="h-9 w-20 rounded-md" />
								<Skeleton className="h-9 w-32 rounded-md" />
							</div>
						</div>
					</>
				) : !event ? (
					<div className="flex h-64 w-full items-center justify-center p-4">
						<p className="text-muted-foreground">Evento no encontrado</p>
					</div>
				) : (
					<>
						<EventDetailHeader
							event={event}
							registeredPassengers={registeredPassengers}
							chargedPassengers={chargedPassengers}
							incompletePassengersCount={incompletePassengersCount}
						/>

						{/* Conflict Warning Banner */}
						{enrichedEventConflicts.length > 0 && (
							<div className="mx-4 mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/10">
								<div className="flex items-start gap-2">
									<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
									<div className="min-w-0 flex-1">
										<p className="text-sm font-medium text-amber-800 dark:text-amber-200">
											Conflicto de proveedores detectado
										</p>
										<ul className="mt-1 space-y-1">
											{enrichedEventConflicts.map((c, i) => (
												<li key={`${c.providerId}-${c.conflictingEvent.id}-${i}`} className="text-xs text-amber-700 dark:text-amber-300">
													{ROLE_LABEL[c.providerType] ?? c.providerType}{" "}
													<span className="font-medium">{c.providerName}</span>
													{" "}en conflicto con{" "}
													<span className="font-medium">{c.conflictingEvent.tourName}</span>
													{c.conflictingEvent.startTime && (
														<span> ({c.conflictingEvent.startTime}{c.conflictingEvent.endTime ? ` – ${c.conflictingEvent.endTime}` : ""})</span>
													)}
												</li>
											))}
										</ul>
									</div>
								</div>
							</div>
						)}

						{/* Two Column Layout */}
						<div className="grid min-h-0 flex-1 grid-cols-3 divide-x">
							{/* LEFT COLUMN: Vouchers/Bookings */}
							<EventVouchersSection
								event={event}
								openVouchers={openVouchers}
								setOpenVouchers={setOpenVouchers}
								passengerEdits={passengerEdits}
								savingPassengers={savingPassengers}
								handleContactedChange={handleContactedChange}
								handlePassengerChange={handlePassengerChange}
								isMultiSelectMode={reassignment.isMultiSelectMode}
								selectedBookingIds={reassignment.selectedBookingIds}
								onToggleMultiSelectMode={reassignment.toggleMultiSelectMode}
								onToggleBookingSelection={reassignment.toggleBookingSelection}
								onSelectAllBookings={reassignment.selectAllBookings}
								onOpenReassignDialog={reassignment.openReassignDialog}
								onOpenBulkReassignDialog={reassignment.openBulkReassignDialog}
							/>

							{/* RIGHT COLUMN: Providers */}
							<EventProvidersSection
								event={event}
								formData={formData}
								setFormData={setFormData}
								providers={providers}
								isTransfer={isTransfer}
								openProviders={openProviders}
								setOpenProviders={setOpenProviders}
								totalRevenue={totalRevenue}
								totalCost={totalCost}
								profit={profit}
								profitMargin={profitMargin}
								handleProviderChange={handleProviderChange}
								totalPassengers={registeredPassengers}
								suggestions={event?.id && getEventSuggestions ? getEventSuggestions(event.id) : undefined}
								getAlternatives={getAlternativesForEvent}
							/>
						</div>

						<EventDetailFooter
							event={event}
							formData={formData}
							setFormData={setFormData}
							isSubmitting={isSubmitting}
							onSubmit={handleSubmit}
							onClose={onClose}
							onCancelEvent={() => setCancelDialogOpen(true)}
						/>

						{event && (
							<RequestApprovalDialog
								open={cancelDialogOpen}
								onOpenChange={setCancelDialogOpen}
								action={APPROVAL_ACTION.CANCEL_EVENT}
								targetType="event"
								targetId={event.id}
								targetLabel={`Evento del ${event.date ? formatCalendarDay(event.date as Date, "dd/MM/yyyy") : event.id}`}
								payload={{ reason: "" }}
								isAdmin={isAdmin}
								onSuccess={handleCancelSuccess}
							/>
						)}

						<ConflictWarningDialog
							open={conflictDialogOpen}
							onOpenChange={setConflictDialogOpen}
							conflicts={pendingConflicts}
							onConfirm={handleConflictConfirm}
							onCancel={handleConflictCancel}
						/>

						<BookingReassignmentDialog
							open={reassignment.isDialogOpen}
							onOpenChange={(open) => { if (!open) reassignment.closeDialog() }}
							bookings={reassignment.bookingsToMove}
							sourceEvent={reassignment.sourceEvent}
							availableEvents={reassignment.availableEvents}
							isLoadingEvents={reassignment.isLoadingEvents}
							targetEventId={reassignment.targetEventId}
							onTargetChange={reassignment.setTargetEventId}
							reason={reassignment.reason}
							onReasonChange={reassignment.setReason}
							forceOverbook={reassignment.forceOverbook}
							onForceChange={reassignment.setForceOverbook}
							isReassigning={reassignment.isReassigning}
							onConfirm={reassignment.executeReassignment}
							totalPassengersToMove={reassignment.totalPassengersToMove}
							capacityWarning={reassignment.capacityWarning}
						/>
					</>
				)}
			</DialogContent>
		</Dialog>
	)
}
