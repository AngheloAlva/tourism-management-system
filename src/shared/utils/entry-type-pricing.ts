export function getPricesByAge<
	T extends {
		ageMin?: number | null
		ageMax?: number | null
		isSpecial?: boolean
		isDefault?: boolean
	},
>(categories: T[], age: number | null | undefined): T | undefined {
	const nonSpecial = categories.filter((c) => !c.isSpecial)
	if (!age) {
		return nonSpecial.find((c) => c.isDefault) ?? nonSpecial[0]
	}
	const match = nonSpecial.find(
		(c) => c.ageMin != null && c.ageMax != null && age >= c.ageMin && age <= c.ageMax
	)
	return match ?? nonSpecial.find((c) => c.isDefault) ?? nonSpecial[0]
}
