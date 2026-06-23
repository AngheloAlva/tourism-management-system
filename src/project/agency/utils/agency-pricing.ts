// Shared Prisma include fragment for agency tour pricing queries
export const AGENCY_TOUR_PRICING_INCLUDE = {
	tourPricing: {
		include: {
			priceCategoryOverrides: {
				include: {
					tourPriceCategory: {
						select: { id: true, name: true },
					},
				},
			},
			entryOverrides: {
				include: {
					tourEntry: {
						select: { id: true, name: true, variantName: true },
					},
				},
			},
			privatePriceTiers: {
				orderBy: { capacity: "asc" as const },
			},
			tour: {
				select: { id: true, name: true },
			},
		},
	},
} as const

export function parsePrice(value?: string | null): number | null {
	if (!value || value.trim() === "") return null
	const parsed = Number(value.replace(",", "."))
	if (!Number.isFinite(parsed) || parsed < 0) return null
	return parsed
}

interface RawTourPricing {
	tourId: string
	privatePriceTiers?: Array<{ capacity: string | number; price?: string | null }> | null
	priceCategoryOverrides?: Array<{ price: string | number; tourPriceCategoryId: string }> | null
	entryOverrides?: Array<{ price: string | number; tourEntryId: string }> | null
}

function parseOverrides<T extends { price: string | number }>(
	overrides: T[] | null | undefined,
	mapFn: (item: T, parsedPrice: number) => Record<string, unknown>
) {
	return (overrides || []).reduce<Array<Record<string, unknown>>>((acc, item) => {
		const parsed = parsePrice(String(item.price))
		if (parsed !== null && parsed > 0) {
			acc.push(mapFn(item, parsed))
		}
		return acc
	}, [])
}

export function normalizeTourPricing(rawTourPricing: RawTourPricing[] | null | undefined) {
	return (rawTourPricing || [])
		.map((pricing) => {
			const privatePriceTiers = (pricing.privatePriceTiers || [])
				.map((tier) => ({
					capacity: Number(tier.capacity),
					price: parsePrice(tier.price as string),
				}))
				.filter((tier) => tier.capacity > 0 && tier.price !== null)
				.map((tier) => ({ capacity: tier.capacity, price: tier.price as number }))

			const priceCategoryOverrides = parseOverrides(
				pricing.priceCategoryOverrides,
				(o, price) => ({ price, tourPriceCategoryId: o.tourPriceCategoryId })
			)

			const entryOverrides = parseOverrides(
				pricing.entryOverrides,
				(o, price) => ({ price, tourEntryId: o.tourEntryId })
			)

			if (privatePriceTiers.length === 0 && priceCategoryOverrides.length === 0 && entryOverrides.length === 0) {
				return null
			}

			return {
				tourId: pricing.tourId,
				priceCategoryOverrides,
				entryOverrides,
				privatePriceTiers: privatePriceTiers.length > 0 ? privatePriceTiers : undefined,
			}
		})
		.filter((pricing): pricing is NonNullable<typeof pricing> => Boolean(pricing))
}

export function buildTourPricingCreate(normalizedPricing: ReturnType<typeof normalizeTourPricing>) {
	return normalizedPricing.map((pricing) => ({
		privatePriceTiers:
			pricing.privatePriceTiers && pricing.privatePriceTiers.length > 0
				? {
						create: pricing.privatePriceTiers.map((tier) => ({
							capacity: tier.capacity,
							price: tier.price,
						})),
					}
				: undefined,
		priceCategoryOverrides:
			pricing.priceCategoryOverrides.length > 0
				? {
						create: pricing.priceCategoryOverrides.map((o) => ({
							price: o.price as number,
							tourPriceCategory: { connect: { id: o.tourPriceCategoryId as string } },
						})),
					}
				: undefined,
		entryOverrides:
			pricing.entryOverrides.length > 0
				? {
						create: pricing.entryOverrides.map((o) => ({
							price: o.price as number,
							tourEntry: { connect: { id: o.tourEntryId as string } },
						})),
					}
				: undefined,
		tour: {
			connect: { id: pricing.tourId },
		},
	}))
}

export function mapAgencyTourPricing(
	tourPricing: Array<{
		privatePriceTiers: Array<{ capacity: number; price: number; [key: string]: unknown }>
		[key: string]: unknown
	}>
) {
	return tourPricing.map((pricing) => ({
		...pricing,
		privatePriceTiers: pricing.privatePriceTiers.map((tier) => ({
			capacity: tier.capacity,
			price: tier.price,
		})),
	}))
}
