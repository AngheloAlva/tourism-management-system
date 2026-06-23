import { describe, expect, test } from "vitest"
import { summarizeVoucherPricing } from "@/project/sales/utils/voucher-pricing"

const booking = (overrides: Partial<Parameters<typeof summarizeVoucherPricing>[0][number]> = {}) => ({
	priceEntries: [],
	entrySnapshots: [],
	...overrides,
})

describe("summarizeVoucherPricing", () => {
	test("returns zeros and no entrances for empty bookings", () => {
		const summary = summarizeVoucherPricing([])

		expect(summary).toEqual({
			toursTotal: 0,
			entrancesTotal: 0,
			grandTotal: 0,
			entrances: [],
		})
	})

	test("sums tour prices and entrance prices into the grand total", () => {
		// Mirrors V-9089: Geyser del Tatio, 2 adults × $45.000 tour + 2 × $15.000 entrance.
		const summary = summarizeVoucherPricing([
			booking({
				priceEntries: [{ count: 2, priceSnapshot: 45000, receptionSnapshot: 0 }],
				entrySnapshots: [
					{
						id: "snap-1",
						count: 2,
						priceSnapshot: 15000,
						entryName: "Entrada general",
						variantName: "Adulto",
					},
				],
			}),
		])

		expect(summary.toursTotal).toBe(90000)
		expect(summary.entrancesTotal).toBe(30000)
		expect(summary.grandTotal).toBe(120000)
		expect(summary.entrances).toEqual([
			{
				id: "snap-1",
				entryName: "Entrada general",
				variantName: "Adulto",
				count: 2,
				unitPrice: 15000,
				lineTotal: 30000,
			},
		])
	})

	test("aggregates entrance lines across multiple bookings", () => {
		const summary = summarizeVoucherPricing([
			booking({
				priceEntries: [{ count: 1, priceSnapshot: 45000, receptionSnapshot: 0 }],
				entrySnapshots: [
					{ id: "a", count: 1, priceSnapshot: 15000, entryName: "Entrada A", variantName: "Adulto" },
				],
			}),
			booking({
				priceEntries: [{ count: 1, priceSnapshot: 30000, receptionSnapshot: 0 }],
				entrySnapshots: [
					{ id: "b", count: 3, priceSnapshot: 5000, entryName: "Entrada B", variantName: "Niño" },
				],
			}),
		])

		expect(summary.toursTotal).toBe(75000)
		expect(summary.entrancesTotal).toBe(30000)
		expect(summary.grandTotal).toBe(105000)
		expect(summary.entrances.map((e) => e.id)).toEqual(["a", "b"])
		expect(summary.entrances[1].lineTotal).toBe(15000)
	})

	test("handles bookings with tours but no entrances", () => {
		const summary = summarizeVoucherPricing([
			booking({ priceEntries: [{ count: 2, priceSnapshot: 20000, receptionSnapshot: 0 }] }),
		])

		expect(summary.toursTotal).toBe(40000)
		expect(summary.entrancesTotal).toBe(0)
		expect(summary.grandTotal).toBe(40000)
		expect(summary.entrances).toEqual([])
	})
})
