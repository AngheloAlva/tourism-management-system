import { useMemo } from "react"
import {
	format,
	addDays,
	isSameMonth,
	startOfWeek,
	eachDayOfInterval,
	isPast,
	startOfDay,
} from "date-fns"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/shared/components/ui/scroll-area"
import { calendarDayKey, todayInSantiago } from "@/shared/utils/calendar-day"

import { DraggableEventCard } from "./draggable-event-card"
import { DroppableEventWrapper } from "./droppable-event-wrapper"
import { DroppableDayCell } from "./droppable-day-cell"
import { TourSummaryGroupCard, TourSummaryIndividualCard } from "./tour-summary-group-card"
import { buildTourSummaryRows } from "../utils/tour-summary-groups"

import type { CalendarWeekViewProps } from "../types/calendar.types"

const WEEK_DAYS = ["Lun", "Mar", "Mi\u00e9", "Jue", "Vie", "S\u00e1b", "Dom"]

export function CalendarWeekView({
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
}: CalendarWeekViewProps) {
	const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
	const weekDays = eachDayOfInterval({
		start: weekStart,
		end: addDays(weekStart, 6),
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
		<div className="w-full overflow-x-auto rounded-lg border">
			<div className="bg-muted grid min-w-[980px] grid-cols-7 gap-px">
				{weekDays.map((day, index) => {
					const dayKey = format(day, "yyyy-MM-dd")
					const dayEvents = eventsByDay.get(dayKey) ?? []
					const isToday = dayKey === todayKey
					const isOutsideMonth = !isSameMonth(day, selectedDate)
					const isPastDay = isPast(startOfDay(day)) && !isToday

					return (
						<DroppableDayCell
							key={dayKey}
							date={day}
							disabled={isPastDay}
							className={cn(
								"bg-background flex min-h-[500px] flex-col transition-colors",
								isOutsideMonth && "text-muted-foreground bg-muted/20",
								isToday && "dark:bg-primary/10 bg-orange-50/60"
							)}
						>
							{/* Column header */}
							<button
								type="button"
								onClick={() => onDayClick(day)}
								className="hover:bg-muted/50 flex items-center justify-between border-b px-2 py-2 transition-colors"
							>
								<div className="flex items-center gap-1.5">
									<span className="text-muted-foreground text-xs font-medium uppercase">
										{WEEK_DAYS[index]}
									</span>
									<span
										className={cn(
											"flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
											isToday && "bg-primary text-white"
										)}
									>
										{format(day, "d")}
									</span>
								</div>
								{dayEvents.length > 0 && (
									<span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[10px]">
										{dayEvents.length}
									</span>
								)}
							</button>

							{/* Events list */}
							<ScrollArea className="flex-1">
								<div className="space-y-1 p-1.5">
									{grouped ? (
										// Grouped mode: per-tour collapsed cards + individual PRIVATE cards
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
							</ScrollArea>
						</DroppableDayCell>
					)
				})}
			</div>
		</div>
	)
}
