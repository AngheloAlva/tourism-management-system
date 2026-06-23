import { useMemo } from "react"

import { calendarDayKey } from "@/shared/utils/calendar-day"
import { isAssignmentComplete, getMissingAssignments } from "../components/event-detail-utils"
import type {
	CalendarViewEvent,
	UseCompletitudReturn,
	DailyCompletitud,
	IncompleteEventInfo,
} from "../types/calendar.types"

export function useCompletitudMetrics(events: CalendarViewEvent[]): UseCompletitudReturn {
	return useMemo(() => {
		const total = events.length
		let complete = 0
		const incompleteEvents: IncompleteEventInfo[] = []

		// Group events by date for daily breakdown
		const dayMap = new Map<
			string,
			{ date: Date; events: CalendarViewEvent[]; complete: number; incomplete: CalendarViewEvent[] }
		>()

		for (const event of events) {
			const eventComplete = isAssignmentComplete(event)
			if (eventComplete) {
				complete++
			} else {
				incompleteEvents.push({
					event,
					missing: getMissingAssignments(event),
				})
			}

			const dateKey = calendarDayKey(event.date)
			if (!dayMap.has(dateKey)) {
				dayMap.set(dateKey, {
					// Reconstruct local-equivalent Date from UTC parts for display formatting
					date: new Date(
						(event.date as Date).getUTCFullYear(),
						(event.date as Date).getUTCMonth(),
						(event.date as Date).getUTCDate()
					),
					events: [],
					complete: 0,
					incomplete: [],
				})
			}

			const day = dayMap.get(dateKey)!
			day.events.push(event)
			if (eventComplete) {
				day.complete++
			} else {
				day.incomplete.push(event)
			}
		}

		const percentage = total > 0 ? Math.round((complete / total) * 100) : 100

		const dailyBreakdown: DailyCompletitud[] = Array.from(dayMap.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([dateStr, day]) => ({
				date: day.date,
				dateStr,
				complete: day.complete,
				total: day.events.length,
				percentage: day.events.length > 0 ? Math.round((day.complete / day.events.length) * 100) : 100,
				incompleteEvents: day.incomplete,
			}))

		return {
			overall: { complete, total, percentage },
			dailyBreakdown,
			incompleteEvents,
		}
	}, [events])
}
