/**
 * TDD RED → GREEN: Unit tests for reconcile-passengers pure helpers.
 * Verifies:
 *  - isEmptyPassenger: correctly classifies empty vs. filled passengers
 *  - reconcilePassengerList: grow, equal, shrink (tail-first, preserves filled)
 *  - passengerOverflowCount: overflow detection helper
 */

import { describe, it, expect } from "vitest"
import {
	isEmptyPassenger,
	reconcilePassengerList,
	passengerOverflowCount,
	computeTargetPassengerCount,
} from "@/project/sales/utils/reconcile-passengers"
import type { PassengerDetail } from "@/project/sales/schemas/sale-record.schema"

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** Returns a fresh default-empty passenger (matches the form factory shape). */
function emptyPassenger(id = "e"): PassengerDetail {
	return {
		clientId: id,
		name: "",
		rut: "",
		age: 0,
		nacionality: "1",
		diet_type: "NORMAL",
		allergies: [],
		phone: "",
		hotels: [{ clientId: id + "-h", hotelName: "", order: 0 }],
		email: "",
	}
}

/** Returns a passenger with only a name filled in. */
function namedPassenger(id = "n", name = "Juan"): PassengerDetail {
	return { ...emptyPassenger(id), name }
}

/** Returns a passenger with only an email filled in. */
function emailPassenger(id = "em"): PassengerDetail {
	return { ...emptyPassenger(id), email: "test@example.com" }
}

/** Returns a passenger with only a hotelName filled in. */
function hotelPassenger(id = "h"): PassengerDetail {
	return {
		...emptyPassenger(id),
		hotels: [{ clientId: id + "-h", hotelName: "Hotel Atacama", order: 0 }],
	}
}

/** Returns a passenger with only age > 0 filled in. */
function agedPassenger(id = "a", age = 30): PassengerDetail {
	return { ...emptyPassenger(id), age }
}

const makeEmpty = () => emptyPassenger("new")

// ─── isEmptyPassenger ─────────────────────────────────────────────────────────

describe("isEmptyPassenger", () => {
	it("default empty passenger → true", () => {
		expect(isEmptyPassenger(emptyPassenger())).toBe(true)
	})

	it("passenger with age 0 → empty (0 is falsy / no value)", () => {
		expect(isEmptyPassenger(agedPassenger("x", 0))).toBe(true)
	})

	it("passenger with age 1 → not empty", () => {
		expect(isEmptyPassenger(agedPassenger("x", 1))).toBe(false)
	})

	it("passenger with only a name → not empty", () => {
		expect(isEmptyPassenger(namedPassenger())).toBe(false)
	})

	it("passenger with only whitespace name → empty (trimmed)", () => {
		expect(isEmptyPassenger({ ...emptyPassenger(), name: "   " })).toBe(true)
	})

	it("passenger with only a rut → not empty", () => {
		expect(isEmptyPassenger({ ...emptyPassenger(), rut: "12.345.678-9" })).toBe(false)
	})

	it("passenger with only a phone → not empty", () => {
		expect(isEmptyPassenger({ ...emptyPassenger(), phone: "+56 9 9999 9999" })).toBe(false)
	})

	it("passenger with only an email → not empty", () => {
		expect(isEmptyPassenger(emailPassenger())).toBe(false)
	})

	it("passenger with only a hotelName → not empty", () => {
		expect(isEmptyPassenger(hotelPassenger())).toBe(false)
	})

	it("passenger with multiple empty hotels → still empty", () => {
		const p: PassengerDetail = {
			...emptyPassenger(),
			hotels: [
				{ clientId: "h1", hotelName: "", order: 0 },
				{ clientId: "h2", hotelName: "   ", order: 1 },
			],
		}
		expect(isEmptyPassenger(p)).toBe(true)
	})

	it("undefined hotels → treats as empty (no hotel data)", () => {
		const p: PassengerDetail = { ...emptyPassenger(), hotels: undefined as any }
		expect(isEmptyPassenger(p)).toBe(true)
	})

	it("passenger with only allergies → not empty (no silent data loss)", () => {
		expect(isEmptyPassenger({ ...emptyPassenger(), allergies: ["maní"] })).toBe(false)
	})

	it("passenger with only a non-NORMAL diet → not empty", () => {
		expect(isEmptyPassenger({ ...emptyPassenger(), diet_type: "VEGAN" })).toBe(false)
	})

	it("passenger with only dietOther text → not empty", () => {
		expect(isEmptyPassenger({ ...emptyPassenger(), dietOther: "sin gluten" })).toBe(false)
	})

	it("default NORMAL diet + empty allergies → still empty", () => {
		const p: PassengerDetail = { ...emptyPassenger(), diet_type: "NORMAL", allergies: [] }
		expect(isEmptyPassenger(p)).toBe(true)
	})
})

// ─── reconcilePassengerList: grow ─────────────────────────────────────────────

describe("reconcilePassengerList — grow", () => {
	it("target > length appends empties up to targetCount", () => {
		const current = [namedPassenger("a")]
		const result = reconcilePassengerList(current, 3, makeEmpty)
		expect(result).toHaveLength(3)
		// original at index 0
		expect(result[0]).toBe(current[0])
		// appended via makeEmpty
		expect(result[1].clientId).toBe("new")
		expect(result[2].clientId).toBe("new")
	})

	it("target > length: final length === targetCount", () => {
		const result = reconcilePassengerList([], 4, makeEmpty)
		expect(result).toHaveLength(4)
	})

	it("grow from empty array", () => {
		const result = reconcilePassengerList([], 2, makeEmpty)
		expect(result).toHaveLength(2)
		expect(isEmptyPassenger(result[0])).toBe(true)
		expect(isEmptyPassenger(result[1])).toBe(true)
	})
})

// ─── reconcilePassengerList: equal ────────────────────────────────────────────

describe("reconcilePassengerList — equal", () => {
	it("target === length returns same array reference", () => {
		const current = [namedPassenger("a"), emptyPassenger("b")]
		const result = reconcilePassengerList(current, 2, makeEmpty)
		expect(result).toBe(current)
	})

	it("target === length === 1 returns same reference", () => {
		const current = [namedPassenger()]
		const result = reconcilePassengerList(current, 1, makeEmpty)
		expect(result).toBe(current)
	})
})

// ─── reconcilePassengerList: shrink ──────────────────────────────────────────

describe("reconcilePassengerList — shrink (tail-first empty removal)", () => {
	it("all empty: drops from tail down to targetCount", () => {
		const current = [
			emptyPassenger("a"),
			emptyPassenger("b"),
			emptyPassenger("c"),
			emptyPassenger("d"),
		]
		const result = reconcilePassengerList(current, 2, makeEmpty)
		expect(result).toHaveLength(2)
		// Head preserved, tail dropped
		expect(result[0].clientId).toBe("a")
		expect(result[1].clientId).toBe("b")
	})

	it("filled at the END + empties before it: filled one survives, order preserved", () => {
		// [empty-a, empty-b, filled-c] → target=1 → should keep filled-c, drop empties from tail first
		// tail is filled-c (not empty), then empty-b (removable), then empty-a (removable)
		// removable budget = 3-1=2: remove empty-b and empty-a → result = [filled-c]
		const current = [emptyPassenger("a"), emptyPassenger("b"), namedPassenger("c")]
		const result = reconcilePassengerList(current, 1, makeEmpty)
		expect(result).toHaveLength(1)
		expect(result[0].clientId).toBe("c")
	})

	it("filled at START and END, empties in the middle: order preserved, empties removed", () => {
		// [filled-a, empty-b, empty-c, filled-d] → target=2 → remove 2 empties from tail
		// tail scan: filled-d (keep), empty-c (remove), empty-b (remove) → result=[filled-a,filled-d]
		const current = [
			namedPassenger("a"),
			emptyPassenger("b"),
			emptyPassenger("c"),
			namedPassenger("d"),
		]
		const result = reconcilePassengerList(current, 2, makeEmpty)
		expect(result).toHaveLength(2)
		expect(result[0].clientId).toBe("a")
		expect(result[1].clientId).toBe("d")
	})

	it("shrink by 1 with empty at tail: drops just the last one", () => {
		const current = [namedPassenger("a"), namedPassenger("b"), emptyPassenger("c")]
		const result = reconcilePassengerList(current, 2, makeEmpty)
		expect(result).toHaveLength(2)
		expect(result[0].clientId).toBe("a")
		expect(result[1].clientId).toBe("b")
	})
})

// ─── reconcilePassengerList: filled > targetCount ────────────────────────────

describe("reconcilePassengerList — filled count exceeds targetCount", () => {
	it("all filled, target < length: NOTHING removed, result length = filled count", () => {
		const current = [namedPassenger("a"), namedPassenger("b"), namedPassenger("c")]
		const result = reconcilePassengerList(current, 1, makeEmpty)
		// Cannot remove any (all filled), result stays at 3
		expect(result).toHaveLength(3)
		expect(result[0].clientId).toBe("a")
		expect(result[1].clientId).toBe("b")
		expect(result[2].clientId).toBe("c")
	})

	it("1 empty + 3 filled, target=2: removes the 1 empty, 3 filled remain (> target)", () => {
		// [filled-a, filled-b, empty-c, filled-d] → target=2 → removable=2
		// scan tail: filled-d (keep), empty-c (remove, budget=1), filled-b (keep, budget exhausted),
		// filled-a (keep) → result=[filled-a, filled-b, filled-d] length=3 > target=2
		const current = [
			namedPassenger("a"),
			namedPassenger("b"),
			emptyPassenger("c"),
			namedPassenger("d"),
		]
		const result = reconcilePassengerList(current, 2, makeEmpty)
		expect(result).toHaveLength(3)
		expect(result[0].clientId).toBe("a")
		expect(result[1].clientId).toBe("b")
		expect(result[2].clientId).toBe("d")
	})
})

// ─── passengerOverflowCount ───────────────────────────────────────────────────

describe("passengerOverflowCount", () => {
	function makeValues(passengerCount: number, entryCounts: number[]): {
		passengerArray: PassengerDetail[]
		eventBookings: Array<{ priceEntries: Array<{ count: number }> }>
	} {
		return {
			passengerArray: Array.from({ length: passengerCount }, (_, i) =>
				emptyPassenger(String(i))
			),
			eventBookings: [
				{
					priceEntries: entryCounts.map((count) => ({ count })),
				},
			],
		}
	}

	it("no overflow: passengerArray.length <= targetCount → returns 0", () => {
		const values = makeValues(3, [2, 1]) // target=3, passengers=3
		expect(passengerOverflowCount(values as any)).toBe(0)
	})

	it("overflow: passengerArray.length > targetCount → returns positive N", () => {
		const values = makeValues(5, [2, 1]) // target=3, passengers=5
		expect(passengerOverflowCount(values as any)).toBe(2)
	})

	it("empty eventBookings → returns 0 (skip check)", () => {
		const values = {
			passengerArray: [emptyPassenger("a"), emptyPassenger("b")],
			eventBookings: [],
		}
		expect(passengerOverflowCount(values as any)).toBe(0)
	})

	it("passengerArray shorter than target → returns 0", () => {
		const values = makeValues(1, [3]) // target=3, passengers=1
		expect(passengerOverflowCount(values as any)).toBe(0)
	})

	it("multi-booking: target is the MAX per-booking sum, not the total", () => {
		// booking A sum=3, booking B sum=5 → target=5 (max), not 8 (sum)
		const values = {
			passengerArray: Array.from({ length: 6 }, (_, i) => emptyPassenger(String(i))),
			eventBookings: [
				{ priceEntries: [{ count: 3 }] },
				{ priceEntries: [{ count: 2 }, { count: 3 }] },
			],
		}
		// 6 passengers - target 5 = 1 overflow
		expect(passengerOverflowCount(values as any)).toBe(1)
	})

	it("multi-booking: no overflow when passengers === max booking sum", () => {
		const values = {
			passengerArray: Array.from({ length: 5 }, (_, i) => emptyPassenger(String(i))),
			eventBookings: [
				{ priceEntries: [{ count: 3 }] },
				{ priceEntries: [{ count: 5 }] },
			],
		}
		expect(passengerOverflowCount(values as any)).toBe(0)
	})

	// ── Exclusions: the global roster legitimately exceeds a booking's paid count ──

	it("exclusions: 4 passengers, booking sum 2 + 2 excluded → target 4 → no overflow", () => {
		// The regression case: a booking excludes 2 of the 4 passengers, so its
		// priceEntries sum is only 2. Without counting exclusions the guard would
		// wrongly block (target=2 < length=4). With exclusions, target=4 → overflow 0.
		const values = {
			passengerArray: Array.from({ length: 4 }, (_, i) => emptyPassenger(String(i))),
			eventBookings: [
				{
					priceEntries: [{ count: 2 }],
					excludedPassengers: [{ passengerIndex: 2 }, { passengerIndex: 3 }],
				},
			],
		}
		expect(passengerOverflowCount(values as any)).toBe(0)
	})

	it("no exclusions still blocks genuine overflow: 4 passengers, sum 2 → overflow 2", () => {
		const values = {
			passengerArray: Array.from({ length: 4 }, (_, i) => emptyPassenger(String(i))),
			eventBookings: [{ priceEntries: [{ count: 2 }], excludedPassengers: [] }],
		}
		expect(passengerOverflowCount(values as any)).toBe(2)
	})
})

// ─── computeTargetPassengerCount ──────────────────────────────────────────────

describe("computeTargetPassengerCount", () => {
	it("no bookings → 1 (floor)", () => {
		expect(computeTargetPassengerCount([])).toBe(1)
	})

	it("single booking, sum of counts, no exclusions", () => {
		expect(
			computeTargetPassengerCount([{ priceEntries: [{ count: 2 }, { count: 1 }] }] as any)
		).toBe(3)
	})

	it("adds excludedPassengers.length to the booking sum", () => {
		expect(
			computeTargetPassengerCount([
				{ priceEntries: [{ count: 2 }], excludedPassengers: [{}, {}] },
			] as any)
		).toBe(4)
	})

	it("multi-booking: takes the MAX of (sum + excluded) per booking", () => {
		// A: 3 + 0 = 3 ; B: 2 + 2 = 4 → max = 4
		expect(
			computeTargetPassengerCount([
				{ priceEntries: [{ count: 3 }], excludedPassengers: [] },
				{ priceEntries: [{ count: 2 }], excludedPassengers: [{}, {}] },
			] as any)
		).toBe(4)
	})

	it("all-zero counts, no exclusions → 1 (floor)", () => {
		expect(computeTargetPassengerCount([{ priceEntries: [{ count: 0 }] }] as any)).toBe(1)
	})
})
