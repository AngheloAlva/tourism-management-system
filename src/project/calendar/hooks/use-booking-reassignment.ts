"use client"

import { useState, useCallback, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
	moveBooking,
	moveBookings,
	getFutureEventsForTour,
} from "@/project/events/actions/event.actions"
import { getEventDisplayName } from "@/project/events/utils/event-display"
import type {
	EligibleTargetEvent,
	MoveBookingResult,
	MoveBookingsResult,
} from "@/project/events/actions/event.actions"

// --- Constants ---

const REASSIGNMENT_MODE = {
	SINGLE: "single",
	BULK: "bulk",
} as const

type ReassignmentMode = (typeof REASSIGNMENT_MODE)[keyof typeof REASSIGNMENT_MODE]

// --- Interfaces ---

interface CapacityWarning {
	exceeded: boolean
	info: string
}

interface BookingInfo {
	id: string
	voucher: string
	passengerCount: number
}

interface SourceEventInfo {
	id: string
	tourId: string
	tourName: string
	date: Date
}

interface ReassignableBooking {
	id: string
	passengerCount: number
	saleRecord?: { voucher: number | string } | null
}

interface ReassignableEvent {
	id: string
	tourId?: string | null
	tour?: { id: string; name: string } | null
	date: Date | string
	bookings?: ReassignableBooking[]
}

interface UseBookingReassignmentParams {
	event: ReassignableEvent | null
}

interface UseBookingReassignmentReturn {
	// Multi-select state
	selectedBookingIds: Set<string>
	isMultiSelectMode: boolean
	toggleMultiSelectMode: () => void
	toggleBookingSelection: (bookingId: string) => void
	selectAllBookings: (bookingIds: string[]) => void
	clearSelection: () => void

	// Dialog state
	isDialogOpen: boolean
	reassignmentMode: ReassignmentMode
	openReassignDialog: (bookingId: string) => void
	openBulkReassignDialog: () => void
	closeDialog: () => void

	// Reassignment form state
	targetEventId: string
	setTargetEventId: (id: string) => void
	reason: string
	setReason: (reason: string) => void
	forceOverbook: boolean
	setForceOverbook: (force: boolean) => void

	// Available events for target selection
	availableEvents: EligibleTargetEvent[]
	isLoadingEvents: boolean

	// Execution
	isReassigning: boolean
	executeReassignment: () => Promise<void>

	// Computed
	bookingsToMove: BookingInfo[]
	totalPassengersToMove: number
	capacityWarning: CapacityWarning | null
	sourceEvent: SourceEventInfo | null
}

// --- Helper: extract source event info ---

function extractSourceEvent(event: ReassignableEvent | null): SourceEventInfo | null {
	if (!event) return null
	return {
		id: event.id,
		tourId: event.tourId ?? event.tour?.id ?? "",
		tourName: getEventDisplayName(event),
		date: event.date instanceof Date ? event.date : new Date(event.date),
	}
}

// --- Helper: extract booking info from event ---

function extractBookingInfo(event: ReassignableEvent, bookingId: string): BookingInfo | null {
	if (!event.bookings) return null
	const booking = event.bookings.find((b) => b.id === bookingId)
	if (!booking) return null
	return {
		id: booking.id,
		voucher: String(booking.saleRecord?.voucher ?? "???"),
		passengerCount: booking.passengerCount ?? 0,
	}
}

// --- Hook ---

export function useBookingReassignment({
	event,
}: UseBookingReassignmentParams): UseBookingReassignmentReturn {
	const queryClient = useQueryClient()

	// Multi-select state
	const [selectedBookingIds, setSelectedBookingIds] = useState<Set<string>>(new Set())
	const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)

	// Dialog state
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const [reassignmentMode, setReassignmentMode] = useState<ReassignmentMode>(
		REASSIGNMENT_MODE.SINGLE
	)
	const [dialogBookingIds, setDialogBookingIds] = useState<string[]>([])

	// Form state
	const [targetEventId, setTargetEventId] = useState("")
	const [reason, setReason] = useState("")
	const [forceOverbook, setForceOverbook] = useState(false)
	const [isReassigning, setIsReassigning] = useState(false)

	// Source event info
	const sourceEvent = useMemo(() => extractSourceEvent(event), [event])

	// --- React Query: fetch eligible target events ---
	const {
		data: availableEvents = [],
		isLoading: isLoadingEvents,
	} = useQuery({
		queryKey: ["eligible-target-events", sourceEvent?.tourId, sourceEvent?.id],
		queryFn: () =>
			sourceEvent
				? getFutureEventsForTour(sourceEvent.tourId, sourceEvent.id)
				: Promise.resolve([]),
		enabled: isDialogOpen && !!sourceEvent?.tourId,
	})

	// --- Computed: bookings to move ---
	const bookingsToMove = useMemo<BookingInfo[]>(() => {
		if (!event) return []
		return dialogBookingIds
			.map((id) => extractBookingInfo(event, id))
			.filter((b): b is BookingInfo => b !== null)
	}, [event, dialogBookingIds])

	const totalPassengersToMove = useMemo(
		() => bookingsToMove.reduce((sum, b) => sum + b.passengerCount, 0),
		[bookingsToMove]
	)

	// --- Computed: capacity warning ---
	const capacityWarning = useMemo<CapacityWarning | null>(() => {
		if (!targetEventId || totalPassengersToMove === 0) return null

		const targetEvent = availableEvents.find((e) => e.id === targetEventId)
		if (!targetEvent) return null

		const resultingBookings = targetEvent.currentBookings + totalPassengersToMove
		const exceeded = resultingBookings > targetEvent.maxCapacity

		if (!exceeded) return null

		return {
			exceeded: true,
			info: `Capacidad: ${targetEvent.currentBookings}/${targetEvent.maxCapacity} → ${resultingBookings}/${targetEvent.maxCapacity} (excede por ${resultingBookings - targetEvent.maxCapacity})`,
		}
	}, [targetEventId, totalPassengersToMove, availableEvents])

	// --- Multi-select methods ---

	const toggleMultiSelectMode = useCallback(() => {
		setIsMultiSelectMode((prev) => {
			if (prev) {
				// Exiting multi-select: clear selections
				setSelectedBookingIds(new Set())
			}
			return !prev
		})
	}, [])

	const toggleBookingSelection = useCallback((bookingId: string) => {
		setSelectedBookingIds((prev) => {
			const next = new Set(prev)
			if (next.has(bookingId)) {
				next.delete(bookingId)
			} else {
				next.add(bookingId)
			}
			return next
		})
	}, [])

	const selectAllBookings = useCallback((bookingIds: string[]) => {
		setSelectedBookingIds(new Set(bookingIds))
	}, [])

	const clearSelection = useCallback(() => {
		setSelectedBookingIds(new Set())
	}, [])

	// --- Dialog methods ---

	const resetFormState = useCallback(() => {
		setTargetEventId("")
		setReason("")
		setForceOverbook(false)
	}, [])

	const openReassignDialog = useCallback(
		(bookingId: string) => {
			setReassignmentMode(REASSIGNMENT_MODE.SINGLE)
			setDialogBookingIds([bookingId])
			resetFormState()
			setIsDialogOpen(true)
		},
		[resetFormState]
	)

	const openBulkReassignDialog = useCallback(() => {
		if (selectedBookingIds.size === 0) {
			toast.error("Seleccione al menos una reserva para reasignar")
			return
		}
		setReassignmentMode(REASSIGNMENT_MODE.BULK)
		setDialogBookingIds(Array.from(selectedBookingIds))
		resetFormState()
		setIsDialogOpen(true)
	}, [selectedBookingIds, resetFormState])

	const closeDialog = useCallback(() => {
		setIsDialogOpen(false)
		setDialogBookingIds([])
		resetFormState()
	}, [resetFormState])

	// --- Execution ---

	const executeReassignment = useCallback(async () => {
		if (!reason.trim()) {
			toast.error("Debe indicar el motivo de reasignación")
			return
		}

		if (!targetEventId) {
			toast.error("Debe seleccionar un evento destino")
			return
		}

		setIsReassigning(true)

		try {
			let result: MoveBookingResult | MoveBookingsResult

			if (reassignmentMode === REASSIGNMENT_MODE.SINGLE && dialogBookingIds.length === 1) {
				result = await moveBooking({
					bookingId: dialogBookingIds[0],
					targetEventId,
					reason: reason.trim(),
					force: forceOverbook,
				})
			} else {
				result = await moveBookings({
					bookingIds: dialogBookingIds,
					targetEventId,
					reason: reason.trim(),
					force: forceOverbook,
				})
			}

			if (result.success) {
				const count = dialogBookingIds.length
				const label = count === 1
					? `Reserva reasignada correctamente`
					: `${count} reservas reasignadas correctamente`

				toast.success(label)

				// Invalidate all affected queries
				await Promise.all([
					queryClient.invalidateQueries({ queryKey: ["event", sourceEvent?.id] }),
					queryClient.invalidateQueries({ queryKey: ["event", targetEventId] }),
					queryClient.invalidateQueries({ queryKey: ["events"] }),
					queryClient.invalidateQueries({ queryKey: ["event-audit-log"] }),
					queryClient.invalidateQueries({ queryKey: ["eligible-target-events"] }),
				])

				// Clean up state
				closeDialog()
				setSelectedBookingIds(new Set())
				setIsMultiSelectMode(false)
			} else if (result.capacityExceeded) {
				toast.error("Capacidad excedida. Active la opción de sobrecupo para continuar.")
			} else {
				toast.error(result.error || "Error al reasignar")
			}
		} catch {
			toast.error("Error inesperado al reasignar")
		} finally {
			setIsReassigning(false)
		}
	}, [
		reason,
		targetEventId,
		reassignmentMode,
		dialogBookingIds,
		forceOverbook,
		sourceEvent?.id,
		queryClient,
		closeDialog,
	])

	return {
		// Multi-select state
		selectedBookingIds,
		isMultiSelectMode,
		toggleMultiSelectMode,
		toggleBookingSelection,
		selectAllBookings,
		clearSelection,

		// Dialog state
		isDialogOpen,
		reassignmentMode,
		openReassignDialog,
		openBulkReassignDialog,
		closeDialog,

		// Form state
		targetEventId,
		setTargetEventId,
		reason,
		setReason,
		forceOverbook,
		setForceOverbook,

		// Available events
		availableEvents,
		isLoadingEvents,

		// Execution
		isReassigning,
		executeReassignment,

		// Computed
		bookingsToMove,
		totalPassengersToMove,
		capacityWarning,
		sourceEvent,
	}
}
