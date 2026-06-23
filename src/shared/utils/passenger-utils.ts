export function isPassengerComplete(passenger: {
	name?: string | null
	document?: string | null
	nationality?: string | null
	phone?: string | null
	hotels?: Array<unknown> | null
}): boolean {
	return !!(
		passenger.name &&
		passenger.document &&
		passenger.nationality &&
		passenger.phone &&
		passenger.hotels &&
		passenger.hotels.length > 0
	)
}
