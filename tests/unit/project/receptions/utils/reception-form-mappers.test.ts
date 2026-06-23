import { describe, expect, test } from "vitest"
import { mapReceptionToFormData } from "@/project/receptions/utils/reception-form-mappers"
import type { ReceptionWithDetails } from "@/project/receptions/actions/reception.actions"

// ─── Minimal fixture builders ─────────────────────────────────────────────────

/**
 * Builds a minimal ReceptionWithDetails fixture.
 * AgencyTransfer.date is a full DateTime — we use a mid-day UTC timestamp to
 * prove that it is preserved as-is (no calendar-day adjustment).
 */
function makeReception(overrides: Partial<ReceptionWithDetails> = {}): ReceptionWithDetails {
	return {
		id: "reception-1",
		voucher: 1001,
		type: "INCOMING",
		status: "ACTIVE",
		cancelledAt: null,
		cancelReason: null,
		cancelledById: null,
		// AgencyTransfer.date is DateTime (full timestamp with time component).
		date: new Date("2026-06-15T14:00:00.000Z"),
		paymentStatus: "PENDING",
		comments: null,
		createdAt: new Date("2026-06-01T00:00:00.000Z"),
		updatedAt: new Date("2026-06-01T00:00:00.000Z"),
		agency: { id: "agency-1", name: "Agencia Test" },
		priceDetails: [],
		passengers: [],
		payments: [],
		eventBookings: [],
		...overrides,
	}
}

function makeEventBooking(eventDate: Date): ReceptionWithDetails["eventBookings"][number] {
	return {
		id: "booking-1",
		passengerCount: 2,
		event: {
			id: "event-1",
			date: eventDate,
			serviceKind: "TOUR",
			startTime: null,
			endTime: null,
			comments: null,
			mode: "REGULAR",
			tour: {
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
			},
			transferService: null,
		},
	}
}

function makePayment(): ReceptionWithDetails["payments"][number] {
	return {
		id: "payment-1",
		refund: false,
		method: "CASH",
		amount: 50000,
		// PaymentRecord.date is a full DateTime (with time component).
		date: new Date("2026-06-15T14:30:00.000Z"),
		comments: null,
		documentNumber: null,
		voucherUrl: null,
		isTransferPayment: false,
	}
}

function makePassengerWithHotels(
	checkIn: Date | null,
	checkOut: Date | null
): ReceptionWithDetails["passengers"][number] {
	return {
		id: "passenger-1",
		name: "Juan Pérez",
		document: "12345678-9",
		age: 35,
		nationality: "CL",
		diet: null,
		dietOther: null,
		phone: null,
		hotel: null,
		email: null,
		allergies: [],
		hotels: [
			{
				id: "hotel-1",
				hotelName: "Hotel Atacama",
				checkIn,
				checkOut,
				order: 0,
			},
		],
	}
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("mapReceptionToFormData — date hydration", () => {
	test("event date is hydrated as LOCAL midnight on the stored calendar day", () => {
		// Event.date is @db.Date stored as UTC midnight (2026-06-01T00:00:00.000Z).
		// The form Date must read June 1 in LOCAL components regardless of runtime TZ.
		const eventDateUtc = new Date("2026-06-01T00:00:00.000Z")
		const reception = makeReception({
			eventBookings: [makeEventBooking(eventDateUtc)],
		})

		const result = mapReceptionToFormData(reception)
		const date = result.eventDetails[0].date

		expect(date.getFullYear()).toBe(2026)
		expect(date.getMonth()).toBe(5) // 0-indexed June
		expect(date.getDate()).toBe(1)
		expect(date.getHours()).toBe(0)
	})

	test("reception date (AgencyTransfer.date) is preserved as a full DateTime without calendar-day adjustment", () => {
		// AgencyTransfer.date is a full DateTime — it has a time component and must
		// NOT be adjusted. We check that the raw ISO string round-trips unchanged.
		const reception = makeReception()
		const result = mapReceptionToFormData(reception)

		expect(result.date.toISOString()).toBe("2026-06-15T14:00:00.000Z")
	})

	test("payment date (PaymentRecord.date) is preserved as a full DateTime without calendar-day adjustment", () => {
		// PaymentRecord.date is a full DateTime — same reasoning as AgencyTransfer.date.
		const reception = makeReception({ payments: [makePayment()] })
		const result = mapReceptionToFormData(reception)

		expect(result.payments[0].date.toISOString()).toBe("2026-06-15T14:30:00.000Z")
	})

	test("hotel checkIn is hydrated as LOCAL midnight on the stored calendar day", () => {
		// PassengerHotel.checkIn is @db.Date (UTC midnight). Must read May 20 in
		// LOCAL components on any runtime timezone.
		const checkInUtc = new Date("2026-05-20T00:00:00.000Z")
		const reception = makeReception({
			passengers: [makePassengerWithHotels(checkInUtc, null)],
		})

		const result = mapReceptionToFormData(reception)
		const checkIn = result.passengers[0].hotels[0].checkIn!

		expect(checkIn.getFullYear()).toBe(2026)
		expect(checkIn.getMonth()).toBe(4) // 0-indexed May
		expect(checkIn.getDate()).toBe(20)
		expect(checkIn.getHours()).toBe(0)
	})

	test("hotel checkOut is hydrated as LOCAL midnight on the stored calendar day", () => {
		// PassengerHotel.checkOut is @db.Date (UTC midnight). Must read May 25 in
		// LOCAL components on any runtime timezone.
		const checkOutUtc = new Date("2026-05-25T00:00:00.000Z")
		const reception = makeReception({
			passengers: [makePassengerWithHotels(null, checkOutUtc)],
		})

		const result = mapReceptionToFormData(reception)
		const checkOut = result.passengers[0].hotels[0].checkOut!

		expect(checkOut.getFullYear()).toBe(2026)
		expect(checkOut.getMonth()).toBe(4) // 0-indexed May
		expect(checkOut.getDate()).toBe(25)
		expect(checkOut.getHours()).toBe(0)
	})

	test("null hotel checkIn/checkOut map to undefined", () => {
		const reception = makeReception({
			passengers: [makePassengerWithHotels(null, null)],
		})

		const result = mapReceptionToFormData(reception)
		const hotel = result.passengers[0].hotels[0]

		expect(hotel.checkIn).toBeUndefined()
		expect(hotel.checkOut).toBeUndefined()
	})
})
