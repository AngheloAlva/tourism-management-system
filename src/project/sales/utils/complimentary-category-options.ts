import type { EventBookingSchema } from "../schemas/sale-record.schema"

/**
 * Derive the list of category names available for complimentary passenger
 * selection. Sources from the union of categoryName across all REGULAR-mode
 * bookings' priceEntries, deduped and filtered to non-empty values.
 *
 * PRIVATE bookings are excluded because the comp deduction in PRIVATE mode
 * does not use a category (REQ-06).
 */
export const getComplimentaryCategoryOptions = (
	eventBookings: EventBookingSchema[]
): string[] =>
	Array.from(
		new Set(
			eventBookings
				.filter((b) => b.mode === "REGULAR")
				.flatMap((b) => (b.priceEntries || []).map((pe) => pe.categoryName))
				.filter(Boolean)
		)
	)

/**
 * Returns true when a stored complimentaryCategory no longer appears in the
 * current set of category options (orphaned after category rename/removal).
 * Returns false for empty/falsy values or empty options (no valid list to
 * compare against).
 */
export const isOrphanedCategory = (
	category: string | undefined,
	options: string[]
): boolean => {
	if (!category) return false
	if (options.length === 0) return false
	return !options.includes(category)
}
