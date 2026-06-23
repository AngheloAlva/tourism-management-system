export const rutRegex = /^\d{1,2}\.\d{3}\.\d{3}-[0-9kK]$/

export const formatRut = (value: string): string => {
	if (value.length === 0) return ""

	let cleanValue = value.replace(/[^0-9kK]+/g, "")

	cleanValue = cleanValue.slice(0, 9)

	if (cleanValue.length > 1) {
		cleanValue = `${cleanValue.slice(0, -1)}-${cleanValue.slice(-1)}`
	}

	const parts = cleanValue.split("-")
	let numberPart = parts[0]
	numberPart = numberPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".")

	if (parts.length === 1) return numberPart
	return `${numberPart}-${parts[1]}`
}
