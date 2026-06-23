import type { PassengerDetail } from "../schemas/sale-record.schema"

/**
 * Returns true when a passenger slot carries no meaningful user-entered data.
 *
 * A passenger is considered empty when ALL of the following are blank/falsy:
 *  - name (trimmed)
 *  - rut (trimmed)
 *  - age (absent or <= 0)
 *  - phone (trimmed)
 *  - email (trimmed)
 *  - no hotel with a non-empty hotelName
 *  - no allergies selected
 *  - diet_type is absent or "NORMAL" (the default)
 *  - dietOther (trimmed) is blank
 *
 * `nacionality` is intentionally NOT considered: it always carries a default
 * ("1"), so it can never distinguish an empty slot from a filled one.
 */
export function isEmptyPassenger(p: PassengerDetail): boolean {
	if (p.name && p.name.trim() !== "") return false
	if (p.rut && p.rut.trim() !== "") return false
	if (p.age !== undefined && p.age !== null && p.age > 0) return false
	if (p.phone && p.phone.trim() !== "") return false
	if (p.email && p.email.trim() !== "") return false
	if (p.allergies && p.allergies.length > 0) return false
	if (p.diet_type && p.diet_type !== "NORMAL") return false
	if (p.dietOther && p.dietOther.trim() !== "") return false

	const hotels = p.hotels ?? []
	for (const hotel of hotels) {
		if (hotel.hotelName && hotel.hotelName.trim() !== "") return false
	}

	return true
}

/**
 * Pure passenger array reconciliation.
 *
 * - Grow (targetCount > current.length): appends `(targetCount - current.length)`
 *   empty passengers produced by `makeEmpty()`. Final length === targetCount.
 *
 * - Equal: returns `current` unchanged (same reference).
 *
 * - Shrink (targetCount < current.length): removes empty slots starting FROM THE
 *   TAIL, removing at most `(current.length - targetCount)` of them, and ONLY
 *   removing slots where `isEmptyPassenger` is true. Filled passengers are NEVER
 *   removed. Order of survivors is preserved. If there are not enough empty slots
 *   to reach targetCount, the result stays longer than targetCount.
 */
export function reconcilePassengerList(
	current: PassengerDetail[],
	targetCount: number,
	makeEmpty: () => PassengerDetail,
): PassengerDetail[] {
	if (targetCount > current.length) {
		const additions = Array.from(
			{ length: targetCount - current.length },
			makeEmpty,
		)
		return [...current, ...additions]
	}

	if (targetCount === current.length) {
		return current
	}

	// Shrink: remove empty slots tail-first, up to the removable budget.
	let removable = current.length - targetCount
	const out: PassengerDetail[] = []

	for (let i = current.length - 1; i >= 0; i--) {
		if (removable > 0 && isEmptyPassenger(current[i])) {
			removable--
			continue
		}
		out.push(current[i])
	}

	return out.reverse()
}

/** Minimal shape needed to derive the target passenger count from a booking. */
type TargetBooking = {
	priceEntries?: Array<{ count?: number }>
	excludedPassengers?: Array<unknown>
}

/**
 * Single source of truth for the target (global) passenger roster size implied
 * by the event bookings. Used by the form's reconcile logic, the reactive
 * loop-guard selector, and the overflow guard — keeping the formula in ONE place
 * so they can never drift apart again.
 *
 * `passengerArray` is the GLOBAL roster for the whole sale. Each booking may
 * EXCLUDE some passengers; its `priceEntries` counts only the NON-excluded
 * (charged) people. So a booking's implied roster is:
 *
 *     sum(priceEntries.count) + excludedPassengers.length
 *
 * The global roster is the MAX across bookings (every person is either counted
 * or excluded in each booking), with a floor of 1.
 *
 * NOTE: ignoring `excludedPassengers` here was the root cause of the silent
 * passenger data-loss footgun — the target came out smaller than the real
 * roster, so reconcile trimmed real passengers and the overflow guard blocked
 * legitimate sales that use per-booking exclusions.
 */
export function computeTargetPassengerCount(eventBookings: TargetBooking[]): number {
	if (!eventBookings || eventBookings.length === 0) return 1

	const perBooking = eventBookings.map(
		(b) =>
			(b.priceEntries ?? []).reduce((s, e) => s + (e.count ?? 0), 0) +
			(b.excludedPassengers ?? []).length,
	)

	return Math.max(...perBooking, 1)
}

/**
 * Computes how many passengers are in excess relative to the target count
 * derived from eventBookings (see {@link computeTargetPassengerCount}).
 *
 * Returns 0 when:
 *  - eventBookings is empty (check skipped)
 *  - passengerArray.length <= targetCount
 *
 * Returns N > 0 when passengerArray.length exceeds targetCount by N.
 *
 * This is exported so the Zod superRefine and the onSubmit guard can share
 * the exact same computation and message without duplication.
 */
export function passengerOverflowCount(values: {
	passengerArray: PassengerDetail[]
	eventBookings: TargetBooking[]
}): number {
	const { passengerArray, eventBookings } = values

	if (!eventBookings || eventBookings.length === 0) return 0

	const targetCount = computeTargetPassengerCount(eventBookings)

	const overflow = passengerArray.length - targetCount
	return overflow > 0 ? overflow : 0
}
