"use client"

import { CalendarCheck2, CalendarClock, Bus, FilterXIcon } from "lucide-react"
import { useCallback, useId, useMemo, useState } from "react"
import {
	addDays,
	addMonths,
	endOfMonth,
	endOfWeek,
	format,
	startOfMonth,
	startOfWeek,
	subDays,
	subMonths,
} from "date-fns"
import { es } from "date-fns/locale"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core"

import { CalendarViewHeader } from "./calendar-view-header"
import { CalendarMonthView } from "./calendar-month-view"
import { CalendarWeekView } from "./calendar-week-view"
import { CalendarDayView } from "./calendar-day-view"
import { ProviderScheduleView } from "./provider-schedule-view"
import { EventDetailPanel } from "./event-detail-panel"
import { GroupAssignmentPanel } from "./group-assignment-panel"
import { SelectionActionBar } from "./selection-action-bar"
import { BulkAssignmentDialog } from "./bulk-assignment-dialog"
import { AutoAssignPreviewDialog } from "./auto-assign-preview-dialog"
import { ProviderToolbar } from "./provider-toolbar"
import { DragOverlayContent } from "./drag-overlay-content"
import { ConflictWarningDialog } from "./conflict-warning-dialog"
import { CompletitudDashboard } from "./completitud-dashboard"
import { RescheduleConfirmDialog } from "./reschedule-confirm-dialog"
import { isAssignmentComplete } from "./event-detail-utils"
import { calendarDayKey, formatCalendarDay, todayInSantiago } from "@/shared/utils/calendar-day"
import { filterEvents } from "../utils/export-filters"
import { buildExportFilename, generatePdf } from "../utils/export-utils"
import { generateExcel } from "../utils/export-excel"
import { parseDroppableId } from "../utils/droppable-id"
import { computeReschedulePreview } from "../hooks/use-reschedule-preview"
import type { ExportScope } from "../utils/export-filters"
import type { ExportFormat } from "../utils/export-utils"
import { DashboardStatCard } from "@/shared/components/ui/dashboard-stat-card"
import { TableFilterDropdown } from "@/shared/components/ui/table-filter-dropdown"
import { MultiSelect } from "@/project/analytics/components/multi-select"
import { Button } from "@/shared/components/ui/button"
import { Switch } from "@/shared/components/ui/switch"
import { Label } from "@/shared/components/ui/label"
import { SALE_MODE } from "@/generated/prisma/enums"

import { useProviders } from "@/project/providers/hooks/use-providers"
import { updateEvent } from "@/project/events/actions/event.actions"
import type { UpdateEventSchema } from "@/project/events/schemas/update-event.schema"
import {
	ProviderAssignmentProvider,
	useProviderAssignment,
} from "../context/provider-assignment-context"
import { useEventSelection } from "../hooks/use-event-selection"
import { useConflictDetection } from "../hooks/use-conflict-detection"
import { useCompletitudMetrics } from "../hooks/use-completitud-metrics"
import { useAutoAssignment } from "../hooks/use-auto-assignment"
// NOTE: Vista agrupada deshabilitada. El hook y toda la lógica de agrupación
// (use-grouped-toggle, buildTourSummaryRows, TourSummaryGroupCard,
// GroupAssignmentPanel, exports agrupados) siguen en el código por si se
// necesita retomar. Para revivir: descomentar este import y restaurar el
// estado `isGrouped` con useGroupedToggle más abajo.
// import { useGroupedToggle } from "../hooks/use-grouped-toggle"
import { VIEW_MODE, ASSIGNMENT_FILTER } from "../types/calendar.types"
import type { CalendarViewEvent, ViewMode, AssignmentFilterValue } from "../types/calendar.types"
import type { DragProviderData, DragPayload, ConflictInfo } from "../types/provider-assignment.types"
import type { CollapsedGroupRow } from "../utils/tour-summary-groups"
import type { PassengerConflict, ProviderConflictSummary } from "@/project/events/schemas/reschedule-event.schema"
import type { AffectedVoucher } from "../hooks/use-reschedule-preview"
import { getEventDisplayName } from "@/project/events/utils/event-display"

interface CalendarPageContentProps {
	events: CalendarViewEvent[]
}

export function CalendarPageContent({ events }: CalendarPageContentProps) {
	return (
		<ProviderAssignmentProvider>
			<CalendarPageInner events={events} />
		</ProviderAssignmentProvider>
	)
}

function CalendarPageInner({ events }: CalendarPageContentProps) {
	const router = useRouter()

	// --- View mode state ---
	const [viewMode, setViewMode] = useState<ViewMode>(VIEW_MODE.MONTH)
	const [selectedDate, setSelectedDate] = useState<Date>(new Date())

	// --- Grouped toggle (DESHABILITADO) ---
	// La vista agrupada se forzó a OFF. Para revivirla: descomentar el import de
	// useGroupedToggle, restaurar la línea de abajo y volver a pasar
	// `onGroupedChange={setIsGrouped}` al CalendarViewHeader (ver más abajo).
	// const [isGrouped, setIsGrouped] = useGroupedToggle()
	const isGrouped = false

	// --- Dialog state (lifted from old CalendarView) ---
	const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
	const [isDialogOpen, setIsDialogOpen] = useState(false)

	// --- Bulk assignment dialog state (selection-mode toolbar only) ---
	const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)

	// --- Tour summary bulk prefill state (for selection-mode toolbar BulkAssignmentDialog) ---
	const [bulkPrefillIds, setBulkPrefillIds] = useState<string[] | null>(null)
	const [bulkRoleScope, setBulkRoleScope] = useState<"all" | "transfer">("all")

	// --- Group assignment panel state (for grouped-card "Asignar" button) ---
	const [groupAssignTarget, setGroupAssignTarget] = useState<CollapsedGroupRow | null>(null)
	const [isGroupPanelOpen, setIsGroupPanelOpen] = useState(false)

	// --- Auto-assign dialog state ---
	const [isAutoAssignDialogOpen, setIsAutoAssignDialogOpen] = useState(false)

	// --- Filter state ---
	const [serviceFilter, setServiceFilter] = useState<string>("all")
	const [modeFilter, setModeFilter] = useState<string>("all")
	const [tourFilter, setTourFilter] = useState<string[]>([])
	const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilterValue>(
		ASSIGNMENT_FILTER.ALL
	)
	const [activeVouchersOnly, setActiveVouchersOnly] = useState(false)

	// --- Drag & Drop state ---
	const [activeDragData, setActiveDragData] = useState<DragPayload | null>(null)
	const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
	const [pendingConflicts, setPendingConflicts] = useState<ConflictInfo[]>([])
	const [pendingDropAssignment, setPendingDropAssignment] = useState<{
		eventId: string
		providerData: DragProviderData
	} | null>(null)

	// --- Reschedule dialog state ---
	const [isRescheduleDialogOpen, setIsRescheduleDialogOpen] = useState(false)
	const [pendingReschedule, setPendingReschedule] = useState<{
		originEvent: CalendarViewEvent
		destination: { date: Date; startTime?: string; endTime?: string }
		passengerConflicts: PassengerConflict[]
		providerConflicts: ProviderConflictSummary[]
		affectedVouchers: AffectedVoucher[]
		hasAssociatedTransfers: boolean
	} | null>(null)

	// --- Provider assignment context ---
	const { state: assignmentState, dispatch } = useProviderAssignment()

	// --- Selection ---
	const {
		isSelectionMode,
		selectedEventIds,
		selectedCount,
		toggleSelectionMode,
		toggleSelection,
		clearSelection,
	} = useEventSelection()

	// --- Providers ---
	const { data: providers } = useProviders()

	// --- Conflict detection ---
	const { conflictingEventIds, checkConflict } = useConflictDetection(events)

	// --- DnD Sensors ---
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 8,
			},
		})
	)

	// --- Tour options for MultiSelect ---
	const tourOptions = useMemo(() => {
		const tourNames = new Set(events.map((event) => getEventDisplayName(event)))
		return Array.from(tourNames)
			.sort()
			.map((name) => ({ label: name, value: name }))
	}, [events])

	// --- Active voucher saleRecordIds (have at least one event from today onwards) ---
	const activeSaleRecordIds = useMemo(() => {
		if (!activeVouchersOnly) return null
		const todayKey = calendarDayKey(todayInSantiago())
		const ids = new Set<string>()
		for (const event of events) {
			if (calendarDayKey(event.date as Date) >= todayKey) {
				for (const booking of event.bookings ?? []) {
					ids.add(booking.saleRecordId)
				}
			}
		}
		return ids
	}, [events, activeVouchersOnly])

	const switchId = useId()

	// --- Filtered events ---
	const filteredEvents = useMemo(
		() =>
			events.filter((event) => {
				if (serviceFilter !== "all" && event.serviceKind !== serviceFilter) {
					return false
				}

				if (modeFilter !== "all") {
					if (modeFilter === SALE_MODE.PRIVATE && event.mode !== SALE_MODE.PRIVATE) {
						return false
					}

					if (modeFilter === SALE_MODE.REGULAR && event.mode !== SALE_MODE.REGULAR) {
						return false
					}
				}

				if (tourFilter.length > 0 && !tourFilter.includes(getEventDisplayName(event))) {
					return false
				}

				if (assignmentFilter !== ASSIGNMENT_FILTER.ALL) {
					const complete = isAssignmentComplete(event)
					if (assignmentFilter === ASSIGNMENT_FILTER.COMPLETE && !complete) return false
					if (assignmentFilter === ASSIGNMENT_FILTER.ANY_MISSING && complete) return false
					if (
						assignmentFilter === ASSIGNMENT_FILTER.MISSING_GUIDE &&
						(!!event.guideId || event.serviceKind === "TRANSFER")
					)
						return false
					if (assignmentFilter === ASSIGNMENT_FILTER.MISSING_DRIVER && !!event.driverId)
						return false
					if (assignmentFilter === ASSIGNMENT_FILTER.MISSING_VEHICLE && !!event.vehicleId)
						return false
				}

				if (activeSaleRecordIds) {
					const hasActiveVoucher = event.bookings?.some((booking) =>
						activeSaleRecordIds.has(booking.saleRecordId)
					)
					if (!hasActiveVoucher) return false
				}

				return true
			}),
		[events, serviceFilter, modeFilter, tourFilter, assignmentFilter, activeSaleRecordIds]
	)

	// --- Events visible in the current view (day/week/month) ---
	const viewFilteredEvents = useMemo(() => {
		return filteredEvents.filter((event) => {
			// event.date is @db.Date (UTC midnight); selectedDate is local-midnight from the widget.
			// Compare as yyyy-MM-dd strings to avoid cross-timezone date mismatches on client.
			const eventKey = calendarDayKey(event.date as Date)
			if (viewMode === VIEW_MODE.DAY) {
				return eventKey === format(selectedDate, "yyyy-MM-dd")
			}
			if (viewMode === VIEW_MODE.WEEK || viewMode === VIEW_MODE.PROVIDER) {
				const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
				const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 })
				return eventKey >= format(weekStart, "yyyy-MM-dd") && eventKey <= format(weekEnd, "yyyy-MM-dd")
			}
			// MONTH: show all events in the current month range
			const monthStart = startOfMonth(selectedDate)
			const monthEnd = endOfMonth(selectedDate)
			return eventKey >= format(monthStart, "yyyy-MM-dd") && eventKey <= format(monthEnd, "yyyy-MM-dd")
		})
	}, [filteredEvents, viewMode, selectedDate])

	// --- Auto-assignment suggestions (scoped to visible view, all events for conflict check) ---
	const { getEventSuggestions, getAlternativesForEvent, generateBulkPlan } = useAutoAssignment(
		viewFilteredEvents,
		providers,
		{},
		events
	)

	const viewLabel =
		viewMode === VIEW_MODE.DAY ? "hoy" : viewMode === VIEW_MODE.MONTH ? "este mes" : "esta semana"

	// --- Stats (single-pass per array) ---
	const viewStats = useMemo(() => {
		let passengers = 0,
			transfers = 0,
			privates = 0
		for (const event of viewFilteredEvents) {
			passengers += event.bookings?.reduce((sum, b) => sum + b.passengerCount, 0) ?? 0
			if (event.serviceKind === "TRANSFER") transfers++
			if (event.mode === SALE_MODE.PRIVATE) privates++
		}
		return { passengers, transfers, privates }
	}, [viewFilteredEvents])

	const allStats = useMemo(() => {
		let passengers = 0,
			transfers = 0,
			privates = 0
		for (const event of filteredEvents) {
			passengers += event.bookings?.reduce((sum, b) => sum + b.passengerCount, 0) ?? 0
			if (event.serviceKind === "TRANSFER") transfers++
			if (event.mode === SALE_MODE.PRIVATE) privates++
		}
		return { passengers, transfers, privates }
	}, [filteredEvents])
	const hasActiveNonDateFilters =
		serviceFilter !== "all" ||
		modeFilter !== "all" ||
		tourFilter.length > 0 ||
		assignmentFilter !== ASSIGNMENT_FILTER.ALL ||
		activeVouchersOnly

	// --- Has unassigned events (for auto-assign button) ---
	const hasUnassignedEvents = useMemo(
		() => filteredEvents.some((event) => !isAssignmentComplete(event)),
		[filteredEvents]
	)

	// --- Auto-assign bulk plan (computed lazily when dialog opens) ---
	const [autoAssignPlan, setAutoAssignPlan] = useState<ReturnType<typeof generateBulkPlan> | null>(
		null
	)
	const [isAutoAssignLoading, setIsAutoAssignLoading] = useState(false)

	const handleAutoAssign = useCallback(() => {
		if (!hasUnassignedEvents) {
			toast.info("Todos los eventos ya tienen asignación completa")
			return
		}
		// Open dialog first with loading state, then compute plan on next tick
		setIsAutoAssignLoading(true)
		setAutoAssignPlan(null)
		setIsAutoAssignDialogOpen(true)
		requestAnimationFrame(() => {
			const plan = generateBulkPlan()
			setAutoAssignPlan(plan)
			setIsAutoAssignLoading(false)
		})
	}, [hasUnassignedEvents, generateBulkPlan])

	const handleAutoAssignDialogChange = useCallback((open: boolean) => {
		setIsAutoAssignDialogOpen(open)
		if (!open) setAutoAssignPlan(null)
	}, [])

	// --- Completitud metrics ---
	const completitudMetrics = useCompletitudMetrics(filteredEvents)


	// --- Tours for export dropdown (unique tour names in selected day) ---
	// React Compiler handles memoization automatically — no useMemo needed
	const selectedDayKey = format(selectedDate, "yyyy-MM-dd")
	const toursForDayMap = new Map<string, string>()
	for (const e of filteredEvents) {
		if (calendarDayKey(e.date as Date) === selectedDayKey) {
			const displayName = getEventDisplayName(e)
			toursForDayMap.set(displayName, displayName)
		}
	}
	const toursForDay = Array.from(toursForDayMap.entries()).map(([name]) => ({ id: name, name }))

	// --- Export handler ---
	const handleExport = async (scope: ExportScope, fmt: ExportFormat): Promise<void> => {
		const grouped = isGrouped
		const pool = scope.kind === "selection" ? events : filteredEvents
		const filtered = filterEvents(pool, scope)

		if (filtered.length === 0) {
			toast.error("Sin eventos para exportar")
			return
		}

		// For selection scope, derive filename from first event's date
		const filename = (() => {
			if (scope.kind === "selection" && filtered.length > 0) {
				const dateStr = calendarDayKey(filtered[0].date as Date)
				return `control-salidas_seleccion_${dateStr}.${fmt === "pdf" ? "pdf" : "xlsx"}`
			}
			return buildExportFilename({ scope, format: fmt })
		})()

		const totalPassengers = filtered.reduce(
			(sum, e) => sum + (e.bookings?.reduce((s, b) => s + b.passengerCount, 0) ?? 0),
			0
		)

		const scopeLabel = (() => {
			switch (scope.kind) {
				case "day":
					return `Día actual — ${formatCalendarDay(scope.date, "dd/MM/yyyy")}`
				case "tour":
					return `Tour ${scope.tourName} — ${formatCalendarDay(scope.date, "dd/MM/yyyy")}`
				case "provider-type": {
					const label =
						scope.providerType === "guide"
							? "Guías"
							: scope.providerType === "driver"
								? "Conductores"
								: "Vehículos"
					return `${label} — ${formatCalendarDay(scope.date, "dd/MM/yyyy")}`
				}
				case "selection":
					return "Selección"
			}
		})()

		const dateLabel =
			scope.kind !== "selection"
				? format(
						// UTC-reconstruct: avoid runtime-tz shift on the @db.Date value
						new Date(scope.date.getUTCFullYear(), scope.date.getUTCMonth(), scope.date.getUTCDate()),
						"EEEE d 'de' MMMM yyyy",
						{ locale: es },
					)
				: filtered.length > 0
					? format(
							// UTC-reconstruct: avoid runtime-tz shift on the @db.Date value
							new Date(
								(filtered[0].date as Date).getUTCFullYear(),
								(filtered[0].date as Date).getUTCMonth(),
								(filtered[0].date as Date).getUTCDate(),
							),
							"EEEE d 'de' MMMM yyyy",
							{ locale: es },
						)
					: ""

		if (fmt === "pdf") {
			toast.promise(generatePdf({ events: filtered, filename, date: dateLabel, totalPassengers, grouped }), {
				loading: "Generando archivo...",
				success: "Archivo descargado",
				error: "Error al generar archivo",
			})
		} else {
			toast.promise(generateExcel({ events: filtered, filename, scopeLabel, grouped }), {
				loading: "Generando archivo...",
				success: "Archivo descargado",
				error: "Error al generar archivo",
			})
		}
	}

	// --- Navigation callbacks ---
	const handlePrev = () => {
		if (viewMode === VIEW_MODE.MONTH) setSelectedDate((d) => subMonths(d, 1))
		if (viewMode === VIEW_MODE.WEEK || viewMode === VIEW_MODE.PROVIDER)
			setSelectedDate((d) => subDays(d, 7))
		if (viewMode === VIEW_MODE.DAY) setSelectedDate((d) => subDays(d, 1))
	}

	const handleNext = () => {
		if (viewMode === VIEW_MODE.MONTH) setSelectedDate((d) => addMonths(d, 1))
		if (viewMode === VIEW_MODE.WEEK || viewMode === VIEW_MODE.PROVIDER)
			setSelectedDate((d) => addDays(d, 7))
		if (viewMode === VIEW_MODE.DAY) setSelectedDate((d) => addDays(d, 1))
	}

	const handleToday = () => setSelectedDate(new Date())

	const handleViewModeChange = (mode: ViewMode) => {
		setViewMode(mode)
		// Exit selection mode when switching to provider view
		if (mode === VIEW_MODE.PROVIDER && isSelectionMode) {
			toggleSelectionMode()
		}
	}

	// --- Clear all filters ---
	const handleClearFilters = useCallback(() => {
		setServiceFilter("all")
		setModeFilter("all")
		setTourFilter([])
		setAssignmentFilter(ASSIGNMENT_FILTER.ALL)
		setActiveVouchersOnly(false)
	}, [])

	// --- Bulk assignment success ---
	const handleBulkAssignSuccess = () => {
		clearSelection()
		if (isSelectionMode) {
			toggleSelectionMode()
		}
		// Reset prefill state after tour-summary bulk assign closes
		setBulkPrefillIds(null)
		setBulkRoleScope("all")
	}

	// --- Group-card assign routing ---
	// Single-event group → reuse existing EventDetailPanel
	// Multi-event group → open GroupAssignmentPanel
	const handleGroupAssign = (row: CollapsedGroupRow) => {
		if (row.eventIds.length === 1) {
			handleEventClick(row.eventIds[0])
		} else {
			setGroupAssignTarget(row)
			setIsGroupPanelOpen(true)
		}
	}

	const handleGroupPanelClose = () => {
		setIsGroupPanelOpen(false)
		setGroupAssignTarget(null)
	}

	const handleGroupPanelSaved = () => {
		router.refresh()
		handleGroupPanelClose()
	}

	// --- Event/dialog callbacks ---
	const handleEventClick = (eventId: string) => {
		setSelectedEventId(eventId)
		setIsDialogOpen(true)
	}

	const handleCloseDialog = () => {
		setIsDialogOpen(false)
		setSelectedEventId(null)
	}

	const handleDayClick = (date: Date) => {
		setSelectedDate(date)
		setViewMode(VIEW_MODE.DAY)
	}

	// --- Toolbar toggle ---
	const handleToggleToolbar = useCallback(() => {
		dispatch({ type: "TOGGLE_TOOLBAR" })
	}, [dispatch])

	// --- DnD Handlers ---

	const handleDragStart = useCallback((event: DragStartEvent) => {
		const data = event.active.data.current as DragPayload | undefined
		if (data) {
			setActiveDragData(data)
		}
	}, [])

	const processAssignment = useCallback(
		async (eventId: string, providerData: DragProviderData) => {
			const targetEvent = events.find((e) => e.id === eventId)
			if (!targetEvent) return

			// Build update payload based on provider role
			const updateData: UpdateEventSchema = {
				isCompleted: targetEvent.status === "CONFIRMED",
			}

			if (providerData.providerType === "guide") {
				updateData.guideId = providerData.providerId
				updateData.guideCost = providerData.defaultCost
			} else if (providerData.providerType === "driver") {
				updateData.driverId = providerData.providerId
				updateData.driverCost = providerData.defaultCost
			} else if (providerData.providerType === "vehicle") {
				updateData.vehicleId = providerData.providerId
				updateData.vehicleCost = providerData.defaultCost
			}

			const assignmentPromise = (async () => {
				const result = await updateEvent(eventId, updateData)
				if (!result.success) {
					throw new Error(result.error ?? "Error al asignar proveedor")
				}

				// Check vehicle capacity warning
				if (providerData.providerType === "vehicle") {
					const vehicleProvider = providers?.find((p) => p.id === providerData.providerId)
					const eventPassengers =
						targetEvent.bookings?.reduce((sum, b) => sum + b.passengerCount, 0) ?? 0

					if (
						vehicleProvider?.vehicleCapacity != null &&
						eventPassengers > 0 &&
						vehicleProvider.vehicleCapacity < eventPassengers
					) {
						router.refresh()
						return `${providerData.providerName} asignado a ${getEventDisplayName(targetEvent)}. Advertencia: capacidad (${vehicleProvider.vehicleCapacity}) menor que pasajeros (${eventPassengers})`
					}
				}

				router.refresh()
				return `${providerData.providerName} asignado a ${getEventDisplayName(targetEvent)}`
			})()

			toast.promise(assignmentPromise, {
				loading: `Asignando ${providerData.providerName} a ${getEventDisplayName(targetEvent)}...`,
				success: (message) => message,
				error: (err) => (err instanceof Error ? err.message : "Error al asignar proveedor"),
			})

			assignmentPromise
				.then(() => {
					const provider = providers?.find((p) => p.id === providerData.providerId)
					if (!provider) return

					const canBeDriver = Boolean(provider.conductor || provider.conductorMaquina)
					const canBeGuide = Boolean(provider.guia)
					const isTransfer = targetEvent.serviceKind === "TRANSFER"

					let suggestion:
						| { label: string; role: "guide" | "driver"; costField: "guideCost" | "driverCost"; idField: "guideId" | "driverId" }
						| null = null

					if (
						providerData.providerType === "guide" &&
						canBeDriver &&
						!targetEvent.driverId
					) {
						suggestion = {
							label: "Conductor",
							role: "driver",
							costField: "driverCost",
							idField: "driverId",
						}
					} else if (
						providerData.providerType === "driver" &&
						canBeGuide &&
						!targetEvent.guideId &&
						!isTransfer
					) {
						suggestion = {
							label: "Guía",
							role: "guide",
							costField: "guideCost",
							idField: "guideId",
						}
					}

					if (!suggestion) return

					const finalSuggestion = suggestion
					toast(
						`${providerData.providerName} también puede trabajar como ${finalSuggestion.label.toLowerCase()}`,
						{
							description: `¿Asignar también como ${finalSuggestion.label}?`,
							duration: 8000,
							action: {
								label: `Asignar como ${finalSuggestion.label}`,
								onClick: () => {
									const followUp: UpdateEventSchema = {
										isCompleted: targetEvent.status === "CONFIRMED",
										[finalSuggestion.idField]: providerData.providerId,
										[finalSuggestion.costField]: providerData.defaultCost,
									}
									toast.promise(
										(async () => {
											const result = await updateEvent(targetEvent.id, followUp)
											if (!result.success) {
												throw new Error(result.error ?? "Error al asignar proveedor")
											}
											router.refresh()
											return `${providerData.providerName} asignado también como ${finalSuggestion.label}`
										})(),
										{
											loading: `Asignando como ${finalSuggestion.label}...`,
											success: (message) => message,
											error: (err) =>
												err instanceof Error ? err.message : "Error al asignar proveedor",
										}
									)
								},
							},
						}
					)
				})
				.catch(() => {
					// primary assignment failed; toast.promise already shows the error
				})
		},
		[events, providers, router]
	)

	const handleDragEnd = useCallback(
		(event: DragEndEvent) => {
			setActiveDragData(null)

			const { active, over } = event
			if (!over) return

			const dragData = active.data.current as DragPayload | undefined
			if (!dragData) return

			// --- Provider drag (existing path — UNCHANGED) ---
			if (dragData.kind === "provider") {
				const providerData = dragData
				const dropData = over.data.current as
					| { eventId?: string; event?: CalendarViewEvent }
					| undefined

				if (!providerData.providerId || !dropData?.eventId || !dropData?.event) return

				const targetEvent = dropData.event

				// Validate drop: guide can NOT be dropped on TRANSFER
				if (providerData.providerType === "guide" && targetEvent.serviceKind === "TRANSFER") {
					toast.error("No se puede asignar un guía a un evento de transfer")
					return
				}

				// Check if already assigned
				if (
					(providerData.providerType === "guide" &&
						targetEvent.guideId === providerData.providerId) ||
					(providerData.providerType === "driver" &&
						targetEvent.driverId === providerData.providerId) ||
					(providerData.providerType === "vehicle" &&
						targetEvent.vehicleId === providerData.providerId)
				) {
					toast.info("Este proveedor ya está asignado a este evento")
					return
				}

				// Check for conflicts
				const conflict = checkConflict(providerData.providerId, targetEvent)

				if (conflict) {
					const provider = providers?.find((p) => p.id === providerData.providerId)
					const enrichedConflict: ConflictInfo = {
						...conflict,
						providerName: provider?.fullName ?? provider?.companyName ?? providerData.providerName,
						providerType: providerData.providerType,
					}
					setPendingConflicts([enrichedConflict])
					setPendingDropAssignment({
						eventId: dropData.eventId,
						providerData,
					})
					setConflictDialogOpen(true)
					return
				}

				processAssignment(dropData.eventId, providerData)
				return
			}

			// --- Event drag (reschedule path) ---
			if (dragData.kind === "event") {
				const overTarget = parseDroppableId(String(over.id))

				// Unknown target → no-op
				if (!overTarget) return

				// Drop on another event card → fall through to its day
				// (event cards are droppable for provider assignment and may occlude day cells)
				type DayOrHourTarget = Extract<typeof overTarget, { kind: "day" | "hour" }>
				let resolvedTarget: DayOrHourTarget
				if (overTarget.kind === "event") {
					// Self-drop → no-op
					if (overTarget.eventId === dragData.event.id) {
						toast.info("El evento ya está en ese horario")
						return
					}
					const targetEvent = events.find((e) => e.id === overTarget.eventId)
					if (!targetEvent) return
					// Build a synthetic "day" target from the event's date (UTC-safe)
					const targetDateStr = calendarDayKey(targetEvent.date as Date)
					resolvedTarget = { kind: "day" as const, date: targetDateStr }
				} else {
					resolvedTarget = overTarget
				}

				// Parse destination date using local-midnight constructor to avoid UTC-offset shift
				const [y, m, d] = resolvedTarget.date.split("-").map(Number)
				const destDate = new Date(y, m - 1, d, 0, 0, 0, 0)

				// Past-date guard (R-C9 fallback) — compare in Santiago calendar space
				if (resolvedTarget.date < calendarDayKey(todayInSantiago())) {
					toast.error("No se puede reagendar a una fecha pasada")
					return
				}

				const originEvent = dragData.event
				const destStart = resolvedTarget.kind === "hour" ? resolvedTarget.time : originEvent.startTime ?? undefined
				const destEnd = resolvedTarget.kind === "hour" ? undefined : originEvent.endTime ?? undefined

				// No-op: same day + same time — use calendarDayKey for UTC-safe comparison
				const originDateStr = calendarDayKey(originEvent.date as Date)
				const destDateStr = resolvedTarget.date
				if (originDateStr === destDateStr && (originEvent.startTime ?? undefined) === destStart) {
					toast.info("El evento ya está en ese horario")
					return
				}

				const destination = { date: destDate, startTime: destStart, endTime: destEnd }

				// Compute preview inline — pure function, no async, uses already-loaded events
				const preview = computeReschedulePreview(events, originEvent.id, destination)

				// Client-side provider conflict detection at destination
				// Build a synthetic CalendarViewEvent at the destination date/time so checkConflict
				// can look up the in-memory index. We reuse originEvent.id so the index skips self.
				const syntheticTarget: CalendarViewEvent = {
					...originEvent,
					date: destDate,
					startTime: destStart ?? null,
					endTime: destEnd ?? null,
				}
				const roleMap: Record<string, ProviderConflictSummary["role"]> = {
					guide: "Guía",
					driver: "Conductor",
					vehicle: "Vehículo",
				}
				const providerSlots: Array<{ id: string | null; role: ProviderConflictSummary["role"]; name: string | null }> = [
					{
						id: originEvent.guideId,
						role: "Guía",
						name: originEvent.guide?.fullName ?? null,
					},
					{
						id: originEvent.driverId,
						role: "Conductor",
						name: originEvent.driver?.fullName ?? null,
					},
					{
						id: originEvent.vehicleId,
						role: "Vehículo",
						name: originEvent.vehicle
							? [originEvent.vehicle.vehicleBrand, originEvent.vehicle.vehicleModel, originEvent.vehicle.vehiclePlate ? `(${originEvent.vehicle.vehiclePlate})` : null]
									.filter(Boolean)
									.join(" ") || null
							: null,
					},
				]
				const clientProviderConflicts: ProviderConflictSummary[] = []
				for (const slot of providerSlots) {
					if (!slot.id) continue
					const conflict = checkConflict(slot.id, syntheticTarget)
					if (conflict) {
						clientProviderConflicts.push({
							role: slot.role ?? roleMap[conflict.providerType] ?? "Guía",
							providerName: slot.name ?? slot.id,
							conflictingEventId: conflict.conflictingEvent.id,
							conflictingTourName: conflict.conflictingEvent.tourName,
						})
					}
				}

				const reschedulePreviewData = {
					passengerConflicts: preview.passengerConflicts,
					providerConflicts: clientProviderConflicts,
					affectedVouchers: preview.affectedVouchers,
					hasAssociatedTransfers: preview.hasAssociatedTransfers,
				}

				setPendingReschedule({
					originEvent,
					destination,
					...reschedulePreviewData,
				})
				setIsRescheduleDialogOpen(true)
			}
		},
		[checkConflict, providers, processAssignment, events]
	)

	const handleConflictConfirm = useCallback(() => {
		if (pendingDropAssignment) {
			processAssignment(pendingDropAssignment.eventId, pendingDropAssignment.providerData)
		}
		setConflictDialogOpen(false)
		setPendingConflicts([])
		setPendingDropAssignment(null)
	}, [pendingDropAssignment, processAssignment])

	const handleConflictCancel = useCallback(() => {
		setConflictDialogOpen(false)
		setPendingConflicts([])
		setPendingDropAssignment(null)
	}, [])

	// --- Filter groups ---
	const filterGroups = [
		{
			key: "service",
			label: "Servicio",
			value: serviceFilter,
			allLabel: "Todos los servicios",
			options: [
				{ label: "Tours", value: "TOUR" },
				{ label: "Transfers", value: "TRANSFER" },
			],
			onChange: (value: string) => setServiceFilter(value),
		},
		{
			key: "mode",
			label: "Modalidad",
			value: modeFilter,
			allLabel: "Todas las modalidades",
			options: [
				{ label: "Privado", value: SALE_MODE.PRIVATE },
				{ label: "Regular", value: SALE_MODE.REGULAR },
			],
			onChange: (value: string) => setModeFilter(value),
		},
		{
			key: "assignment",
			label: "Asignación",
			value: assignmentFilter,
			allLabel: "Todos",
			options: [
				{ label: "Asignación completa", value: ASSIGNMENT_FILTER.COMPLETE },
				{ label: "Asignación incompleta", value: ASSIGNMENT_FILTER.ANY_MISSING },
				{ label: "Sin guía", value: ASSIGNMENT_FILTER.MISSING_GUIDE },
				{ label: "Sin chofer", value: ASSIGNMENT_FILTER.MISSING_DRIVER },
				{ label: "Sin vehículo", value: ASSIGNMENT_FILTER.MISSING_VEHICLE },
			],
			onChange: (value: string) => setAssignmentFilter(value as AssignmentFilterValue),
		},
	]

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Calendario de Operaciones</h1>
					<p className="text-muted-foreground mt-1">
						Muestra los eventos programados en el calendario interactivo
					</p>
				</div>

				<div className="flex flex-wrap items-center justify-end gap-2">
					<div className="flex items-center gap-2">
						<Switch
							id={switchId}
							size="sm"
							checked={activeVouchersOnly}
							onCheckedChange={setActiveVouchersOnly}
						/>
						<Label htmlFor={switchId} className="cursor-pointer text-sm whitespace-nowrap">
							Vouchers activos
						</Label>
					</div>
					<MultiSelect
						options={tourOptions}
						selected={tourFilter}
						onChange={setTourFilter}
						placeholder="Filtrar por tour..."
						className="min-h-8 w-[250px]"
					/>
					<TableFilterDropdown groups={filterGroups} onClearAll={handleClearFilters} />
					{hasActiveNonDateFilters ? (
						<Button variant="outline" size="sm" onClick={handleClearFilters} className="gap-2">
							<FilterXIcon className="h-4 w-4" />
							Limpiar
						</Button>
					) : null}
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<DashboardStatCard
					title="Eventos"
					value={viewFilteredEvents.length}
					description={`Total con filtros: ${filteredEvents.length} · Vista: ${viewLabel}`}
					icon={CalendarCheck2}
					iconClassName="text-orange-600 dark:text-orange-300"
					iconWrapperClassName="bg-primary/30"
				/>
				<DashboardStatCard
					title="Pasajeros estimados"
					value={viewStats.passengers}
					description={`Total con filtros: ${allStats.passengers}`}
					icon={CalendarClock}
					iconClassName="text-sky-600 dark:text-sky-300"
					iconWrapperClassName="bg-sky-500/30"
				/>
				<DashboardStatCard
					title="Transfers"
					value={viewStats.transfers}
					description={`Total con filtros: ${allStats.transfers}`}
					icon={Bus}
					iconClassName="text-violet-600 dark:text-violet-300"
					iconWrapperClassName="bg-violet-500/30"
				/>
				<DashboardStatCard
					title="Privados"
					value={viewStats.privates}
					description={`Total con filtros: ${allStats.privates}`}
					icon={CalendarCheck2}
					iconClassName="text-emerald-600 dark:text-emerald-300"
					iconWrapperClassName="bg-emerald-500/30"
				/>
			</div>

			{/*<CompletitudDashboard metrics={completitudMetrics} onEventClick={handleEventClick} />*/}

			<DndContext
				sensors={sensors}
				autoScroll={false}
				onDragStart={handleDragStart}
				onDragEnd={handleDragEnd}
			>
				<div className="flex gap-4">
					{/* Provider Toolbar (left side) */}
					<ProviderToolbar
						isOpen={assignmentState.isToolbarOpen}
						onToggle={handleToggleToolbar}
						providers={providers}
					/>

					{/* Calendar area */}
					<div className="min-w-0 flex-1 space-y-4">
						<CalendarViewHeader
							viewMode={viewMode}
							selectedDate={selectedDate}
							onPrev={handlePrev}
							onNext={handleNext}
							onToday={handleToday}
							onViewModeChange={handleViewModeChange}
							isSelectionMode={isSelectionMode}
							onToggleSelectionMode={toggleSelectionMode}
							onExport={handleExport}
							toursForDay={toursForDay}
							onAutoAssign={handleAutoAssign}
							hasUnassignedEvents={hasUnassignedEvents}
							grouped={isGrouped}
							// onGroupedChange omitido: oculta el switch "Agrupado" del header.
							// Para revivir la vista agrupada: onGroupedChange={setIsGrouped}
						/>

						<div className="flex flex-wrap items-center gap-4 text-sm">
							<div className="flex items-center gap-1.5">
								<span className="inline-block h-3 w-3 rounded-sm border border-blue-200 bg-blue-100 dark:border-blue-500/50 dark:bg-blue-500/20" />
								<span className="text-muted-foreground">Tour Regular</span>
							</div>
							<div className="flex items-center gap-1.5">
								<span className="inline-block h-3 w-3 rounded-sm border border-green-200 bg-green-100 dark:border-green-500/50 dark:bg-green-500/20" />
								<span className="text-muted-foreground">Tour Privado</span>
							</div>
							<div className="flex items-center gap-1.5">
								<span className="inline-block h-3 w-3 rounded-sm border border-purple-200 bg-purple-100 dark:border-purple-500/50 dark:bg-purple-500/20" />
								<span className="text-muted-foreground">Transfer</span>
							</div>
							<div className="flex items-center gap-1.5">
								<span className="inline-block h-3 w-3 rounded-sm border border-gray-300 bg-gray-100 dark:border-gray-500/40 dark:bg-gray-500/15" />
								<span className="text-muted-foreground">Anulados</span>
							</div>
						</div>

						{viewMode === VIEW_MODE.MONTH && (
							<CalendarMonthView
								events={filteredEvents}
								selectedDate={selectedDate}
								onEventClick={handleEventClick}
								onDayClick={handleDayClick}
								conflictingEventIds={conflictingEventIds}
								isSelectionMode={isSelectionMode}
								selectedEventIds={selectedEventIds}
								onSelectEvent={toggleSelection}
								grouped={isGrouped}
								onGroupAssign={handleGroupAssign}
							/>
						)}

						{viewMode === VIEW_MODE.WEEK && (
							<CalendarWeekView
								events={filteredEvents}
								selectedDate={selectedDate}
								onEventClick={handleEventClick}
								onDayClick={(date) => setSelectedDate(date)}
								conflictingEventIds={conflictingEventIds}
								isSelectionMode={isSelectionMode}
								selectedEventIds={selectedEventIds}
								onSelectEvent={toggleSelection}
								grouped={isGrouped}
								onGroupAssign={handleGroupAssign}
							/>
						)}

						{viewMode === VIEW_MODE.DAY && (
							<CalendarDayView
								events={filteredEvents.filter((e) => calendarDayKey(e.date as Date) === format(selectedDate, "yyyy-MM-dd"))}
								selectedDate={selectedDate}
								onEventClick={handleEventClick}
								conflictingEventIds={conflictingEventIds}
								isSelectionMode={isSelectionMode}
								selectedEventIds={selectedEventIds}
								onSelectEvent={toggleSelection}
								grouped={isGrouped}
								onGroupAssign={handleGroupAssign}
							/>
						)}

						{viewMode === VIEW_MODE.PROVIDER && (
							<ProviderScheduleView
								events={filteredEvents}
								selectedDate={selectedDate}
								onEventClick={handleEventClick}
								conflictingEventIds={conflictingEventIds}
								providers={providers}
							/>
						)}

					</div>
				</div>

				{/* Drag Overlay */}
				<DragOverlay dropAnimation={null}>
					{activeDragData?.kind === "provider" ? (
						<DragOverlayContent data={activeDragData} />
					) : activeDragData?.kind === "event" ? (
						<div className="rounded border bg-background px-2 py-1 text-xs shadow-xl opacity-90">
							<p className="font-semibold">{getEventDisplayName(activeDragData.event)}</p>
							{activeDragData.event.startTime && (
								<p className="text-muted-foreground">{activeDragData.event.startTime}</p>
							)}
						</div>
					) : null}
				</DragOverlay>
			</DndContext>

			<EventDetailPanel
				eventId={selectedEventId}
				open={isDialogOpen}
				onClose={handleCloseDialog}
				calendarEvents={events}
				getEventSuggestions={getEventSuggestions}
				getAlternativesForEvent={getAlternativesForEvent}
			/>

			<GroupAssignmentPanel
				open={isGroupPanelOpen}
				group={groupAssignTarget}
				calendarEvents={events}
				getEventSuggestions={getEventSuggestions}
				getAlternativesForEvent={getAlternativesForEvent}
				onClose={handleGroupPanelClose}
				onSaved={handleGroupPanelSaved}
			/>

			<SelectionActionBar
				selectedCount={selectedCount}
				onAssign={() => setIsBulkDialogOpen(true)}
				onClearSelection={clearSelection}
				onExportSelection={(fmt) =>
					handleExport({ kind: "selection", selectedIds: selectedEventIds }, fmt)
				}
			/>

			<BulkAssignmentDialog
				open={isBulkDialogOpen}
				onOpenChange={setIsBulkDialogOpen}
				selectedEventIds={bulkPrefillIds ? new Set(bulkPrefillIds) : selectedEventIds}
				allEvents={events}
				onSuccess={handleBulkAssignSuccess}
				roleScope={bulkPrefillIds ? bulkRoleScope : "all"}
			/>

			{/* Conflict dialog for DnD assignments */}
			<ConflictWarningDialog
				open={conflictDialogOpen}
				onOpenChange={setConflictDialogOpen}
				conflicts={pendingConflicts}
				onConfirm={handleConflictConfirm}
				onCancel={handleConflictCancel}
			/>

			{/* Reschedule confirmation dialog */}
			{pendingReschedule && (
				<RescheduleConfirmDialog
					open={isRescheduleDialogOpen}
					onOpenChange={setIsRescheduleDialogOpen}
					originEvent={pendingReschedule.originEvent}
					destination={pendingReschedule.destination}
					passengerConflicts={pendingReschedule.passengerConflicts}
					providerConflicts={pendingReschedule.providerConflicts}
					affectedVouchers={pendingReschedule.affectedVouchers}
					hasAssociatedTransfers={pendingReschedule.hasAssociatedTransfers}
					events={events}
				/>
			)}

			{/* Auto-assign preview dialog */}
			{/*<AutoAssignPreviewDialog
				open={isAutoAssignDialogOpen}
				onOpenChange={handleAutoAssignDialogChange}
				plan={autoAssignPlan}
				events={filteredEvents}
				providers={providers ?? []}
				isLoading={isAutoAssignLoading}
			/>*/}
		</div>
	)
}
