import { createClientId } from "@/shared/lib/create-client-id"
import { calendarDayToLocalDate } from "@/shared/utils/calendar-day"

import type { ReceptionFormData } from "../schemas/reception.schema"
import type { ReceptionWithDetails } from "../actions/reception.actions"

/**
 * Maps a persisted ReceptionWithDetails into the shape expected by ReceptionForm.
 *
 * Date-field classification:
 * - AgencyTransfer.date  → DateTime (full timestamp) — kept as-is via new Date()
 * - PaymentRecord.date   → DateTime (full timestamp) — kept as-is via new Date()
 * - Event.date           → @db.Date (UTC midnight)   — converted via calendarDayToLocalDate
 * - PassengerHotel.checkIn/checkOut → @db.Date       — converted via calendarDayToLocalDate
 */
export function mapReceptionToFormData(reception: ReceptionWithDetails): ReceptionFormData {
	return {
		agencyId: reception.agency.id,
		// AgencyTransfer.date is a full DateTime — no timezone adjustment needed.
		date: new Date(reception.date),
		paymentStatus: reception.paymentStatus,
		comments: reception.comments || "",
		eventDetails: reception.eventBookings.map((booking) => ({
			clientId: booking.id || createClientId(),
			tourId: booking.event.tour?.id || "",
			eventId: booking.event.id,
			// Event.date is @db.Date (UTC midnight). Hydrate as LOCAL midnight so the
			// date picker shows the correct calendar day on negative-offset timezones.
			date: calendarDayToLocalDate(new Date(booking.event.date))!,
			mode: booking.event.mode,
			startTime: booking.event.startTime || undefined,
			endTime: booking.event.endTime || undefined,
			comments: booking.event.comments || "",
			priceEntries: [],
			entrySnapshots: [],
		})),
		passengers: reception.passengers.map((passenger) => ({
			clientId: passenger.id || createClientId(),
			name: passenger.name || "",
			rut: passenger.document || "",
			age: passenger.age ?? undefined,
			nacionality: passenger.nationality || "",
			diet_type: passenger.diet ?? undefined,
			dietOther: passenger.dietOther || "",
			allergies: passenger.allergies ?? [],
			phone: passenger.phone || "",
			email: passenger.email || "",
			hotels: (passenger.hotels ?? []).map((h) => ({
				clientId: h.id || createClientId(),
				hotelName: h.hotelName,
				// PassengerHotel.checkIn/checkOut are @db.Date (UTC midnight). Hydrate as
				// LOCAL midnight so the date picker shows the correct calendar day.
				checkIn: calendarDayToLocalDate(h.checkIn ?? undefined),
				checkOut: calendarDayToLocalDate(h.checkOut ?? undefined),
				order: h.order ?? 0,
			})),
		})),
		payments: reception.payments.map((payment) => ({
			clientId: payment.id || createClientId(),
			refund: payment.refund,
			method: payment.method,
			amount: String(payment.amount),
			// PaymentRecord.date is a full DateTime — no timezone adjustment needed.
			date: new Date(payment.date),
			documentNumber: payment.documentNumber || "",
			comments: payment.comments || "",
		})),
	}
}
