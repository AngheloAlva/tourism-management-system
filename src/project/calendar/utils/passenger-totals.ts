import type { Passenger, BookingPassengerData } from "../types/calendar.types"

/** Minimal booking shape needed to derive passenger totals. */
type BookingLike = {
	passengerCount?: number
	bookingPassengers?: BookingPassengerData[] | null
	saleRecord?: { passengers?: Passenger[] | null } | null
}

/**
 * Active (non-excluded) roster for a single booking, matching the per-voucher
 * "X pax" badge logic in event-vouchers-section: prefer the non-excluded
 * bookingPassengers, fall back to the sale record passengers.
 */
export function activeRoster(booking: BookingLike): Passenger[] {
	if (booking.bookingPassengers && booking.bookingPassengers.length > 0) {
		return booking.bookingPassengers
			.filter((bp) => !bp.excluded)
			.map((bp) => bp.passenger)
	}
	return booking.saleRecord?.passengers ?? []
}

/**
 * Registered passengers across all bookings — the real people on the roster.
 * Equals the sum of the per-voucher "X pax" badges. Used by the event detail
 * dialog, whose data (getEventById) is NOT transfer-filtered, so the
 * bookingPassengers-first derivation matches what the badges show.
 */
export function countRegisteredPassengers(bookings?: BookingLike[] | null): number {
	if (!bookings) return 0
	return bookings.reduce((sum, b) => sum + activeRoster(b).length, 0)
}

/**
 * Charged passengers across all bookings — what was actually paid for
 * (sum of EventBooking.passengerCount).
 */
export function countChargedPassengers(bookings?: BookingLike[] | null): number {
	if (!bookings) return 0
	return bookings.reduce((sum, b) => sum + (b.passengerCount ?? 0), 0)
}

/**
 * Registered passengers for calendar-list data (getEvents). That query already
 * resolves transfers + exclusions into `saleRecord.passengers` (the remaining
 * roster) while leaving `bookingPassengers` unfiltered — so here we count
 * `saleRecord.passengers`, falling back to passengerCount when absent. This
 * keeps the calendar chip transfer-safe.
 */
export function countCalendarRoster(bookings?: BookingLike[] | null): number {
	if (!bookings) return 0
	return bookings.reduce(
		(sum, b) => sum + (b.saleRecord?.passengers?.length ?? b.passengerCount ?? 0),
		0,
	)
}
