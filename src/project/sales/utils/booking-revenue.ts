/**
 * Single source of truth for revenue calculation from split booking data.
 *
 * Uses the split model: PriceEntryInput[] + EntrySnapshotInput[]
 */

export interface PriceEntryInput {
	count: number
	priceSnapshot: number
	receptionSnapshot?: number | null
}

export interface EntrySnapshotInput {
	count: number
	priceSnapshot: number
}

export interface BookingRevenue {
	totalPrice: number
	totalReception: number
	totalEntrance: number
	grandTotal: number
}

export function calculateBookingRevenue(
	priceEntries: PriceEntryInput[],
	entrySnapshots: EntrySnapshotInput[] = []
): BookingRevenue {
	let totalPrice = 0
	let totalReception = 0

	for (const entry of priceEntries) {
		totalPrice += entry.priceSnapshot * entry.count
		totalReception += (entry.receptionSnapshot || 0) * entry.count
	}

	let totalEntrance = 0
	for (const snap of entrySnapshots) {
		totalEntrance += snap.priceSnapshot * snap.count
	}

	return {
		totalPrice: Math.round(totalPrice),
		totalReception: Math.round(totalReception),
		totalEntrance: Math.round(totalEntrance),
		grandTotal: Math.round(totalPrice + totalEntrance),
	}
}

export function calculateReceptionTotal(priceEntries: PriceEntryInput[]): number {
	return Math.round(
		priceEntries.reduce((sum, e) => sum + (e.receptionSnapshot || 0) * e.count, 0)
	)
}
