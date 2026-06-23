/**
 * Unit tests for buildGroupedExportRows — wraps buildTourSummaryRows and
 * maps to GroupedExportRow for PDF/Excel grouped export.
 *
 * Covers:
 *  - CollapsedGroupRow → GroupedExportRow mapping (pax, capacity, departures)
 *  - IndividualRow (PRIVATE) → GroupedExportRow mapping
 *  - Mixed REGULAR + PRIVATE events produce correct count of export rows
 */

import { describe, it, expect } from "vitest"
import { buildGroupedExportRows, type GroupedExportRow } from "@/project/calendar/utils/tour-summary-export"
import type { CalendarViewEvent } from "@/project/calendar/types/calendar.types"

// ---- Factories ---------------------------------------------------------

function makePassenger(id: string) {
	return { id, name: id, document: null, nationality: null, phone: null, age: null, diet: null, dietOther: null, allergies: [], hotels: [] }
}

function makeBookings(pax: number) {
	return [{ passengerCount: pax, saleRecord: { passengers: Array.from({ length: pax }, (_, i) => makePassenger(`p${i}`)) } }]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeEvent(overrides: Partial<CalendarViewEvent> & { id: string }): CalendarViewEvent {
	return {
		id: overrides.id,
		date: overrides.date ?? new Date("2026-06-01T00:00:00.000Z"),
		serviceKind: overrides.serviceKind ?? "TOUR",
		status: "CONFIRMED",
		mode: overrides.mode ?? "REGULAR",
		endTime: null,
		startTime: null,
		tourId: overrides.tourId !== undefined ? overrides.tourId : "tour-1",
		maxCapacity: overrides.maxCapacity ?? 15,
		currentBookings: undefined,
		tour: overrides.tour !== undefined ? overrides.tour : { name: "Valle de la Luna" },
		transferService: overrides.transferService !== undefined ? overrides.transferService : null,
		bookings: overrides.bookings ?? [],
		guideId: null,
		driverId: null,
		vehicleId: null,
		...overrides,
	}
}

// ---- Tests -------------------------------------------------------------

describe("buildGroupedExportRows — CollapsedGroupRow mapping", () => {
	it("maps one collapsed REGULAR group to one GroupedExportRow with summed values", () => {
		const events: CalendarViewEvent[] = [
			makeEvent({ id: "e1", tourId: "T1", bookings: makeBookings(10), maxCapacity: 15 }),
			makeEvent({ id: "e2", tourId: "T1", bookings: makeBookings(20), maxCapacity: 15 }),
		]

		const exportRows = buildGroupedExportRows(events)

		expect(exportRows).toHaveLength(1)
		const row: GroupedExportRow = exportRows[0]
		expect(row.totalPax).toBe(30)
		expect(row.totalCapacity).toBe(30)
		expect(row.departures).toBe(2)
		expect(row.displayName).toBe("Valle de la Luna")
	})

	it("produces separate export rows for events on different dates", () => {
		const events: CalendarViewEvent[] = [
			makeEvent({ id: "e3", tourId: "T1", date: new Date("2026-06-01T00:00:00.000Z"), bookings: makeBookings(5), maxCapacity: 15 }),
			makeEvent({ id: "e4", tourId: "T1", date: new Date("2026-06-02T00:00:00.000Z"), bookings: makeBookings(8), maxCapacity: 15 }),
		]

		const exportRows = buildGroupedExportRows(events)

		expect(exportRows).toHaveLength(2)
	})

	it("maps a TRANSFER collapsed group with correct serviceKind", () => {
		const events: CalendarViewEvent[] = [
			makeEvent({
				id: "e5",
				serviceKind: "TRANSFER",
				tourId: null,
				tour: null,
				transferService: { id: "S1", name: "Airport Transfer" },
				bookings: makeBookings(5),
				maxCapacity: 10,
			}),
			makeEvent({
				id: "e6",
				serviceKind: "TRANSFER",
				tourId: null,
				tour: null,
				transferService: { id: "S1", name: "Airport Transfer" },
				bookings: makeBookings(3),
				maxCapacity: 10,
			}),
		]

		const exportRows = buildGroupedExportRows(events)

		expect(exportRows).toHaveLength(1)
		expect(exportRows[0].totalPax).toBe(8)
		expect(exportRows[0].totalCapacity).toBe(20)
		expect(exportRows[0].departures).toBe(2)
	})
})

describe("buildGroupedExportRows — PRIVATE individual row mapping", () => {
	it("maps a PRIVATE event to an individual GroupedExportRow (departures=1)", () => {
		const events: CalendarViewEvent[] = [
			makeEvent({ id: "e7", mode: "PRIVATE", tourId: "T1", bookings: makeBookings(7), maxCapacity: 12 }),
		]

		const exportRows = buildGroupedExportRows(events)

		expect(exportRows).toHaveLength(1)
		const row = exportRows[0]
		expect(row.totalPax).toBe(7)
		expect(row.totalCapacity).toBe(12)
		expect(row.departures).toBe(1)
	})

	it("keeps PRIVATE events as individual rows even when same tourId+date as REGULAR events", () => {
		const events: CalendarViewEvent[] = [
			makeEvent({ id: "e8", mode: "REGULAR", tourId: "T1", bookings: makeBookings(10), maxCapacity: 15 }),
			makeEvent({ id: "e9", mode: "REGULAR", tourId: "T1", bookings: makeBookings(10), maxCapacity: 15 }),
			makeEvent({ id: "e10", mode: "PRIVATE", tourId: "T1", bookings: makeBookings(4), maxCapacity: 8 }),
		]

		const exportRows = buildGroupedExportRows(events)

		// 1 collapsed REGULAR group + 1 PRIVATE individual
		expect(exportRows).toHaveLength(2)
		const grouped = exportRows.find((r) => r.departures === 2)
		const individual = exportRows.find((r) => r.departures === 1)
		expect(grouped?.totalPax).toBe(20)
		expect(individual?.totalPax).toBe(4)
	})
})

describe("buildGroupedExportRows — GroupedExportRow structure", () => {
	it("export row has required fields: displayName, dateKey, mode, totalPax, departures, totalCapacity, events", () => {
		const events: CalendarViewEvent[] = [
			makeEvent({ id: "e11", tourId: "T1", bookings: makeBookings(5), maxCapacity: 15 }),
		]

		const exportRows = buildGroupedExportRows(events)
		const row = exportRows[0]

		expect(row).toHaveProperty("displayName")
		expect(row).toHaveProperty("dateKey")
		expect(row).toHaveProperty("mode")
		expect(row).toHaveProperty("totalPax")
		expect(row).toHaveProperty("departures")
		expect(row).toHaveProperty("totalCapacity")
		expect(row).toHaveProperty("events")
		expect(Array.isArray(row.events)).toBe(true)
	})
})
