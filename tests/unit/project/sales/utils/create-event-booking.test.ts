import { describe, expect, test } from "vitest"
import { createEventBooking } from "@/project/sales/utils/create-event-booking"

describe("createEventBooking", () => {
	test("defaults date and flyDate to today when no options are given", () => {
		const before = Date.now()
		const booking = createEventBooking()
		const after = Date.now()

		expect(booking.date).toBeInstanceOf(Date)
		expect(booking.flyDate).toBeInstanceOf(Date)
		expect(booking.date.getTime()).toBeGreaterThanOrEqual(before)
		expect(booking.date.getTime()).toBeLessThanOrEqual(after)
	})

	test("produces the expected empty default shape", () => {
		const booking = createEventBooking()

		expect(booking).toMatchObject({
			tourId: "",
			eventId: "",
			endTime: "",
			flyTime: "",
			flyName: "",
			comments: "",
			startTime: "",
			mode: "REGULAR",
			priceEntries: [],
			entrySnapshots: [],
		})
		expect(typeof booking.clientId).toBe("string")
		expect(booking.clientId.length).toBeGreaterThan(0)
	})

	test("inherits the previous date plus one calendar day", () => {
		// Local-constructed so the assertion is timezone-independent: the form
		// works in local-midnight Date space (see create-event-booking.ts).
		const previousDate = new Date(2026, 2, 3) // 2026-03-03 local
		const booking = createEventBooking({ date: previousDate })

		expect(booking.date.getFullYear()).toBe(2026)
		expect(booking.date.getMonth()).toBe(2)
		expect(booking.date.getDate()).toBe(4) // +1 day
	})

	test("rolls over month/year boundaries when adding the day", () => {
		const lastDayOfYear = new Date(2026, 11, 31) // 2026-12-31 local
		const booking = createEventBooking({ date: lastDayOfYear })

		expect(booking.date.getFullYear()).toBe(2027)
		expect(booking.date.getMonth()).toBe(0)
		expect(booking.date.getDate()).toBe(1)
	})

	test("inherits the previous flyDate plus one calendar day", () => {
		const previousFlyDate = new Date(2026, 2, 5) // 2026-03-05 local
		const booking = createEventBooking({ flyDate: previousFlyDate })

		expect(booking.flyDate.getFullYear()).toBe(2026)
		expect(booking.flyDate.getMonth()).toBe(2)
		expect(booking.flyDate.getDate()).toBe(6) // +1 day
	})

	test("clones inherited dates so the new booking never shares a Date reference", () => {
		const previousDate = new Date(2026, 2, 3)
		const booking = createEventBooking({ date: previousDate })

		expect(booking.date).not.toBe(previousDate)
		// mutating the source must not bleed into the new booking
		previousDate.setFullYear(1999)
		expect(booking.date.getFullYear()).toBe(2026)
	})

	test("generates a unique clientId on every call", () => {
		const a = createEventBooking()
		const b = createEventBooking()

		expect(a.clientId).not.toBe(b.clientId)
	})
})
