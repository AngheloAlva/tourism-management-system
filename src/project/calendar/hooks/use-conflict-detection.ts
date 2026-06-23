import { useMemo, useCallback } from "react"

import { calendarDayKey } from "@/shared/utils/calendar-day"
import type { CalendarViewEvent } from "../types/calendar.types"
import type { ConflictInfo, ProviderRole } from "../types/provider-assignment.types"
import { getEventDisplayName } from "@/project/events/utils/event-display"

// --- Time Overlap Check ---

function hasTimeOverlap(
	startA: string | null,
	endA: string | null,
	startB: string | null,
	endB: string | null
): boolean {
	// If either event lacks start or end time, treat as full-day (conservative: always conflicts)
	if (!startA || !endA || !startB || !endB) return true

	// Standard interval overlap: (startA < endB) AND (startB < endA)
	return startA < endB && startB < endA
}

// --- Format date key ---

function toDateKey(date: Date): string {
	return calendarDayKey(date)
}

// --- Hook ---

/**
 * Client-side conflict detection engine.
 * Builds an in-memory index of events by provider + date for O(1) lookup.
 */
export function useConflictDetection(events: CalendarViewEvent[]) {
	// Build provider event index: Map<providerId, Map<dateStr, CalendarViewEvent[]>>
	const providerEventIndex = useMemo(() => {
		const index = new Map<string, Map<string, CalendarViewEvent[]>>()

		function addToIndex(providerId: string, event: CalendarViewEvent) {
			if (!index.has(providerId)) {
				index.set(providerId, new Map())
			}
			const dateMap = index.get(providerId)!
			const dateKey = toDateKey(event.date)

			if (!dateMap.has(dateKey)) {
				dateMap.set(dateKey, [])
			}
			dateMap.get(dateKey)!.push(event)
		}

		for (const event of events) {
			if (event.guideId) addToIndex(event.guideId, event)
			if (event.driverId) addToIndex(event.driverId, event)
			if (event.vehicleId) addToIndex(event.vehicleId, event)
		}

		return index
	}, [events])

	/**
	 * Check if assigning a provider to a target event would cause a conflict.
	 * Returns ConflictInfo for the first conflict found, or null if no conflict.
	 */
	const checkConflict = useCallback(
		(
			providerId: string,
			targetEvent: CalendarViewEvent
		): ConflictInfo | null => {
			const dateMap = providerEventIndex.get(providerId)
			if (!dateMap) return null

			const dateKey = toDateKey(targetEvent.date)
			const eventsOnDate = dateMap.get(dateKey)
			if (!eventsOnDate) return null

			for (const existing of eventsOnDate) {
				// Skip same event
				if (existing.id === targetEvent.id) continue

				if (
					hasTimeOverlap(
						targetEvent.startTime,
						targetEvent.endTime,
						existing.startTime,
						existing.endTime
					)
				) {
					// Determine provider type based on which field matches
					let providerType: ProviderRole = "guide"
					if (existing.driverId === providerId) providerType = "driver"
					if (existing.vehicleId === providerId) providerType = "vehicle"

					return {
						providerId,
						providerName: "", // Caller should fill this in if needed
						providerType,
						conflictingEvent: {
							id: existing.id,
					tourName: getEventDisplayName(existing),
							date: existing.date,
							startTime: existing.startTime,
							endTime: existing.endTime,
						},
						targetEvent: {
							id: targetEvent.id,
							tourName: getEventDisplayName(targetEvent),
							date: targetEvent.date,
							startTime: targetEvent.startTime,
							endTime: targetEvent.endTime,
						},
					}
				}
			}

			return null
		},
		[providerEventIndex]
	)

	/**
	 * Check conflicts for a provider across multiple target events (bulk assignment).
	 * Returns an array of ConflictInfo for all events that would conflict.
	 */
	const checkBulkConflicts = useCallback(
		(
			providerId: string,
			providerType: ProviderRole,
			providerName: string,
			targetEvents: CalendarViewEvent[]
		): ConflictInfo[] => {
			const conflicts: ConflictInfo[] = []

			for (const targetEvent of targetEvents) {
				const conflict = checkConflict(providerId, targetEvent)
				if (conflict) {
					conflicts.push({
						...conflict,
						providerName,
						providerType,
					})
				}
			}

			return conflicts
		},
		[checkConflict]
	)

	/**
	 * Get all events assigned to a provider on a specific date.
	 */
	const getProviderEventsForDate = useCallback(
		(providerId: string, date: Date): CalendarViewEvent[] => {
			const dateMap = providerEventIndex.get(providerId)
			if (!dateMap) return []

			const dateKey = toDateKey(date)
			return dateMap.get(dateKey) ?? []
		},
		[providerEventIndex]
	)

	/**
	 * Compute the set of all event IDs that have at least one provider conflict.
	 * An event has a conflict when it shares a provider with another event
	 * on the same date and their time ranges overlap.
	 */
	const conflictingEventIds = useMemo(() => {
		const ids = new Set<string>()

		for (const [, dateMap] of providerEventIndex) {
			for (const [, dayEvents] of dateMap) {
				if (dayEvents.length < 2) continue

				for (let i = 0; i < dayEvents.length; i++) {
					for (let j = i + 1; j < dayEvents.length; j++) {
						const a = dayEvents[i]
						const b = dayEvents[j]

						if (
							hasTimeOverlap(a.startTime, a.endTime, b.startTime, b.endTime)
						) {
							ids.add(a.id)
							ids.add(b.id)
						}
					}
				}
			}
		}

		return ids
	}, [providerEventIndex])

	/**
	 * Get all conflicts for a specific event.
	 * Returns an array of ConflictInfo describing each conflict.
	 */
	const getConflictsForEvent = useCallback(
		(eventId: string): ConflictInfo[] => {
			const event = events.find((e) => e.id === eventId)
			if (!event) return []

			const conflicts: ConflictInfo[] = []
			const providerIds = [
				{ id: event.guideId, type: "guide" as const },
				{ id: event.driverId, type: "driver" as const },
				{ id: event.vehicleId, type: "vehicle" as const },
			]

			for (const { id: providerId, type: providerType } of providerIds) {
				if (!providerId) continue

				const dateMap = providerEventIndex.get(providerId)
				if (!dateMap) continue

				const dateKey = toDateKey(event.date)
				const eventsOnDate = dateMap.get(dateKey)
				if (!eventsOnDate) continue

				for (const other of eventsOnDate) {
					if (other.id === eventId) continue

					if (
						hasTimeOverlap(
							event.startTime,
							event.endTime,
							other.startTime,
							other.endTime
						)
					) {
						conflicts.push({
							providerId,
							providerName: "",
							providerType,
							conflictingEvent: {
								id: other.id,
								tourName: getEventDisplayName(other),
								date: other.date,
								startTime: other.startTime,
								endTime: other.endTime,
							},
							targetEvent: {
								id: event.id,
								tourName: getEventDisplayName(event),
								date: event.date,
								startTime: event.startTime,
								endTime: event.endTime,
							},
						})
					}
				}
			}

			return conflicts
		},
		[events, providerEventIndex]
	)

	return {
		checkConflict,
		checkBulkConflicts,
		getProviderEventsForDate,
		conflictingEventIds,
		getConflictsForEvent,
	}
}
