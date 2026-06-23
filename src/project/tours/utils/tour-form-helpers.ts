import type { ActiveTour, ActiveTourPriceCategory } from "../hooks/use-tours"

/**
 * True when a tour exposes at least one non-special price category — i.e. it
 * yields selectable passenger entries in the quote form. Mirrors the filter in
 * `buildPriceEntriesFromTour`: a tour with no categories, or only special ones,
 * produces an empty entries list and cannot be quoted (passenger count stays 0,
 * blocking the step). Used to surface a clear warning instead of a dead "Next".
 */
export function tourHasQuotableCategories(tour: ActiveTour): boolean {
	return tour.priceCategories.some((pc) => !pc.isSpecial)
}

export function buildPriceEntriesFromTour(tour: ActiveTour) {
	return tour.priceCategories
		.filter((pc) => !pc.isSpecial)
		.sort((a, b) => a.sortOrder - b.sortOrder)
		.map((pc) => ({
			priceCategoryId: pc.id,
			categoryName: pc.name,
			count: 0,
			price: pc.price,
			reception: pc.receptionPrice,
		}))
}

export function buildEntrySnapshotsFromTour(tour: ActiveTour) {
	return tour.priceCategories
		.filter((pc) => !pc.isSpecial)
		.flatMap((pc) =>
			pc.entries
				.filter((e) => !e.isSpecial)
				.map((e) => ({
					tourEntryId: e.id,
					entryName: e.name,
					variantName: e.variantName,
					categoryName: pc.name,
					count: 0,
					price: e.price,
				}))
		)
}

export function isPriceOutOfBounds(price: number, category: ActiveTourPriceCategory | undefined) {
	if (!category) return false
	const min = category.minPrice ?? 0
	const max = category.maxPrice ?? 0
	if (min === 0 && max === 0) return false
	return price < min || (max > 0 && price > max)
}

export function flattenTourEntries(
	priceCategories: Array<{ name: string; entries?: Array<{ id: string; name: string; variantName: string }> }>
) {
	return priceCategories.flatMap((pc) =>
		(pc.entries || []).map((e) => ({ ...e, categoryName: pc.name }))
	)
}
