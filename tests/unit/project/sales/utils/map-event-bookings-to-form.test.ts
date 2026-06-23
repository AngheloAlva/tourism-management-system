import { describe, expect, test } from "vitest"
import type { SaleRecordWithDetails } from "@/project/sales/actions/sale-record.actions"
import { mapEventBookingsToForm } from "@/project/sales/utils/sale-form-mappers"

type EventBooking = SaleRecordWithDetails["eventBookings"][number]

const tourRelation: NonNullable<EventBooking["event"]["tour"]> = {
	id: "tour-1",
	name: "Geysers del Tatio",
	generalSummaryEs: null,
	generalSummaryEn: null,
	generalSummaryPt: null,
	scheduleEs: null,
	scheduleEn: null,
	schedulePt: null,
	includesEs: null,
	includesEn: null,
	includesPt: null,
	pickupEs: null,
	pickupEn: null,
	pickupPt: null,
	whatToBringEs: null,
	whatToBringEn: null,
	whatToBringPt: null,
	altitudeEs: null,
	altitudeEn: null,
	altitudePt: null,
}

function makeEventBooking(overrides: {
	id: string
	serviceKind: "TOUR" | "TRANSFER"
	tour: EventBooking["event"]["tour"]
	transferService: EventBooking["event"]["transferService"]
}): EventBooking {
	return {
		id: overrides.id,
		passengerCount: 2,
		flyTime: null,
		flyDate: null,
		flyName: null,
		specialRequest: null,
		priceEntries: [],
		entrySnapshots: [],
		bookingPassengers: [],
		event: {
			id: `event-${overrides.id}`,
			date: new Date("2026-06-01T00:00:00.000Z"),
			serviceKind: overrides.serviceKind,
			mode: "REGULAR",
			status: "ACTIVE",
			startTime: null,
			endTime: null,
			tour: overrides.tour,
			transferService: overrides.transferService,
		},
	}
}

describe("mapEventBookingsToForm — service hydration", () => {
	test("hydrates tourId from the tour relation for a TOUR booking", () => {
		const result = mapEventBookingsToForm([
			makeEventBooking({
				id: "b1",
				serviceKind: "TOUR",
				tour: tourRelation,
				transferService: null,
			}),
		])

		expect(result[0].tourId).toBe("tour-1")
	})

	test("hydrates tourId from the transferService relation for a TRANSFER booking", () => {
		// Regression: transfer in/out bookings used to map to an empty tourId,
		// so editing a sale dropped them — the item rendered as "Sin Tour" and
		// step-2 validation blocked saving with an opaque error.
		const result = mapEventBookingsToForm([
			makeEventBooking({
				id: "b2",
				serviceKind: "TRANSFER",
				tour: null,
				transferService: { id: "transfer-in-1", name: "Transfer IN" },
			}),
		])

		expect(result[0].tourId).toBe("transfer-in-1")
	})

	test("hydrates the event date as LOCAL midnight on the stored calendar day", () => {
		// Regression: Event.date is @db.Date (UTC midnight). Hydrating it with
		// `new Date(utcMidnight)` fed a UTC instant to a picker that reads LOCAL
		// components, so on negative-offset timezones (America/Santiago) the form
		// showed the day BEFORE the one in the read-only detail view.
		const result = mapEventBookingsToForm([
			makeEventBooking({
				id: "b1",
				serviceKind: "TOUR",
				tour: tourRelation,
				transferService: null,
			}),
		])

		// makeEventBooking stores 2026-06-01T00:00:00.000Z. The form Date must read
		// June 1 in LOCAL components, regardless of the runtime timezone.
		const date = result[0].date
		expect(date.getFullYear()).toBe(2026)
		expect(date.getMonth()).toBe(5) // 0-indexed June
		expect(date.getDate()).toBe(1)
		expect(date.getHours()).toBe(0)
	})

	test("hydrates a mixed list of tour and transfer bookings", () => {
		const result = mapEventBookingsToForm([
			makeEventBooking({
				id: "b1",
				serviceKind: "TOUR",
				tour: tourRelation,
				transferService: null,
			}),
			makeEventBooking({
				id: "b2",
				serviceKind: "TRANSFER",
				tour: null,
				transferService: { id: "transfer-out-1", name: "Transfer OUT" },
			}),
		])

		expect(result.map((b) => b.tourId)).toEqual(["tour-1", "transfer-out-1"])
	})
})
