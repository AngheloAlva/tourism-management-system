import { addDays } from "date-fns"

import { createClientId } from "@/shared/lib/create-client-id"

export interface CreateEventBookingOptions {
	/**
	 * When provided, the new booking inherits this event date **plus one calendar
	 * day**. Used when adding a second/Nth event: consecutive events of a sale
	 * most commonly happen on back-to-back days, so the next one defaults to the
	 * day after the previous instead of defaulting to today.
	 */
	date?: Date
	/** Same inheritance rule as {@link CreateEventBookingOptions.date} for the flight date. */
	flyDate?: Date
}

/**
 * Builds the default value shape for a new `eventBookings` entry.
 *
 * Single source of truth for the booking shape: used both for the form's
 * initial first event and for the "Agregar Tour/Evento" button. Passing
 * `date`/`flyDate` makes the new booking inherit the previous event's dates
 * advanced by one day (a fresh Date, never shared by reference); omitting them
 * defaults to today.
 *
 * `addDays` operates in local time, matching the form's local-midnight Date
 * space (the calendar picker emits local-midnight Dates), so the rollover is
 * timezone-safe and consistent with how the value is displayed and persisted.
 */
export function createEventBooking(options: CreateEventBookingOptions = {}) {
	const today = new Date()
	return {
		clientId: createClientId(),
		tourId: "",
		eventId: "",
		endTime: "",
		flyTime: "",
		flyName: "",
		comments: "",
		startTime: "",
		mode: "REGULAR",
		date: options.date ? addDays(options.date, 1) : today,
		flyDate: options.flyDate ? addDays(options.flyDate, 1) : today,
		priceEntries: [],
		entrySnapshots: [],
	}
}
