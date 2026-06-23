import { useMemo } from "react"
import {
	format,
	endOfWeek,
	endOfMonth,
	isSameMonth,
	startOfWeek,
	startOfMonth,
	eachDayOfInterval,
	isPast,
	startOfDay,
} from "date-fns"

import { cn } from "@/lib/utils"
import { calendarDayKey, todayInSantiago } from "@/shared/utils/calendar-day"

import { DraggableEventCard } from "./draggable-event-card"
import { DroppableEventWrapper } from "./droppable-event-wrapper"
import { DroppableDayCell } from "./droppable-day-cell"
import { TourSummaryGroupCard, TourSummaryIndividualCard } from "./tour-summary-group-card"
import { buildTourSummaryRows } from "../utils/tour-summary-groups"

import type { CalendarMonthViewProps } from "../types/calendar.types"

const WEEK_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

export function CalendarMonthView({
	events,
	selectedDate,
	onEventClick,
	onDayClick,
	conflictingEventIds,
	isSelectionMode,
	selectedEventIds,
	onSelectEvent,
	grouped,
	onGroupAssign,
}: CalendarMonthViewProps) {
	const monthStart = startOfMonth(selectedDate)
	const monthEnd = endOfMonth(monthStart)
	const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
	const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

	const calendarDays = eachDayOfInterval({
		start: startDate,
		end: endDate,
	})

	const eventsByDay = useMemo(() => {
		const map = new Map<string, typeof events>()
		for (const event of events) {
			const key = calendarDayKey(event.date)
			const existing = map.get(key)
			if (existing) {
				existing.push(event)
			} else {
				map.set(key, [event])
			}
		}
		return map
	}, [events])

	const todayKey = calendarDayKey(todayInSantiago())

	return (
		<div className="w-full overflow-hidden rounded-lg border">
			<div className="bg-muted grid grid-cols-7 gap-px">
				{WEEK_DAYS.map((day) => (
					<div key={day} className="bg-background p-2 text-center text-sm font-semibold">
						{day}
					</div>
				))}

				{calendarDays.map((day) => {
					const dayKey = format(day, "yyyy-MM-dd")
					const dayEvents = eventsByDay.get(dayKey) ?? []
					const isToday = dayKey === todayKey
					const isPastDay = isPast(startOfDay(day)) && !isToday

					return (
						<DroppableDayCell
							key={day.toString()}
							date={day}
							disabled={isPastDay}
							className={cn(
								"bg-background hover:bg-muted/50 flex min-h-[200px] flex-col space-y-1 p-1 transition-colors",
								!isSameMonth(day, monthStart) && "text-muted-foreground bg-muted/20",
								isToday && "dark:bg-primary/10 bg-orange-50/60"
							)}
						>
							<div className="flex items-center justify-end gap-1">
								{dayEvents.length > 0 && (
									<span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[10px]">
										{dayEvents.length}
									</span>
								)}
								<button
									type="button"
									onClick={() => onDayClick(day)}
									className={cn(
										"hover:bg-muted flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-sm font-medium transition-colors",
										isToday && "bg-primary text-white hover:bg-orange-600"
									)}
								>
									{format(day, "d")}
								</button>
							</div>
							<div className="max-h-[200px] flex-1 space-y-1 overflow-y-auto">
								{grouped ? (
									// Grouped mode: render per-tour collapsed cards + individual PRIVATE cards
									buildTourSummaryRows(dayEvents).map((row) =>
										row.kind === "collapsed" ? (
											<TourSummaryGroupCard
												key={row.key}
												row={row}
												variant="cell"
												onGroupAssign={onGroupAssign ?? (() => {})}
												allowExpand={false}
												conflictingEventIds={conflictingEventIds}
												onEventClick={onEventClick}
											/>
										) : (
											<TourSummaryIndividualCard
												key={row.key}
												row={row}
												onEventClick={onEventClick}
												conflictingEventIds={conflictingEventIds}
											/>
										)
									)
								) : (
									// Ungrouped mode: existing per-event DraggableEventCard — UNCHANGED
									dayEvents.map((event) => (
										<DroppableEventWrapper key={event.id} event={event}>
											<DraggableEventCard
												event={event}
												variant="compact"
												onClick={() => onEventClick(event.id)}
												isConflicting={conflictingEventIds?.has(event.id)}
												isSelectionMode={isSelectionMode}
												isSelected={selectedEventIds?.has(event.id)}
												onSelect={onSelectEvent}
											/>
										</DroppableEventWrapper>
									))
								)}
							</div>
						</DroppableDayCell>
					)
				})}
			</div>
		</div>
	)
}
