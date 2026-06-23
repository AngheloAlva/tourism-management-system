import { format } from "date-fns"

import { calendarDayKey } from "@/shared/utils/calendar-day"
import { timeRangesOverlap } from "@/project/events/utils/time-overlap"
import type { CalendarViewEvent } from "../types/calendar.types"
import type { PassengerConflict } from "@/project/events/schemas/reschedule-event.schema"
import { getEventDisplayName } from "@/project/events/utils/event-display"

// --- Output types ---

interface AffectedVoucher {
	voucher: number | null
	saleRecordId: string
	passengerCount: number
	voucherSent: boolean
}

interface ReschedulePreviewResult {
	passengerConflicts: PassengerConflict[]
	affectedVouchers: AffectedVoucher[]
	hasAssociatedTransfers: boolean
}

// --- Pure computation function (callable outside React hooks) ---

/**
 * Client-side reschedule preview — pure function.
 * Computes passenger conflicts and affected vouchers from the already-loaded events array.
 * No network calls — preview only. Server re-validates authoritatively.
 */
function computeReschedulePreview(
	events: CalendarViewEvent[],
	originEventId: string,
	destination: { date: Date; startTime?: string; endTime?: string }
): ReschedulePreviewResult {
	const originEvent = events.find((e) => e.id === originEventId)

	if (!originEvent) {
		return {
			passengerConflicts: [],
			affectedVouchers: [],
			hasAssociatedTransfers: false,
		}
	}

	// Collect saleRecordIds from origin event's active bookings
	const originBookings = originEvent.bookings?.filter(() => true) ?? []

	// Build map of saleRecordId → passengerCount + voucherSent for affected vouchers
	const voucherMap = new Map<string, { voucher: number | null; passengerCount: number; voucherSent: boolean }>()
	for (const booking of originBookings) {
		const existing = voucherMap.get(booking.saleRecordId)
		const sentAt = booking.saleRecord?.customerVoucherEmailSentAt
		const voucherSent = sentAt != null
		if (existing) {
			existing.passengerCount += booking.passengerCount
			if (voucherSent) existing.voucherSent = true
		} else {
			voucherMap.set(booking.saleRecordId, {
				voucher: null, // CalendarViewEvent does not expose voucher number
				passengerCount: booking.passengerCount,
				voucherSent,
			})
		}
	}

	const affectedSaleRecordIds = new Set(voucherMap.keys())

	const affectedVouchers: AffectedVoucher[] = Array.from(voucherMap.entries()).map(
		([saleRecordId, { voucher, passengerCount, voucherSent }]) => ({
			voucher,
			saleRecordId,
			passengerCount,
			voucherSent,
		})
	)

	// Find passenger conflicts: other events on destination date that share a saleRecordId
	const passengerConflicts: PassengerConflict[] = []

	for (const event of events) {
		if (event.id === originEventId) continue
		if (event.status === "CANCELLED") continue
		// event.date is @db.Date (UTC midnight); destination.date is local-midnight from DnD widget.
		// Compare as yyyy-MM-dd strings: calendarDayKey reads UTC parts, format reads local parts.
		if (calendarDayKey(event.date as Date) !== format(destination.date, "yyyy-MM-dd")) continue

		for (const booking of event.bookings ?? []) {
			if (!affectedSaleRecordIds.has(booking.saleRecordId)) continue

			// Check time overlap between destination and this event
			const overlaps = timeRangesOverlap(
				{
					start: destination.startTime ?? null,
					end: destination.endTime ?? null,
				},
				{
					start: event.startTime,
					end: event.endTime,
				}
			)

			if (overlaps) {
				passengerConflicts.push({
					voucher: null, // voucher number not available on CalendarViewEvent
					saleRecordId: booking.saleRecordId,
					conflictingEventId: event.id,
					tourName: getEventDisplayName(event),
					date: event.date as Date,
					startTime: event.startTime,
					endTime: event.endTime,
				})
				break // one conflict per sibling event is enough
			}
		}
	}

	const hasAssociatedTransfers = (originEvent._count?.transfers ?? 0) > 0

	return {
		passengerConflicts,
		affectedVouchers,
		hasAssociatedTransfers,
	}
}

// --- Hook wrapper (for React component use) ---

/**
 * Hook wrapper around computeReschedulePreview.
 * React Compiler handles memoization — no useMemo.
 */
function useReschedulePreview(
	events: CalendarViewEvent[],
	originEventId: string,
	destination: { date: Date; startTime?: string; endTime?: string }
): ReschedulePreviewResult {
	return computeReschedulePreview(events, originEventId, destination)
}

export { useReschedulePreview, computeReschedulePreview }
export type { ReschedulePreviewResult, AffectedVoucher }
