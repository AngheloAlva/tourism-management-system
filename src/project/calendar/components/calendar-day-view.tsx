import { useMemo, useEffect, useState } from "react"
import { format } from "date-fns"
import { calendarDayKey, todayInSantiago } from "@/shared/utils/calendar-day"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/shared/components/ui/scroll-area"

import { DraggableEventCard } from "./draggable-event-card"
import { DroppableEventWrapper } from "./droppable-event-wrapper"
import { TourSummaryGroupCard, TourSummaryIndividualCard } from "./tour-summary-group-card"
import { buildTourSummaryRows } from "../utils/tour-summary-groups"

import type { CalendarDayViewProps, CalendarViewEvent } from "../types/calendar.types"

// --- Constants ---

const DEFAULT_MIN_HOUR = 6
const DEFAULT_MAX_HOUR = 22
const SLOTS_PER_HOUR = 4
const MIN_ROW_HEIGHT = 15 // px per 15-min slot
const DEFAULT_EVENT_SPAN = SLOTS_PER_HOUR // 1 hour = 4 slots

// --- Time Parsing Helpers ---

interface ParsedTime {
	hour: number
	minutes: number
}

function parseTime(timeStr: string): ParsedTime | null {
	const match = timeStr.match(/^(\d{1,2}):(\d{2})$/)
	if (!match) return null
	return { hour: parseInt(match[1], 10), minutes: parseInt(match[2], 10) }
}

function computeHourRange(events: CalendarViewEvent[]): {
	minHour: number
	maxHour: number
} {
	let minHour = DEFAULT_MIN_HOUR
	let maxHour = DEFAULT_MAX_HOUR

	for (const event of events) {
		if (event.startTime) {
			const parsed = parseTime(event.startTime)
			if (parsed) {
				minHour = Math.min(minHour, parsed.hour)
			}
		}
		if (event.endTime) {
			const parsed = parseTime(event.endTime)
			if (parsed) {
				const endHour = parsed.minutes > 0 ? parsed.hour + 1 : parsed.hour
				maxHour = Math.max(maxHour, endHour)
			}
		}
	}

	return { minHour, maxHour }
}

// --- Overlap Detection Algorithm (Greedy Column Assignment) ---

interface PositionedEvent {
	event: CalendarViewEvent
	column: number
	totalColumns: number
	rowStart: number
	rowSpan: number
}

function computeRowPosition(
	event: CalendarViewEvent,
	minHour: number
): { rowStart: number; rowSpan: number } | null {
	if (!event.startTime) return null

	const start = parseTime(event.startTime)
	if (!start) return null

	const rowStart = (start.hour - minHour) * SLOTS_PER_HOUR + Math.floor(start.minutes / 15) + 1

	let rowSpan = DEFAULT_EVENT_SPAN

	if (event.endTime) {
		const end = parseTime(event.endTime)
		if (end) {
			const totalStartMinutes = start.hour * 60 + start.minutes
			const totalEndMinutes = end.hour * 60 + end.minutes
			const diffSlots = Math.floor((totalEndMinutes - totalStartMinutes) / 15)
			rowSpan = Math.max(diffSlots, DEFAULT_EVENT_SPAN)
		}
	}

	return { rowStart, rowSpan }
}

function eventsOverlap(
	a: { rowStart: number; rowSpan: number },
	b: { rowStart: number; rowSpan: number }
): boolean {
	const aEnd = a.rowStart + a.rowSpan
	const bEnd = b.rowStart + b.rowSpan
	return a.rowStart < bEnd && b.rowStart < aEnd
}

function computeOverlapLayout(events: CalendarViewEvent[], minHour: number): PositionedEvent[] {
	// 1. Filter to events WITH startTime, compute positions, sort by start then longest first
	const timed: Array<{
		event: CalendarViewEvent
		rowStart: number
		rowSpan: number
	}> = []

	for (const event of events) {
		const pos = computeRowPosition(event, minHour)
		if (pos) {
			timed.push({ event, ...pos })
		}
	}

	timed.sort((a, b) => a.rowStart - b.rowStart || b.rowSpan - a.rowSpan)

	// 2. Greedy column assignment
	const columns: Array<{ end: number }[]> = []
	const results: Array<{
		event: CalendarViewEvent
		column: number
		rowStart: number
		rowSpan: number
	}> = []

	for (const item of timed) {
		let placed = false
		for (let col = 0; col < columns.length; col++) {
			const lastInCol = columns[col][columns[col].length - 1]
			if (lastInCol.end <= item.rowStart) {
				columns[col].push({ end: item.rowStart + item.rowSpan })
				results.push({ ...item, column: col })
				placed = true
				break
			}
		}
		if (!placed) {
			columns.push([{ end: item.rowStart + item.rowSpan }])
			results.push({ ...item, column: columns.length - 1 })
		}
	}

	// 3. Connected components — group overlapping events, assign totalColumns per group
	const n = results.length
	const groupId = new Array<number>(n).fill(-1)
	let nextGroup = 0

	for (let i = 0; i < n; i++) {
		if (groupId[i] === -1) {
			groupId[i] = nextGroup
			// BFS to find all events connected to i via overlap
			const queue = [i]
			while (queue.length > 0) {
				const current = queue.shift()!
				for (let j = 0; j < n; j++) {
					if (groupId[j] === -1 && eventsOverlap(results[current], results[j])) {
						groupId[j] = nextGroup
						queue.push(j)
					}
				}
			}
			nextGroup++
		}
	}

	// Compute max column per group
	const maxColPerGroup = new Map<number, number>()
	for (let i = 0; i < n; i++) {
		const gid = groupId[i]
		const current = maxColPerGroup.get(gid) ?? 0
		maxColPerGroup.set(gid, Math.max(current, results[i].column + 1))
	}

	return results.map((r, i) => ({
		...r,
		totalColumns: maxColPerGroup.get(groupId[i]) ?? 1,
	}))
}

// --- Current Time Indicator ---

function CurrentTimeIndicator({ minHour }: { minHour: number }) {
	const [now, setNow] = useState(new Date())

	useEffect(() => {
		const interval = setInterval(() => setNow(new Date()), 60_000)
		return () => clearInterval(interval)
	}, [])

	const hour = now.getHours()
	const minutes = now.getMinutes()
	const row = (hour - minHour) * SLOTS_PER_HOUR + Math.floor(minutes / 15) + 1
	const subOffset = (minutes % 15) / 15

	return (
		<div
			className="pointer-events-none absolute right-0 left-[60px] z-20 flex items-center"
			style={{
				top: `${(row - 1) * MIN_ROW_HEIGHT + subOffset * MIN_ROW_HEIGHT}px`,
			}}
		>
			<div className="h-3 w-3 -translate-x-1.5 rounded-full bg-red-500" />
			<div className="h-0.5 flex-1 bg-red-500" />
		</div>
	)
}

// --- "Sin hora" Section ---

function UnscheduledSection({
	events,
	onEventClick,
	conflictingEventIds,
	isSelectionMode,
	selectedEventIds,
	onSelectEvent,
}: {
	events: CalendarViewEvent[]
	onEventClick: (eventId: string) => void
	conflictingEventIds?: Set<string>
	isSelectionMode?: boolean
	selectedEventIds?: Set<string>
	onSelectEvent?: (eventId: string) => void
}) {
	if (events.length === 0) return null

	return (
		<div className="border-b pb-3">
			<p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
				Sin hora
			</p>
			<div className="flex flex-wrap gap-2">
				{events.map((event) => (
					<div key={event.id} className="w-[220px]">
						<DroppableEventWrapper event={event}>
							<DraggableEventCard
								event={event}
								variant="expanded"
								onClick={() => onEventClick(event.id)}
								isConflicting={conflictingEventIds?.has(event.id)}
								isSelectionMode={isSelectionMode}
								isSelected={selectedEventIds?.has(event.id)}
								onSelect={onSelectEvent}
							/>
						</DroppableEventWrapper>
					</div>
				))}
			</div>
		</div>
	)
}

// --- Hour Labels ---

function HourLabels({ minHour, maxHour }: { minHour: number; maxHour: number }) {
	const hours: string[] = []
	for (let h = minHour; h <= maxHour; h++) {
		hours.push(`${h.toString().padStart(2, "0")}:00`)
	}

	return (
		<>
			{hours.map((label, i) => (
				<div
					key={label}
					className="text-muted-foreground pr-2 text-right text-[11px]"
					style={{
						gridRow: `${i * SLOTS_PER_HOUR + 1} / span ${SLOTS_PER_HOUR}`,
						gridColumn: 1,
					}}
				>
					{label}
				</div>
			))}
		</>
	)
}

// --- Hour Grid Lines ---

function HourGridLines({ totalSlots }: { totalSlots: number }) {
	const lines: number[] = []
	for (let slot = 0; slot < totalSlots; slot += SLOTS_PER_HOUR) {
		lines.push(slot)
	}

	return (
		<>
			{lines.map((slot) => (
				<div
					key={`line-${slot}`}
					className="border-border/40 pointer-events-none border-t"
					style={{
						gridRow: `${slot + 1}`,
						gridColumn: 2,
					}}
				/>
			))}
		</>
	)
}

// --- Main Component ---

export function CalendarDayView({
	events,
	selectedDate,
	onEventClick,
	conflictingEventIds,
	isSelectionMode,
	selectedEventIds,
	onSelectEvent,
	grouped,
	onGroupAssign,
}: CalendarDayViewProps) {
	const isToday = format(selectedDate, "yyyy-MM-dd") === calendarDayKey(todayInSantiago())

	const { unscheduled, minHour, maxHour, totalSlots, positioned } = useMemo(() => {
		const unscheduled = events.filter((e) => !e.startTime)
		const scheduled = events.filter((e) => !!e.startTime)
		const { minHour, maxHour } = computeHourRange(events)
		const totalSlots = (maxHour - minHour) * SLOTS_PER_HOUR
		const positioned = computeOverlapLayout(scheduled, minHour)

		return { unscheduled, minHour, maxHour, totalSlots, positioned }
	}, [events])

	// Grouped mode: bypass time grid and render a vertical grouped list
	if (grouped) {
		const groupedRows = buildTourSummaryRows(events)
		return (
			<div
				className={cn(
					"w-full overflow-hidden rounded-lg border",
					isToday && "ring-primary/30 ring-1"
				)}
			>
				<div className="flex flex-col gap-3 p-4">
					{groupedRows.length === 0 ? (
						<div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
							<p className="text-muted-foreground text-sm">No hay eventos para mostrar</p>
						</div>
					) : (
						<div className="space-y-3">
							{groupedRows.map((row) =>
								row.kind === "collapsed" ? (
									<TourSummaryGroupCard
										key={row.key}
										row={row}
										variant="list"
										onGroupAssign={onGroupAssign ?? (() => {})}
										allowExpand={true}
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
							)}
						</div>
					)}
				</div>
			</div>
		)
	}

	// Ungrouped mode: existing timeline — UNCHANGED
	return (
		<div
			className={cn(
				"w-full overflow-hidden rounded-lg border",
				isToday && "ring-primary/30 ring-1"
			)}
		>
			<div className="flex flex-col gap-3 p-4">
				<UnscheduledSection
					events={unscheduled}
					onEventClick={onEventClick}
					conflictingEventIds={conflictingEventIds}
					isSelectionMode={isSelectionMode}
					selectedEventIds={selectedEventIds}
					onSelectEvent={onSelectEvent}
				/>

				<ScrollArea className="max-h-[70vh]">
					<div
						className="relative"
						style={{
							display: "grid",
							gridTemplateColumns: "60px 1fr",
							gridTemplateRows: `repeat(${totalSlots}, ${MIN_ROW_HEIGHT}px)`,
						}}
					>
						<HourLabels minHour={minHour} maxHour={maxHour} />
						<HourGridLines totalSlots={totalSlots} />

						{/* Event track area */}
						<div
							className="relative"
							style={{
								gridRow: `1 / span ${totalSlots}`,
								gridColumn: 2,
							}}
						>
							{positioned.map((pe) => (
								<div
									key={pe.event.id}
									className="absolute px-0.5"
									style={{
										top: `${(pe.rowStart - 1) * MIN_ROW_HEIGHT}px`,
										height: `${pe.rowSpan * MIN_ROW_HEIGHT}px`,
										left: `${(pe.column / pe.totalColumns) * 100}%`,
										width: `${(1 / pe.totalColumns) * 100}%`,
									}}
								>
									<DroppableEventWrapper event={pe.event}>
										<DraggableEventCard
											event={pe.event}
											variant="expanded"
											onClick={() => onEventClick(pe.event.id)}
											isConflicting={conflictingEventIds?.has(pe.event.id)}
											isSelectionMode={isSelectionMode}
											isSelected={selectedEventIds?.has(pe.event.id)}
											onSelect={onSelectEvent}
										/>
									</DroppableEventWrapper>
								</div>
							))}
						</div>

						{isToday && <CurrentTimeIndicator minHour={minHour} />}
					</div>
				</ScrollArea>
			</div>
		</div>
	)
}
