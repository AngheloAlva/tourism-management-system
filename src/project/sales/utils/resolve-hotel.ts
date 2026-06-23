interface HotelWithDates {
	hotelName: string
	checkIn?: Date | null
	checkOut?: Date | null
	order: number
}

/**
 * Returns the hotel name for a specific date.
 * Fallback chain: 1) exact range match, 2) closest by date, 3) first by order.
 */
export function resolveHotelForDate(hotels: HotelWithDates[], eventDate: Date): string | null {
	if (hotels.length === 0) return null
	if (hotels.length === 1) return hotels[0].hotelName || null

	const sorted = [...hotels].sort((a, b) => a.order - b.order)

	// 1) Exact range match: checkIn <= eventDate <= checkOut
	const rangeMatch = sorted.find((h) => {
		if (!h.checkIn || !h.checkOut) return false
		return h.checkIn <= eventDate && eventDate <= h.checkOut
	})
	if (rangeMatch) return rangeMatch.hotelName || null

	// 2) Closest by date (using checkIn as reference)
	const withDates = sorted.filter((h) => h.checkIn)
	if (withDates.length > 0) {
		const closest = withDates.reduce((prev, curr) => {
			const prevDiff = Math.abs(prev.checkIn!.getTime() - eventDate.getTime())
			const currDiff = Math.abs(curr.checkIn!.getTime() - eventDate.getTime())
			return currDiff < prevDiff ? curr : prev
		})
		return closest.hotelName || null
	}

	// 3) First by order
	return sorted[0].hotelName || null
}

/**
 * Returns all hotel names joined with " / " for summary display.
 */
export function formatHotelsSummary(hotels: HotelWithDates[]): string {
	if (hotels.length === 0) return "—"
	if (hotels.length === 1) return hotels[0].hotelName || "—"
	return hotels.map((h) => h.hotelName).filter(Boolean).join(" / ") || "—"
}
