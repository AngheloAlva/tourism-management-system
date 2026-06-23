/**
 * Unit tests for buildManifestRows — pure planner that flattens a group's events
 * into one ordered passenger list. Several ventas share ONE header and ONE table;
 * each passenger row is tagged with its voucher and mayorista/vendedor.
 *
 * Regression coverage (Excel grouped export duplication bug):
 *  - Two events whose input order differs from sorted order must yield every
 *    passenger exactly once — never the first venta's passengers twice with the
 *    other venta dropped.
 *
 * Feature coverage (per-passenger voucher + mayorista/vendedor columns):
 *  - voucherLabel renders "V-{voucher}" (or "—" when missing)
 *  - counterparty is the wholesale agency name when present, otherwise the seller
 *    name, otherwise "—"
 */

import { describe, it, expect } from "vitest"
import { buildManifestRows } from "@/project/calendar/utils/manifest-rows"
import type {
	BookingPassengerData,
	CalendarViewEvent,
	Passenger,
} from "@/project/calendar/types/calendar.types"

// ---- Factories ---------------------------------------------------------

function makePassenger(over: Partial<Passenger> = {}): Passenger {
	return {
		id: "p-1",
		name: "Andrea Canales",
		document: "192632129",
		nationality: "Chile",
		phone: "+56 9 5778 0145",
		age: 29,
		diet: null,
		dietOther: null,
		allergies: [],
		hotels: [],
		...over,
	}
}

type Booking = NonNullable<CalendarViewEvent["bookings"]>[number]

function makeBooking(over: {
	voucher?: number | null
	sellerName?: string | null
	wholesaleName?: string | null
	passengers?: Passenger[]
	bookingPassengers?: BookingPassengerData[]
}): Booking {
	return {
		saleRecordId: `sr-${over.voucher ?? "x"}`,
		passengerCount: over.passengers?.length ?? 0,
		saleRecord: {
			passengers: over.passengers ?? [],
			voucher: over.voucher ?? null,
			seller: over.sellerName ? { name: over.sellerName } : null,
			wholesaleAgency: over.wholesaleName ? { name: over.wholesaleName } : null,
		},
		bookingPassengers: over.bookingPassengers,
	}
}

function makeEvent(over: Partial<CalendarViewEvent> & { bookings?: Booking[] } = {}): CalendarViewEvent {
	return {
		id: "e-1",
		date: new Date("2026-06-06T00:00:00.000Z"),
		serviceKind: "TOUR",
		status: "ACTIVE",
		mode: "REGULAR",
		endTime: null,
		startTime: "20:00",
		tourId: "t-1",
		maxCapacity: 30,
		tour: { name: "Tour Astronómico" },
		transferService: null,
		guideId: null,
		driverId: null,
		vehicleId: null,
		...over,
	}
}

// ---- Tests -------------------------------------------------------------

describe("buildManifestRows — duplication regression", () => {
	it("includes every passenger exactly once even when input order differs from sorted order", () => {
		// eventLate is passed FIRST but sorts AFTER eventEarly. The old grouped export
		// rendered eventLate's passengers twice and dropped eventEarly's.
		const eventLate = makeEvent({
			id: "late",
			startTime: "21:30",
			bookings: [makeBooking({ voucher: 9108, passengers: [makePassenger({ id: "a", name: "Andrea Canales" })] })],
		})
		const eventEarly = makeEvent({
			id: "early",
			startTime: "20:00",
			bookings: [
				makeBooking({ voucher: 9098, passengers: [makePassenger({ id: "b", name: "Andrea Ibarra Acevedo" })] }),
			],
		})

		const rows = buildManifestRows([eventLate, eventEarly])

		expect(rows.map((r) => r.passenger.id)).toEqual(["b", "a"]) // sorted: 20:00 then 21:30
		expect(rows.map((r) => r.voucherLabel)).toEqual(["V-9098", "V-9108"])
		// every passenger appears exactly once
		expect(rows).toHaveLength(2)
	})

	it("merges all ventas of all events into one ordered list, tagging each row", () => {
		const event = makeEvent({
			bookings: [
				makeBooking({ voucher: 7474, wholesaleName: "Clmundo", passengers: [makePassenger({ id: "x" })] }),
				makeBooking({
					voucher: 7586,
					wholesaleName: "Otsi",
					passengers: [makePassenger({ id: "y" }), makePassenger({ id: "z" })],
				}),
			],
		})

		const rows = buildManifestRows([event])

		expect(rows).toHaveLength(3)
		expect(rows.map((r) => r.voucherLabel)).toEqual(["V-7474", "V-7586", "V-7586"])
		expect(rows.map((r) => r.counterparty)).toEqual(["Clmundo", "Otsi", "Otsi"])
	})
})

describe("buildManifestRows — voucher label", () => {
	it("formats voucher as V-{number}", () => {
		const event = makeEvent({ bookings: [makeBooking({ voucher: 7474, passengers: [makePassenger()] })] })
		expect(buildManifestRows([event])[0].voucherLabel).toBe("V-7474")
	})

	it("falls back to '—' when voucher is missing", () => {
		const event = makeEvent({ bookings: [makeBooking({ voucher: null, passengers: [makePassenger()] })] })
		expect(buildManifestRows([event])[0].voucherLabel).toBe("—")
	})
})

describe("buildManifestRows — counterparty (mayorista / vendedor)", () => {
	it("uses the wholesale agency name when a wholesale agency exists", () => {
		const event = makeEvent({
			bookings: [
				makeBooking({ wholesaleName: "Ckausatur", sellerName: "Federico Solano", passengers: [makePassenger()] }),
			],
		})
		expect(buildManifestRows([event])[0].counterparty).toBe("Ckausatur")
	})

	it("falls back to the seller name when there is no wholesale agency", () => {
		const event = makeEvent({
			bookings: [makeBooking({ wholesaleName: null, sellerName: "Ronald Machuca", passengers: [makePassenger()] })],
		})
		expect(buildManifestRows([event])[0].counterparty).toBe("Ronald Machuca")
	})

	it("falls back to '—' when neither wholesale agency nor seller exists", () => {
		const event = makeEvent({ bookings: [makeBooking({ passengers: [makePassenger()] })] })
		expect(buildManifestRows([event])[0].counterparty).toBe("—")
	})
})

describe("buildManifestRows — per-booking passengers", () => {
	it("respects bookingPassengers exclusions over saleRecord.passengers", () => {
		const kept = makePassenger({ id: "kept" })
		const dropped = makePassenger({ id: "dropped" })
		const event = makeEvent({
			bookings: [
				{
					saleRecordId: "sr-1",
					passengerCount: 2,
					saleRecord: { passengers: [kept, dropped], voucher: 1, seller: null, wholesaleAgency: null },
					bookingPassengers: [
						{ id: "bp1", passengerId: "kept", excluded: false, excludeReason: null, passenger: kept },
						{ id: "bp2", passengerId: "dropped", excluded: true, excludeReason: "no show", passenger: dropped },
					],
				},
			],
		})
		expect(buildManifestRows([event]).map((r) => r.passenger.id)).toEqual(["kept"])
	})
})
