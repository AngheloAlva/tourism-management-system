import type { CalendarViewEvent, Passenger } from "../types/calendar.types"

/**
 * One row in the manifest table: a single passenger plus the per-venta tracking
 * fields (voucher, mayorista/vendedor) so several ventas can share ONE header and
 * ONE passenger table while still being distinguishable per passenger.
 */
export interface ManifestRow {
	passenger: Passenger
	/** Departure date — used to resolve the passenger's hotel for that day. */
	date: Date
	/** "V-7474" or "—" when the booking has no voucher. */
	voucherLabel: string
	/** Wholesale agency name if the venta went through one, otherwise the seller name, else "—". */
	counterparty: string
}

type Booking = NonNullable<CalendarViewEvent["bookings"]>[number]

/** Sort events by calendar date, then by departure time (nulls last). */
export function sortEvents(events: CalendarViewEvent[]): CalendarViewEvent[] {
	return events.slice().sort((a, b) => {
		const dateA = (a.date as Date).getTime()
		const dateB = (b.date as Date).getTime()
		if (dateA !== dateB) return dateA - dateB
		if (!a.startTime && !b.startTime) return 0
		if (!a.startTime) return 1
		if (!b.startTime) return -1
		return a.startTime.localeCompare(b.startTime)
	})
}

/** Passengers for a single booking: explicit per-tour inclusions, else the sale's roster. */
function bookingPassengers(booking: Booking): Passenger[] {
	if (booking.bookingPassengers?.length) {
		return booking.bookingPassengers.filter((bp) => !bp.excluded).map((bp) => bp.passenger)
	}
	return booking.saleRecord?.passengers ?? []
}

/**
 * Flatten a group of events into a single ordered list of passenger rows. Every
 * passenger of every booking appears exactly once, tagged with its venta's voucher
 * and mayorista/vendedor. Pure — no DOM, no side-effects.
 *
 * This is the manifest model the export wants: one shared header, all passengers
 * together, distinguished per row by the voucher/mayorista columns.
 */
export function buildManifestRows(events: CalendarViewEvent[]): ManifestRow[] {
	return sortEvents(events).flatMap((event) => {
		const date = event.date as Date
		return (event.bookings ?? []).flatMap((booking) => {
			const sale = booking.saleRecord
			const voucherLabel = sale?.voucher != null ? `V-${sale.voucher}` : "—"
			const counterparty = sale?.wholesaleAgency?.name ?? sale?.seller?.name ?? "—"
			return bookingPassengers(booking).map((passenger) => ({
				passenger,
				date,
				voucherLabel,
				counterparty,
			}))
		})
	})
}
