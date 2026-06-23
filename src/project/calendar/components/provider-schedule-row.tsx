import { useMemo } from "react"
import { format } from "date-fns"
import { calendarDayKey, todayInSantiago } from "@/shared/utils/calendar-day"
import { User, Truck, Car, AlertTriangle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip"

import { CalendarEventCard } from "./calendar-event-card"
import { DroppableEventWrapper } from "./droppable-event-wrapper"

import type { CalendarViewEvent } from "../types/calendar.types"
import type { ProviderRole } from "../types/provider-assignment.types"

// --- Workload Level ---

const WORKLOAD_LEVEL = {
	LIGHT: "light",
	NORMAL: "normal",
	HEAVY: "heavy",
	OVERLOADED: "overloaded",
} as const

type WorkloadLevel = (typeof WORKLOAD_LEVEL)[keyof typeof WORKLOAD_LEVEL]

// --- Helpers ---

function getWorkloadLevel(eventCount: number): WorkloadLevel {
	if (eventCount === 0) return WORKLOAD_LEVEL.LIGHT
	if (eventCount <= 3) return WORKLOAD_LEVEL.LIGHT
	if (eventCount <= 5) return WORKLOAD_LEVEL.NORMAL
	if (eventCount <= 7) return WORKLOAD_LEVEL.HEAVY
	return WORKLOAD_LEVEL.OVERLOADED
}

function getWorkloadColorClasses(level: WorkloadLevel): string {
	switch (level) {
		case WORKLOAD_LEVEL.LIGHT:
			return "text-emerald-600 bg-emerald-500/20 dark:text-emerald-400 dark:bg-emerald-500/30"
		case WORKLOAD_LEVEL.NORMAL:
			return "text-blue-600 bg-blue-500/20 dark:text-blue-400 dark:bg-blue-500/30"
		case WORKLOAD_LEVEL.HEAVY:
			return "text-amber-600 bg-amber-500/20 dark:text-amber-400 dark:bg-amber-500/30"
		case WORKLOAD_LEVEL.OVERLOADED:
			return "text-red-600 bg-red-500/20 dark:text-red-400 dark:bg-red-500/30"
	}
}

function getRoleIcon(role: ProviderRole) {
	switch (role) {
		case "guide":
			return User
		case "driver":
			return Truck
		case "vehicle":
			return Car
	}
}

function getRoleBadgeClasses(role: ProviderRole): string {
	switch (role) {
		case "guide":
			return "bg-purple-500/20 text-purple-700 dark:bg-purple-500/30 dark:text-purple-300"
		case "driver":
			return "bg-blue-500/20 text-blue-700 dark:bg-blue-500/30 dark:text-blue-300"
		case "vehicle":
			return "bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/30 dark:text-emerald-300"
	}
}

function getEventsForProviderOnDay(
	events: CalendarViewEvent[],
	providerId: string,
	role: ProviderRole,
	day: Date
): CalendarViewEvent[] {
	// day is a local-midnight Date from the calendar widget; event.date is @db.Date (UTC midnight).
	// Compare as yyyy-MM-dd strings to avoid cross-timezone false mismatches.
	const dayKey = format(day, "yyyy-MM-dd")
	return events.filter((event) => {
		if (calendarDayKey(event.date as Date) !== dayKey) return false
		if (role === "guide" && event.guideId === providerId) return true
		if (role === "driver" && event.driverId === providerId) return true
		if (role === "vehicle" && event.vehicleId === providerId) return true
		return false
	})
}

function hasConflictOnDay(
	dayEvents: CalendarViewEvent[],
	conflictingEventIds?: Set<string>
): boolean {
	if (!conflictingEventIds) return false
	return dayEvents.some((e) => conflictingEventIds.has(e.id))
}

// --- Props ---

interface ProviderScheduleRowProps {
	providerId: string
	providerName: string
	role: ProviderRole
	cost: number
	weekDays: Date[]
	events: CalendarViewEvent[]
	conflictingEventIds?: Set<string>
	onEventClick: (eventId: string) => void
	isEven: boolean
}

// --- Component ---

export function ProviderScheduleRow({
	providerId,
	providerName,
	role,
	cost,
	weekDays,
	events,
	conflictingEventIds,
	onEventClick,
	isEven,
}: ProviderScheduleRowProps) {
	const RoleIcon = getRoleIcon(role)

	const dayEventsMap = useMemo(() => {
		return weekDays.map((day) => getEventsForProviderOnDay(events, providerId, role, day))
	}, [weekDays, events, providerId, role])

	const totalEvents = useMemo(
		() => dayEventsMap.reduce((sum, dayEvents) => sum + dayEvents.length, 0),
		[dayEventsMap]
	)

	const workloadLevel = getWorkloadLevel(totalEvents)
	const todayKey = calendarDayKey(todayInSantiago())

	return (
		<div
			className={cn(
				"grid min-w-[900px] grid-cols-[200px_repeat(7,1fr)_80px] border-b",
				isEven ? "bg-muted/30" : "bg-background"
			)}
		>
			{/* Provider info */}
			<div className="flex items-center gap-2 border-r px-3 py-2">
				<div
					className={cn(
						"flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
						getRoleBadgeClasses(role)
					)}
				>
					<RoleIcon className="h-3.5 w-3.5" />
				</div>
				<div className="min-w-0 flex-1">
					<p className="truncate text-xs font-medium">{providerName}</p>
					{cost > 0 && (
						<p className="text-muted-foreground text-[10px]">${cost.toLocaleString()}</p>
					)}
				</div>
			</div>

			{/* Day columns */}
			{weekDays.map((day, index) => {
				const dayEvents = dayEventsMap[index]
				const hasConflict = hasConflictOnDay(dayEvents, conflictingEventIds)
				const isToday = format(day, "yyyy-MM-dd") === todayKey

				return (
					<div
						key={format(day, "yyyy-MM-dd")}
						className={cn(
							"relative min-h-[60px] border-r p-1",
							dayEvents.length === 0 && "border-border/50 border-dashed",
							isToday && "bg-primary/5",
							hasConflict && "bg-red-500/10"
						)}
					>
						{hasConflict && (
							<Tooltip>
								<TooltipTrigger asChild>
									<div className="absolute top-0.5 right-0.5 z-10">
										<AlertTriangle className="h-3 w-3 text-red-500" />
									</div>
								</TooltipTrigger>
								<TooltipContent side="top">Conflicto de horario detectado</TooltipContent>
							</Tooltip>
						)}
						<div className="flex flex-col gap-1">
							{dayEvents.map((event) => (
								<DroppableEventWrapper key={event.id} event={event}>
									<CalendarEventCard
										event={event}
										variant="compact"
										onClick={() => onEventClick(event.id)}
										isConflicting={conflictingEventIds?.has(event.id)}
									/>
								</DroppableEventWrapper>
							))}
						</div>
					</div>
				)
			})}

			{/* Workload summary */}
			<div className="flex flex-col items-center justify-center px-2 py-1">
				<span
					className={cn(
						"rounded-full px-2 py-0.5 text-[10px] font-bold",
						getWorkloadColorClasses(workloadLevel)
					)}
				>
					{totalEvents} eventos
				</span>
			</div>
		</div>
	)
}
