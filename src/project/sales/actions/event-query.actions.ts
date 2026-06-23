"use server"

import { parseCalendarDay, formatCalendarDay } from "@/shared/utils/calendar-day"
import { prisma } from "@/lib/prisma"

export interface ExistingEventOption {
	id: string
	startTime: string | null
	endTime: string | null
	currentBookings: number
	maxCapacity: number
	guideName: string | null
}

export async function getExistingEventsForTour(params: {
	tourId: string
	date: Date
	mode: "REGULAR" | "PRIVATE"
}): Promise<ExistingEventOption[]> {
	const { tourId, date } = params

	// event.date is @db.Date — use exact calendar-day equality.
	const calendarDay = parseCalendarDay(formatCalendarDay(date, "yyyy-MM-dd"))

	const events = await prisma.event.findMany({
		where: {
			tourId,
			date: calendarDay,
		},
		select: {
			id: true,
			startTime: true,
			endTime: true,
			maxCapacity: true,
			guide: { select: { fullName: true, companyName: true } },
			bookings: {
				where: { cancelled: false },
				select: { passengerCount: true },
			},
		},
		orderBy: { startTime: "asc" },
	})

	return events.map((event) => ({
		id: event.id,
		startTime: event.startTime,
		endTime: event.endTime,
		currentBookings: event.bookings.reduce((sum, b) => sum + (b.passengerCount ?? 0), 0),
		maxCapacity: event.maxCapacity,
		guideName: event.guide?.fullName ?? event.guide?.companyName ?? null,
	}))
}
