export type VoucherPassengerFilter = "all" | "with-data" | "first"

export const VOUCHER_PASSENGER_FILTERS: readonly VoucherPassengerFilter[] = [
	"all",
	"with-data",
	"first",
]

const hasMainData = (passenger: { name?: string | null; document?: string | null }) =>
	Boolean(passenger.name?.trim()) || Boolean(passenger.document?.trim())

/**
 * Filters the passenger list shown on the voucher PDF. Pricing is unaffected —
 * only the displayed passenger table changes.
 *
 * - "all": every passenger (default).
 * - "with-data": hides passengers with no name and no document.
 * - "first": only the first passenger, who is usually the encargado.
 */
export function filterVoucherPassengers<
	T extends { name?: string | null; document?: string | null },
>(passengers: T[], filter: VoucherPassengerFilter): T[] {
	switch (filter) {
		case "first":
			return passengers.slice(0, 1)
		case "with-data":
			return passengers.filter(hasMainData)
		case "all":
		default:
			return passengers
	}
}
