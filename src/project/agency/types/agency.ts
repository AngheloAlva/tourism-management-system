export interface AgencyPriceCategoryOverrideItem {
	tourPriceCategoryId: string
	price: number
	tourPriceCategory: { id: string; name: string }
}

export interface AgencyEntryOverrideItem {
	tourEntryId: string
	price: number
	tourEntry: { id: string; name: string; variantName: string }
}

export interface Agency {
	id: string
	name: string
	active: boolean
	createdAt: Date
	updatedAt: Date
	phone: string | null
	taxId: string | null
	country: string | null
	address: string | null
	website: string | null
	contactEmails: string[]
	codePrefix: string | null
	codeLength: number | null
	tourPricing?: {
		id: string
		tourId: string
		priceCategoryOverrides: AgencyPriceCategoryOverrideItem[]
		entryOverrides: AgencyEntryOverrideItem[]
		privatePriceTiers: { capacity: number; price: number }[]
		tour: {
			id: string
			name: string
		}
	}[]
}
