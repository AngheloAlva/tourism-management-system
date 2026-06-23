/**
 * aggregate-group-bookings.ts
 *
 * Pure helper: concatenates booking arrays from multiple fetched event results
 * and de-duplicates by booking `id`.
 *
 * De-dupe rationale: when the same booking appears in two events' results
 * (e.g. a booking was re-assigned across events and appears in both),
 * we keep the FIRST occurrence so passenger detail is stable.
 * In practice this edge case is rare — most groups share disjoint booking sets —
 * but de-duplication prevents double-counting passengers in the panel header.
 *
 * No React, no side-effects: safe to call in any environment (unit tests, server).
 */

interface BookingWithId {
	id: string
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[key: string]: any
}

interface EventWithBookings {
	bookings?: BookingWithId[]
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[key: string]: any
}

/**
 * Concatenates booking arrays from all supplied event results and de-duplicates
 * entries by `booking.id`. First occurrence wins on collision.
 *
 * @param events - Array of event objects (typically from parallel `getEventById` calls).
 * @returns A flat, de-duplicated array of booking objects.
 */
export function aggregateGroupBookings(events: EventWithBookings[]): BookingWithId[] {
	const seen = new Set<string>()
	const result: BookingWithId[] = []

	for (const event of events) {
		if (!event.bookings) continue
		for (const booking of event.bookings) {
			if (!seen.has(booking.id)) {
				seen.add(booking.id)
				result.push(booking)
			}
		}
	}

	return result
}
