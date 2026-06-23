/**
 * Unit tests for buildTourSummaryRows — pure grouping helper.
 *
 * Covers:
 *  - REGULAR same-tour+day collapse (pax sum, capacity sum, departures count)
 *  - REGULAR different-date no-merge
 *  - REGULAR transfer keyed by transferServiceId
 *  - PRIVATE never collapsed (even same tour+day)
 *  - PRIVATE + REGULAR mixed day
 *  - null-tourId → individual fallback
 *  - distinctStartTimes array
 */

import { describe, it, expect } from "vitest"
import {
	buildTourSummaryRows,
	type CollapsedGroupRow,
	type IndividualRow,
} from "@/project/calendar/utils/tour-summary-groups"
import type { CalendarViewEvent } from "@/project/calendar/types/calendar.types"

// ---- Factories ---------------------------------------------------------

function makeEvent(
	overrides: Partial<CalendarViewEvent> & { id: string },
): CalendarViewEvent {
	return {
		id: overrides.id,
		date: overrides.date ?? new Date("2026-06-01T00:00:00.000Z"),
		serviceKind: overrides.serviceKind ?? "TOUR",
		status: "CONFIRMED",
		mode: overrides.mode ?? "REGULAR",
		endTime: overrides.endTime ?? null,
		startTime: overrides.startTime ?? null,
		tourId: overrides.tourId !== undefined ? overrides.tourId : "tour-1",
		maxCapacity: overrides.maxCapacity ?? 15,
		currentBookings: overrides.currentBookings,
		tour: overrides.tour !== undefined ? overrides.tour : { name: "Valle de la Luna" },
		transferService:
			overrides.transferService !== undefined ? overrides.transferService : null,
		bookings: overrides.bookings ?? [],
		guideId: null,
		driverId: null,
		vehicleId: null,
	}
}

function makeBookings(pax: number) {
	return [{ passengerCount: pax, saleRecord: { passengers: Array.from({ length: pax }, (_, i) => ({ id: `p${i}`, name: `P${i}`, document: null, nationality: null, phone: null, age: null, diet: null, dietOther: null, allergies: [], hotels: [] })) } }]
}

// ---- Helpers -----------------------------------------------------------

function asCollapsed(row: CollapsedGroupRow | IndividualRow): CollapsedGroupRow {
	if (row.kind !== "collapsed") throw new Error(`Expected collapsed, got ${row.kind}`)
	return row
}

function asIndividual(row: CollapsedGroupRow | IndividualRow): IndividualRow {
	if (row.kind !== "individual") throw new Error(`Expected individual, got ${row.kind}`)
	return row
}

// ---- Tests -------------------------------------------------------------

describe("buildTourSummaryRows — REGULAR tour grouping", () => {
	it("collapses two REGULAR events with the same tourId+date into one group-row", () => {
		const events: CalendarViewEvent[] = [
			makeEvent({ id: "e1", tourId: "T1", bookings: makeBookings(10), maxCapacity: 15 }),
			makeEvent({ id: "e2", tourId: "T1", bookings: makeBookings(20), maxCapacity: 15 }),
		]

		const rows = buildTourSummaryRows(events)

		expect(rows).toHaveLength(1)
		const row = asCollapsed(rows[0] as CollapsedGroupRow)
		expect(row.totalPax).toBe(30)
		expect(row.departures).toBe(2)
		expect(row.totalCapacity).toBe(30)
		expect(row.eventIds).toEqual(expect.arrayContaining(["e1", "e2"]))
	})

	it("does NOT merge REGULAR events with the same tourId on different dates", () => {
		const events: CalendarViewEvent[] = [
			makeEvent({ id: "e1", tourId: "T1", date: new Date("2026-06-01T00:00:00.000Z") }),
			makeEvent({ id: "e2", tourId: "T1", date: new Date("2026-06-02T00:00:00.000Z") }),
		]

		const rows = buildTourSummaryRows(events)

		expect(rows).toHaveLength(2)
		rows.forEach((r) => expect(r.kind).toBe("collapsed"))
	})

	it("does NOT merge REGULAR events with different tourIds on the same date", () => {
		const events: CalendarViewEvent[] = [
			makeEvent({ id: "e1", tourId: "T1" }),
			makeEvent({ id: "e2", tourId: "T2", tour: { name: "Salar de Atacama" } }),
		]

		const rows = buildTourSummaryRows(events)

		expect(rows).toHaveLength(2)
	})
})

describe("buildTourSummaryRows — REGULAR transfer grouping", () => {
	it("collapses two REGULAR TRANSFER events sharing transferServiceId+date into one group-row", () => {
		const events: CalendarViewEvent[] = [
			makeEvent({
				id: "e3",
				serviceKind: "TRANSFER",
				tourId: null,
				tour: null,
				transferService: { id: "S1", name: "Airport Transfer" },
				bookings: makeBookings(5),
				maxCapacity: 10,
			}),
			makeEvent({
				id: "e4",
				serviceKind: "TRANSFER",
				tourId: null,
				tour: null,
				transferService: { id: "S1", name: "Airport Transfer" },
				bookings: makeBookings(3),
				maxCapacity: 10,
			}),
		]

		const rows = buildTourSummaryRows(events)

		expect(rows).toHaveLength(1)
		const row = asCollapsed(rows[0] as CollapsedGroupRow)
		expect(row.totalPax).toBe(8)
		expect(row.departures).toBe(2)
		expect(row.totalCapacity).toBe(20)
		expect(row.serviceKind).toBe("TRANSFER")
	})
})

describe("buildTourSummaryRows — PRIVATE events never collapsed", () => {
	it("produces individual rows for two PRIVATE events with same tourId+date", () => {
		const events: CalendarViewEvent[] = [
			makeEvent({ id: "e5", tourId: "T1", mode: "PRIVATE", bookings: makeBookings(4), maxCapacity: 8 }),
			makeEvent({ id: "e6", tourId: "T1", mode: "PRIVATE", bookings: makeBookings(6), maxCapacity: 8 }),
		]

		const rows = buildTourSummaryRows(events)

		expect(rows).toHaveLength(2)
		rows.forEach((r) => {
			const row = asIndividual(r as IndividualRow)
			expect(row.kind).toBe("individual")
		})
	})

	it("keeps PRIVATE and REGULAR events for same tourId+date as separate rows", () => {
		const events: CalendarViewEvent[] = [
			makeEvent({ id: "e7", tourId: "T1", mode: "REGULAR", bookings: makeBookings(10), maxCapacity: 15 }),
			makeEvent({ id: "e8", tourId: "T1", mode: "REGULAR", bookings: makeBookings(10), maxCapacity: 15 }),
			makeEvent({ id: "e9", tourId: "T1", mode: "PRIVATE", bookings: makeBookings(4), maxCapacity: 8 }),
		]

		const rows = buildTourSummaryRows(events)

		expect(rows).toHaveLength(2) // 1 collapsed REGULAR group + 1 PRIVATE individual
		const collapsed = rows.find((r) => r.kind === "collapsed") as CollapsedGroupRow
		const individual = rows.find((r) => r.kind === "individual") as IndividualRow
		expect(collapsed).toBeDefined()
		expect(individual).toBeDefined()
		expect(collapsed.totalPax).toBe(20)
		expect(individual.event.id).toBe("e9")
	})
})

describe("buildTourSummaryRows — null tourId fallback", () => {
	it("produces individual row when tourId is null and serviceKind is TOUR", () => {
		const events: CalendarViewEvent[] = [
			makeEvent({ id: "e10", tourId: null, tour: null, bookings: makeBookings(3), maxCapacity: 10 }),
		]

		const rows = buildTourSummaryRows(events)

		expect(rows).toHaveLength(1)
		asIndividual(rows[0] as IndividualRow)
	})

	it("merges two REGULAR TOUR events with null tourId as individual rows (no grouping)", () => {
		const events: CalendarViewEvent[] = [
			makeEvent({ id: "e11", tourId: null, tour: null, bookings: makeBookings(2), maxCapacity: 10 }),
			makeEvent({ id: "e12", tourId: null, tour: null, bookings: makeBookings(3), maxCapacity: 10 }),
		]

		const rows = buildTourSummaryRows(events)

		expect(rows).toHaveLength(2)
		rows.forEach((r) => expect(r.kind).toBe("individual"))
	})
})

describe("buildTourSummaryRows — distinctStartTimes", () => {
	it("collects distinct non-null startTimes across grouped events", () => {
		const events: CalendarViewEvent[] = [
			makeEvent({ id: "e13", tourId: "T1", startTime: "09:00", bookings: makeBookings(5), maxCapacity: 15 }),
			makeEvent({ id: "e14", tourId: "T1", startTime: "11:00", bookings: makeBookings(5), maxCapacity: 15 }),
		]

		const rows = buildTourSummaryRows(events)
		const row = asCollapsed(rows[0] as CollapsedGroupRow)

		expect(row.distinctStartTimes).toHaveLength(2)
		expect(row.distinctStartTimes).toEqual(expect.arrayContaining(["09:00", "11:00"]))
	})

	it("does not include null startTimes in distinctStartTimes", () => {
		const events: CalendarViewEvent[] = [
			makeEvent({ id: "e15", tourId: "T1", startTime: "09:00", bookings: makeBookings(5), maxCapacity: 15 }),
			makeEvent({ id: "e16", tourId: "T1", startTime: null, bookings: makeBookings(5), maxCapacity: 15 }),
		]

		const rows = buildTourSummaryRows(events)
		const row = asCollapsed(rows[0] as CollapsedGroupRow)

		expect(row.distinctStartTimes).toEqual(["09:00"])
	})

	it("deduplcates identical startTimes", () => {
		const events: CalendarViewEvent[] = [
			makeEvent({ id: "e17", tourId: "T1", startTime: "09:00", bookings: makeBookings(5), maxCapacity: 15 }),
			makeEvent({ id: "e18", tourId: "T1", startTime: "09:00", bookings: makeBookings(5), maxCapacity: 15 }),
		]

		const rows = buildTourSummaryRows(events)
		const row = asCollapsed(rows[0] as CollapsedGroupRow)

		expect(row.distinctStartTimes).toHaveLength(1)
		expect(row.distinctStartTimes).toEqual(["09:00"])
	})
})

describe("buildTourSummaryRows — IndividualRow shape for PRIVATE", () => {
	it("sets departures=1, totalPax=countCalendarRoster, totalCapacity=maxCapacity on individual rows", () => {
		const events: CalendarViewEvent[] = [
			makeEvent({ id: "e19", mode: "PRIVATE", tourId: "T1", bookings: makeBookings(7), maxCapacity: 12 }),
		]

		const rows = buildTourSummaryRows(events)
		const row = asIndividual(rows[0] as IndividualRow)

		expect(row.departures).toBe(1)
		expect(row.totalPax).toBe(7)
		expect(row.totalCapacity).toBe(12)
	})
})
