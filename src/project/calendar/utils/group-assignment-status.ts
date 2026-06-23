import { isPassengerComplete } from "@/shared/utils/passenger-utils"
import type { CollapsedGroupRow } from "./tour-summary-groups"
import type { CalendarViewEvent } from "../types/calendar.types"

/**
 * Result of aggregating assignment and passenger-data status across all events
 * in a collapsed group row.
 *
 * Each boolean is `true` when at least one event in the group has that problem.
 * `isTransfer` reflects whether the group is a TRANSFER group; when true,
 * `missingGuide` will always be `false` because a guide is not applicable to
 * transfers.
 */
export interface GroupAssignmentStatus {
	missingGuide: boolean
	missingDriver: boolean
	missingVehicle: boolean
	passengerAlert: boolean
	/** True when serviceKind === "TRANSFER" */
	isTransfer: boolean
}

/**
 * Pure function — no side effects, no DOM, no React.
 *
 * Aggregates per-event assignment and passenger-data flags across the entire
 * group. A flag is raised if ANY event in the group has that problem.
 *
 * Guide flag is suppressed for TRANSFER groups (guide N/A).
 */
export function computeGroupAssignmentStatus(
	row: CollapsedGroupRow,
): GroupAssignmentStatus {
	const isTransfer = row.serviceKind === "TRANSFER"

	let missingGuide = false
	let missingDriver = false
	let missingVehicle = false
	let passengerAlert = false

	for (const event of row.events) {
		if (!isTransfer && !event.guideId) missingGuide = true
		if (!event.driverId) missingDriver = true
		if (!event.vehicleId) missingVehicle = true
		if (!passengerAlert && hasIncompletePassengers(event)) passengerAlert = true
	}

	return { missingGuide, missingDriver, missingVehicle, passengerAlert, isTransfer }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if any active passenger in any booking of the event has
 * incomplete data — mirrors the logic in CalendarEventCard's
 * `countIncompletePassengers`.
 */
function hasIncompletePassengers(event: CalendarViewEvent): boolean {
	if (!event.bookings?.length) return false

	for (const booking of event.bookings) {
		const activePassengers = booking.bookingPassengers?.length
			? booking.bookingPassengers.filter((bp) => !bp.excluded).map((bp) => bp.passenger)
			: (booking.saleRecord?.passengers ?? [])

		for (const p of activePassengers) {
			if (!isPassengerComplete(p)) return true
		}
	}

	return false
}
