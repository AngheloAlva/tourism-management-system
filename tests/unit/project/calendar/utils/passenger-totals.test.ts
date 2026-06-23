/**
 * Unit tests for the calendar passenger-total helpers.
 *
 * Models the real "Valle de la Luna" bug: 4 vouchers whose registered roster
 * (4 + 2 + 7 + 2 = 15) is larger than what was charged (2 + 2 + 7 + 2 = 13),
 * because one voucher (V-8809) has 4 people on the roster but only 2 paid.
 */

import { describe, it, expect } from "vitest"
import {
	activeRoster,
	countRegisteredPassengers,
	countChargedPassengers,
	countCalendarRoster,
} from "@/project/calendar/utils/passenger-totals"

/* eslint-disable @typescript-eslint/no-explicit-any */
const passenger = (id: string): any => ({ id, name: id })

const bookingPassenger = (id: string, excluded = false): any => ({
	id: `bp-${id}`,
	passengerId: id,
	excluded,
	excludeReason: null,
	passenger: passenger(id),
})

const roster = (n: number) => Array.from({ length: n }, (_, i) => passenger(`p${i}`))
/* eslint-enable @typescript-eslint/no-explicit-any */

describe("activeRoster", () => {
	it("prefers non-excluded bookingPassengers over saleRecord.passengers", () => {
		const booking = {
			bookingPassengers: [
				bookingPassenger("a"),
				bookingPassenger("b", true), // excluded
				bookingPassenger("c"),
			],
			saleRecord: { passengers: roster(99) },
		}
		expect(activeRoster(booking).map((p) => p.id)).toEqual(["a", "c"])
	})

	it("falls back to saleRecord.passengers when there are no bookingPassengers", () => {
		const booking = { bookingPassengers: [], saleRecord: { passengers: roster(3) } }
		expect(activeRoster(booking)).toHaveLength(3)
	})

	it("returns an empty array when neither source is present", () => {
		expect(activeRoster({})).toEqual([])
	})
})

describe("countRegisteredPassengers", () => {
	it("sums the active roster across vouchers (Valle de la Luna = 15)", () => {
		const bookings = [
			{ passengerCount: 2, bookingPassengers: [bookingPassenger("a"), bookingPassenger("b"), bookingPassenger("c"), bookingPassenger("d")] }, // V-8809: 4 registered, 2 paid
			{ passengerCount: 2, saleRecord: { passengers: roster(2) } }, // V-8359
			{ passengerCount: 7, saleRecord: { passengers: roster(7) } }, // V-7586
			{ passengerCount: 2, saleRecord: { passengers: roster(2) } }, // V-8961
		]
		expect(countRegisteredPassengers(bookings)).toBe(15)
	})

	it("returns 0 for nullish input", () => {
		expect(countRegisteredPassengers(undefined)).toBe(0)
		expect(countRegisteredPassengers(null)).toBe(0)
	})
})

describe("countChargedPassengers", () => {
	it("sums passengerCount across vouchers (Valle de la Luna = 13)", () => {
		const bookings = [
			{ passengerCount: 2 },
			{ passengerCount: 2 },
			{ passengerCount: 7 },
			{ passengerCount: 2 },
		]
		expect(countChargedPassengers(bookings)).toBe(13)
	})

	it("returns 0 for nullish input", () => {
		expect(countChargedPassengers(null)).toBe(0)
	})
})

describe("countCalendarRoster", () => {
	it("counts saleRecord.passengers (transfer-filtered in getEvents)", () => {
		const bookings = [
			{ passengerCount: 2, saleRecord: { passengers: roster(4) } }, // V-8809
			{ passengerCount: 2, saleRecord: { passengers: roster(2) } },
			{ passengerCount: 7, saleRecord: { passengers: roster(7) } },
			{ passengerCount: 2, saleRecord: { passengers: roster(2) } },
		]
		expect(countCalendarRoster(bookings)).toBe(15)
	})

	it("falls back to passengerCount when saleRecord is absent", () => {
		expect(countCalendarRoster([{ passengerCount: 5 }])).toBe(5)
	})

	it("returns 0 for nullish input", () => {
		expect(countCalendarRoster(undefined)).toBe(0)
	})
})
