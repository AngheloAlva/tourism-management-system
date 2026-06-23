import { createClientId } from "@/shared/lib/create-client-id"
import { calendarDayToLocalDate } from "@/shared/utils/calendar-day"
import { toHHmm } from "./normalize-time"

import type { SaleRecordWithDetails } from "../actions/sale-record.actions"
import type { SaleRecordFormSchema } from "../schemas/sale-record.schema"

type EventBookingWithEntries = SaleRecordWithDetails["eventBookings"][number]
type PassengerWithHotels = SaleRecordWithDetails["passengers"][number]

/**
 * Reconstructs the UI-only `fileNumberPending` flag when loading a sale into the
 * form. `fileNumberPending` has no DB column — it represents a WHOLESALE sale
 * whose file number is still pending. Without this, editing such a sale would
 * hardcode the flag to `false` and the step-1 validation would block saving.
 */
export function deriveFileNumberPending(
	sale: Pick<SaleRecordWithDetails, "channel" | "fileNumber">
): boolean {
	// `.trim()` mirrors the step-1 schema validation, so a whitespace-only file
	// number ("   ") is treated as pending just like the validator treats it as empty.
	return sale.channel === "WHOLESALE" && !sale.fileNumber?.trim()
}

/**
 * Reconstructs the UI-only `paymentPending` flag from the persisted
 * `wholesalePaymentTerm`. This is the exact inverse of how `createSaleRecord`
 * derives the term (`paymentPending → POSTPAID`), so the flag round-trips
 * instead of silently resetting the term to IMMEDIATE on save.
 *
 * Guarded on `channel === "WHOLESALE"` because `paymentPending` is a
 * wholesale-only concept; this prevents inconsistent seed/migration data
 * (a non-wholesale row with POSTPAID) from flipping the flag on.
 */
export function derivePaymentPending(
	sale: Pick<SaleRecordWithDetails, "channel" | "wholesalePaymentTerm">
): boolean {
	return sale.channel === "WHOLESALE" && sale.wholesalePaymentTerm === "POSTPAID"
}

export function mapEventBookingsToForm(
	eventBookings: EventBookingWithEntries[],
	passengers?: PassengerWithHotels[]
): SaleRecordFormSchema["eventBookings"] {
	return eventBookings.map((event) => {
		// Map bookingPassengers exclusions back to passengerIndex-based format
		const excludedPassengers: Array<{ passengerIndex: number; excludeReason?: string }> = []

		if (event.bookingPassengers && passengers) {
			for (const bp of event.bookingPassengers) {
				if (bp.excluded) {
					const passengerIndex = passengers.findIndex((p) => p.id === bp.passengerId)
					if (passengerIndex !== -1) {
						excludedPassengers.push({
							passengerIndex,
							excludeReason: bp.excludeReason ?? undefined,
						})
					}
				}
			}
		}

		return {
			clientId: event.id || createClientId(),
			// `Event.date` is @db.Date (UTC midnight). Hydrate as LOCAL midnight so the
			// date picker shows the correct calendar day — `new Date(utcMidnight)` would
			// render one day earlier in negative-offset timezones (America/Santiago).
			date: calendarDayToLocalDate(event.event.date)!,
			// `tourId` is the unified service-id field the form uses for both
			// tours and transfers (the save path resolves tour vs transfer at
			// write time). Transfer in/out bookings link to `transferService`,
			// not `tour`, so fall back to it — otherwise transfers hydrate as an
			// empty id, render as "Sin Tour" and block step-2 validation.
			tourId: event.event.tour?.id || event.event.transferService?.id || "",
			eventId: event.event.id || "",
			mode: event.event.mode,
			specialRequest: event.specialRequest || "",
			comments: "",
			endTime: toHHmm(event.event.endTime),
			startTime: toHHmm(event.event.startTime),
			flyDate: event.flyDate ? new Date(event.flyDate) : undefined,
			flyName: event.flyName || "",
			flyTime: event.flyTime || "",
			priceEntries: event.priceEntries?.map((pe) => ({
				priceCategoryId: pe.tourPriceCategoryId || "",
				categoryName: pe.categoryName || "",
				count: pe.count || 0,
				price: pe.priceSnapshot || 0,
				reception: pe.receptionSnapshot || 0,
			})) || [],
			entrySnapshots: event.entrySnapshots?.map((snap) => ({
				tourEntryId: snap.tourEntryId || "",
				entryName: snap.entryName || "",
				variantName: snap.variantName || "",
				categoryName: snap.categoryName || "",
				count: snap.count || 0,
				price: snap.priceSnapshot || 0,
			})) || [],
			excludedPassengers,
		}
	})
}

export function mapPassengersToForm(
	passengers: PassengerWithHotels[]
): SaleRecordFormSchema["passengerArray"] {
	return passengers.map((passenger) => ({
		clientId: passenger.id || createClientId(),
		name: passenger.name || "",
		document: passenger.document || "",
		rut: passenger.document || "",
		age: passenger.age || 0,
		nacionality: passenger.nationality || "1",
		diet: passenger.diet || undefined,
		allergies: passenger.allergies || [],
		phone: passenger.phone || "",
		hotels: (passenger.hotels || []).map((h) => ({
			clientId: h.id || createClientId(),
			hotelName: h.hotelName || "",
			// Hotel checkIn/checkOut are @db.Date (UTC midnight) — same calendar-day
			// hydration as Event.date so the picker doesn't shift them back a day.
			checkIn: calendarDayToLocalDate(h.checkIn),
			checkOut: calendarDayToLocalDate(h.checkOut),
			order: h.order ?? 0,
		})),
		email: passenger.email || "",
		diet_type: passenger.diet || "NORMAL",
		complimentary: passenger.complimentary ?? false,
		complimentaryCategory: passenger.complimentaryCategory || "",
	}))
}
