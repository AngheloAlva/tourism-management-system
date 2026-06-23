import { format } from "date-fns"

// --- Prefixes ---

const DAY_PREFIX = "day:"
const HOUR_PREFIX = "hour:"
const EVENT_PREFIX = "event-drop-"

// --- Encode helpers ---

/**
 * Encode a day droppable id.
 * Format: "day:YYYY-MM-DD"
 */
function buildDayDroppableId(date: Date): string {
	return `${DAY_PREFIX}${format(date, "yyyy-MM-dd")}`
}

/**
 * Encode an hour droppable id.
 * Format: "hour:YYYY-MM-DD:HH:mm"
 */
function buildHourDroppableId(date: Date, time: string): string {
	return `${HOUR_PREFIX}${format(date, "yyyy-MM-dd")}:${time}`
}

// --- Droppable target discriminated union ---

type DroppableTarget =
	| { kind: "day"; date: string }
	| { kind: "hour"; date: string; time: string }
	| { kind: "event"; eventId: string }
	| null

/**
 * Parse a droppable id string into a typed DroppableTarget.
 *
 * Handles:
 *  - "day:YYYY-MM-DD"            → { kind: "day", date: "YYYY-MM-DD" }
 *  - "hour:YYYY-MM-DD:HH:mm"     → { kind: "hour", date: "YYYY-MM-DD", time: "HH:mm" }
 *  - "event-drop-<eventId>"      → { kind: "event", eventId: "<eventId>" }
 *  - anything else               → null
 */
function parseDroppableId(id: string): DroppableTarget {
	if (id.startsWith(DAY_PREFIX)) {
		const date = id.slice(DAY_PREFIX.length) // "YYYY-MM-DD"
		if (!date) return null
		return { kind: "day", date }
	}

	if (id.startsWith(HOUR_PREFIX)) {
		// Format: "hour:YYYY-MM-DD:HH:mm"
		// After stripping prefix we have: "YYYY-MM-DD:HH:mm"
		const remainder = id.slice(HOUR_PREFIX.length)
		// Split by ":" but only the first 2 segments form the date, and segments 2+3 form the time
		const parts = remainder.split(":")
		if (parts.length < 3) return null
		const date = parts[0] // "YYYY-MM-DD"
		const time = `${parts[1]}:${parts[2]}` // "HH:mm"
		return { kind: "hour", date, time }
	}

	if (id.startsWith(EVENT_PREFIX)) {
		const eventId = id.slice(EVENT_PREFIX.length)
		if (!eventId) return null
		return { kind: "event", eventId }
	}

	return null
}

export { buildDayDroppableId, buildHourDroppableId, parseDroppableId }
export type { DroppableTarget }
