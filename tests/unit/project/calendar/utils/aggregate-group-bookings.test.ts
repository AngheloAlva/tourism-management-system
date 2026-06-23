import { describe, it, expect } from "vitest"
import { aggregateGroupBookings } from "@/project/calendar/utils/aggregate-group-bookings"

// Minimal shape: only the fields aggregateGroupBookings cares about (id).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StubBooking = { id: string; [key: string]: any }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StubEvent = { bookings?: StubBooking[]; [key: string]: any }

describe("aggregateGroupBookings", () => {
	it("concatenates bookings from two events without duplicates when ids are distinct", () => {
		const events: StubEvent[] = [
			{ id: "e1", bookings: [{ id: "b1" }, { id: "b2" }] },
			{ id: "e2", bookings: [{ id: "b3" }] },
		]
		const result = aggregateGroupBookings(events)
		expect(result).toHaveLength(3)
		expect(result.map((b) => b.id)).toEqual(expect.arrayContaining(["b1", "b2", "b3"]))
	})

	it("de-duplicates bookings that appear in two events (same booking id)", () => {
		const sharedBooking = { id: "b1", passengerCount: 2 }
		const events: StubEvent[] = [
			{ id: "e1", bookings: [sharedBooking, { id: "b2" }] },
			{ id: "e2", bookings: [sharedBooking, { id: "b3" }] },
		]
		const result = aggregateGroupBookings(events)
		// b1 should appear only once
		expect(result.filter((b) => b.id === "b1")).toHaveLength(1)
		expect(result).toHaveLength(3)
	})

	it("returns an empty array when given an empty events array", () => {
		const result = aggregateGroupBookings([])
		expect(result).toEqual([])
	})

	it("returns an empty array when events have no bookings", () => {
		const events: StubEvent[] = [{ id: "e1" }, { id: "e2", bookings: [] }]
		const result = aggregateGroupBookings(events)
		expect(result).toEqual([])
	})

	it("preserves booking objects reference (first occurrence wins on de-dupe)", () => {
		const booking1 = { id: "b1", passengerCount: 5 }
		const booking1Dup = { id: "b1", passengerCount: 99 }
		const events: StubEvent[] = [
			{ id: "e1", bookings: [booking1] },
			{ id: "e2", bookings: [booking1Dup] },
		]
		const result = aggregateGroupBookings(events)
		const found = result.find((b) => b.id === "b1")
		expect(found?.passengerCount).toBe(5) // first occurrence wins
	})
})
