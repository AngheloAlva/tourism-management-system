import { describe, it, expect } from "vitest"
import { computeGroupAssignmentStatus } from "@/project/calendar/utils/group-assignment-status"
import type { CollapsedGroupRow } from "@/project/calendar/utils/tour-summary-groups"
import type { CalendarViewEvent } from "@/project/calendar/types/calendar.types"
import { SALE_MODE } from "@/generated/prisma/enums"

// --- Minimal event factory ---

function makeEvent(overrides: Partial<CalendarViewEvent> = {}): CalendarViewEvent {
	return {
		id: "evt-1",
		date: new Date("2026-06-04T00:00:00.000Z"),
		serviceKind: "TOUR",
		status: "CONFIRMED",
		mode: SALE_MODE.REGULAR,
		endTime: null,
		startTime: "09:00",
		tourId: "tour-1",
		maxCapacity: 12,
		currentBookings: 0,
		tour: { name: "Tour A" },
		transferService: null,
		bookings: [],
		guideId: "guide-1",
		driverId: "driver-1",
		vehicleId: "vehicle-1",
		...overrides,
	}
}

function makeRow(
	events: CalendarViewEvent[],
	serviceKind: "TOUR" | "TRANSFER" = "TOUR",
): CollapsedGroupRow {
	return {
		kind: "collapsed",
		key: "tour|tour-1|2026-06-04",
		dateKey: "2026-06-04",
		serviceKind,
		mode: "REGULAR",
		displayName: "Tour A",
		eventIds: events.map((e) => e.id),
		totalPax: 0,
		departures: events.length,
		totalCapacity: events.length * 12,
		distinctStartTimes: ["09:00"],
		events,
	}
}

// --- Tests ---

describe("computeGroupAssignmentStatus", () => {
	it("returns all false when every event is fully assigned", () => {
		const events = [makeEvent({ id: "e1" }), makeEvent({ id: "e2" })]
		const result = computeGroupAssignmentStatus(makeRow(events))
		expect(result).toEqual({
			missingGuide: false,
			missingDriver: false,
			missingVehicle: false,
			passengerAlert: false,
			isTransfer: false,
		})
	})

	it("sets missingGuide=true when any TOUR event has no guideId", () => {
		const events = [
			makeEvent({ id: "e1", guideId: "guide-1" }),
			makeEvent({ id: "e2", guideId: null }),
		]
		const result = computeGroupAssignmentStatus(makeRow(events))
		expect(result.missingGuide).toBe(true)
		expect(result.isTransfer).toBe(false)
	})

	it("sets missingDriver=true when any event has no driverId", () => {
		const events = [
			makeEvent({ id: "e1", driverId: "driver-1" }),
			makeEvent({ id: "e2", driverId: null }),
		]
		const result = computeGroupAssignmentStatus(makeRow(events))
		expect(result.missingDriver).toBe(true)
	})

	it("sets missingVehicle=true when any event has no vehicleId", () => {
		const events = [makeEvent({ id: "e1", vehicleId: null })]
		const result = computeGroupAssignmentStatus(makeRow(events))
		expect(result.missingVehicle).toBe(true)
	})

	it("sets isTransfer=true for TRANSFER groups and suppresses missingGuide even when guideId null", () => {
		const events = [makeEvent({ id: "e1", serviceKind: "TRANSFER", guideId: null, tourId: null, tour: null, transferService: { id: "tf-1", name: "Transfer" } })]
		const row = makeRow(events, "TRANSFER")
		const result = computeGroupAssignmentStatus(row)
		expect(result.isTransfer).toBe(true)
		// missingGuide must be false for TRANSFER groups (guide N/A)
		expect(result.missingGuide).toBe(false)
	})

	it("sets passengerAlert=true when any event has bookings with incomplete passenger data", () => {
		const incompletePassenger = {
			id: "p1",
			name: null, // incomplete — no name
			document: "DOC123",
			nationality: "CL",
			phone: "555-1234",
			age: null,
			diet: null,
			dietOther: null,
			allergies: [],
			hotels: [{ id: "h1", hotelName: "Hotel", checkIn: null, checkOut: null, order: 1 }],
		}
		const events = [
			makeEvent({
				id: "e1",
				bookings: [
					{
						saleRecordId: "sr-1",
						passengerCount: 1,
						saleRecord: { passengers: [incompletePassenger] },
					},
				],
			}),
		]
		const result = computeGroupAssignmentStatus(makeRow(events))
		expect(result.passengerAlert).toBe(true)
	})

	it("sets passengerAlert=false when all passengers are complete", () => {
		const completePassenger = {
			id: "p1",
			name: "Ana García",
			document: "DOC123",
			nationality: "CL",
			phone: "555-1234",
			age: 30,
			diet: null,
			dietOther: null,
			allergies: [],
			hotels: [{ id: "h1", hotelName: "Hotel", checkIn: null, checkOut: null, order: 1 }],
		}
		const events = [
			makeEvent({
				id: "e1",
				bookings: [
					{
						saleRecordId: "sr-1",
						passengerCount: 1,
						saleRecord: { passengers: [completePassenger] },
					},
				],
			}),
		]
		const result = computeGroupAssignmentStatus(makeRow(events))
		expect(result.passengerAlert).toBe(false)
	})
})
