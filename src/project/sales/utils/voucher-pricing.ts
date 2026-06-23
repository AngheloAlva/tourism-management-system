/**
 * Voucher pricing aggregation.
 *
 * Splits a sale's bookings into tour totals and entrance ("entradas") totals so
 * the voucher PDF can show them as separate sections. The grand total includes
 * both — earlier the voucher only summed tour prices and silently dropped the
 * entrance fees (see V-9089: $90.000 tours + $30.000 entradas shown as $90.000).
 */

import { calculateBookingRevenue, type PriceEntryInput } from "./booking-revenue"

export interface VoucherEntranceLine {
	id: string
	entryName: string
	variantName: string
	count: number
	unitPrice: number
	lineTotal: number
}

export interface VoucherPricingSummary {
	toursTotal: number
	entrancesTotal: number
	grandTotal: number
	entrances: VoucherEntranceLine[]
}

interface VoucherBookingInput {
	priceEntries: PriceEntryInput[]
	entrySnapshots: Array<{
		id: string
		count: number
		priceSnapshot: number
		entryName: string
		variantName: string
	}>
}

export function summarizeVoucherPricing(
	eventBookings: VoucherBookingInput[]
): VoucherPricingSummary {
	let toursTotal = 0
	let entrancesTotal = 0
	const entrances: VoucherEntranceLine[] = []

	for (const booking of eventBookings) {
		const revenue = calculateBookingRevenue(
			booking.priceEntries || [],
			booking.entrySnapshots || []
		)
		toursTotal += revenue.totalPrice
		entrancesTotal += revenue.totalEntrance

		for (const snap of booking.entrySnapshots || []) {
			entrances.push({
				id: snap.id,
				entryName: snap.entryName,
				variantName: snap.variantName,
				count: snap.count,
				unitPrice: snap.priceSnapshot,
				lineTotal: Math.round(snap.priceSnapshot * snap.count),
			})
		}
	}

	return {
		toursTotal,
		entrancesTotal,
		grandTotal: toursTotal + entrancesTotal,
		entrances,
	}
}
