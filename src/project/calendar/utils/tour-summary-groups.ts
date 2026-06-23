import type { CalendarViewEvent } from "../types/calendar.types"
import { countCalendarRoster } from "./passenger-totals"

// ---- Row types ---------------------------------------------------------

export interface CollapsedGroupRow {
	kind: "collapsed"
	/** Stable group key: `tour|{tourId}|{dateKey}` or `tf|{transferServiceId}|{dateKey}` */
	key: string
	dateKey: string
	serviceKind: "TOUR" | "TRANSFER"
	/** Always REGULAR — PRIVATE never collapses */
	mode: "REGULAR"
	displayName: string
	eventIds: string[]
	/** Sum of countCalendarRoster across all events in the group */
	totalPax: number
	/** Number of events in the group ("N salidas") */
	departures: number
	/** Sum of maxCapacity across all events (never a per-event cap) */
	totalCapacity: number
	/** Distinct non-null startTimes across the group */
	distinctStartTimes: string[]
	events: CalendarViewEvent[]
}

export interface IndividualRow {
	kind: "individual"
	key: string
	dateKey: string
	event: CalendarViewEvent
	displayName: string
	/** countCalendarRoster for this single event */
	totalPax: number
	departures: 1
	totalCapacity: number
}

export type TourSummaryRow = CollapsedGroupRow | IndividualRow

// ---- Private utilities -------------------------------------------------

/**
 * Produces a `YYYY-MM-DD` date key.
 *
 * Uses UTC accessors because `@db.Date` fields come back from Prisma as
 * UTC-midnight `Date` objects (e.g. 2026-06-01T00:00:00.000Z). Using local
 * accessors would produce the wrong day in timezones behind UTC.
 */
function toDateKey(date: Date): string {
	const y = date.getUTCFullYear()
	const m = String(date.getUTCMonth() + 1).padStart(2, "0")
	const d = String(date.getUTCDate()).padStart(2, "0")
	return `${y}-${m}-${d}`
}

function resolveGroupKey(
	event: CalendarViewEvent,
	dateKey: string,
): string | null {
	if (event.mode !== "REGULAR") return null

	if (event.serviceKind === "TOUR") {
		if (!event.tourId) return null
		return `tour|${event.tourId}|${dateKey}`
	}

	// TRANSFER
	if (event.transferService?.id) {
		return `tf|${event.transferService.id}|${dateKey}`
	}

	return null
}

function resolveDisplayName(event: CalendarViewEvent): string {
	if (event.serviceKind === "TOUR") {
		return event.tour?.name ?? "Tour sin nombre"
	}
	return event.transferService?.name ?? "Transfer sin nombre"
}

// ---- Main function -----------------------------------------------------

/**
 * Partitions a flat array of CalendarViewEvent objects into collapsed group
 * rows (REGULAR same-key events) and individual rows (PRIVATE, null-key
 * TOUR, null-transferService TRANSFER).
 *
 * Pure function — no side-effects, no DOM, no React.
 */
export function buildTourSummaryRows(events: CalendarViewEvent[]): TourSummaryRow[] {
	const grouped = new Map<string, CalendarViewEvent[]>()
	const individuals: CalendarViewEvent[] = []

	for (const event of events) {
		const dateKey = toDateKey(event.date)
		const key = resolveGroupKey(event, dateKey)

		if (key === null) {
			individuals.push(event)
			continue
		}

		const bucket = grouped.get(key)
		if (bucket) {
			bucket.push(event)
		} else {
			grouped.set(key, [event])
		}
	}

	const rows: TourSummaryRow[] = []

	// Collapsed group rows
	for (const [key, groupEvents] of grouped.entries()) {
		const first = groupEvents[0]
		const dateKey = toDateKey(first.date)

		const totalPax = groupEvents.reduce(
			(sum, e) => sum + countCalendarRoster(e.bookings),
			0,
		)
		const totalCapacity = groupEvents.reduce((sum, e) => sum + e.maxCapacity, 0)

		const startTimeSet = new Set<string>()
		for (const e of groupEvents) {
			if (e.startTime !== null) startTimeSet.add(e.startTime)
		}

		rows.push({
			kind: "collapsed",
			key,
			dateKey,
			serviceKind: first.serviceKind,
			mode: "REGULAR",
			displayName: resolveDisplayName(first),
			eventIds: groupEvents.map((e) => e.id),
			totalPax,
			departures: groupEvents.length,
			totalCapacity,
			distinctStartTimes: Array.from(startTimeSet),
			events: groupEvents,
		})
	}

	// Individual rows
	for (const event of individuals) {
		const dateKey = toDateKey(event.date)
		rows.push({
			kind: "individual",
			key: `individual|${event.id}|${dateKey}`,
			dateKey,
			event,
			displayName: resolveDisplayName(event),
			totalPax: countCalendarRoster(event.bookings),
			departures: 1,
			totalCapacity: event.maxCapacity,
		})
	}

	return rows
}
