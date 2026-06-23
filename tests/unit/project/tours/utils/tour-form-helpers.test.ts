import { describe, expect, test } from "vitest"
import type { ActiveTour, ActiveTourPriceCategory } from "@/project/tours/hooks/use-tours"
import { tourHasQuotableCategories } from "@/project/tours/utils/tour-form-helpers"

function makeCategory(overrides: Partial<ActiveTourPriceCategory>): ActiveTourPriceCategory {
	return {
		id: "cat-1",
		name: "Adulto",
		price: 50000,
		transferPrice: 0,
		receptionPrice: 0,
		minPrice: null,
		maxPrice: null,
		ageMin: null,
		ageMax: null,
		isDefault: false,
		isSpecial: false,
		sortOrder: 0,
		entries: [],
		source: "TOUR",
		...overrides,
	}
}

function makeTour(priceCategories: ActiveTourPriceCategory[]): ActiveTour {
	return {
		id: "tour-1",
		name: "Geysers del Tatio",
		serviceKind: "TOUR",
		priceCategories,
		startTime: null,
		endTime: null,
	}
}

describe("tourHasQuotableCategories", () => {
	test("is true when the tour has at least one non-special category", () => {
		const tour = makeTour([makeCategory({ id: "c1", isSpecial: false })])
		expect(tourHasQuotableCategories(tour)).toBe(true)
	})

	test("is false when the tour has no categories at all", () => {
		expect(tourHasQuotableCategories(makeTour([]))).toBe(false)
	})

	test("is false when every category is marked special", () => {
		// Special categories are filtered out of the quote (see buildPriceEntriesFromTour),
		// so a tour with only special categories produces zero selectable entries.
		const tour = makeTour([
			makeCategory({ id: "c1", isSpecial: true }),
			makeCategory({ id: "c2", isSpecial: true }),
		])
		expect(tourHasQuotableCategories(tour)).toBe(false)
	})

	test("is true when at least one non-special category sits among special ones", () => {
		const tour = makeTour([
			makeCategory({ id: "c1", isSpecial: true }),
			makeCategory({ id: "c2", isSpecial: false }),
		])
		expect(tourHasQuotableCategories(tour)).toBe(true)
	})
})
