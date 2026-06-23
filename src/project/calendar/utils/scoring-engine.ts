import { startOfWeek, endOfWeek } from "date-fns"
import { calendarDayKey } from "@/shared/utils/calendar-day"

import { getProviderServiceCost } from "../components/event-detail-utils"
import { getMissingAssignments } from "../components/event-detail-utils"
import type { CalendarViewEvent } from "../types/calendar.types"
import { getEventDisplayName } from "@/project/events/utils/event-display"
import type { ProviderRole, ConflictInfo } from "../types/provider-assignment.types"
import type {
	ScoringWeights,
	ProviderScore,
	ScoreBreakdown,
	AutoAssignSuggestion,
	BulkAutoAssignPlan,
	EventSuggestions,
} from "../types/auto-assignment.types"
import { DEFAULT_SCORING_WEIGHTS } from "../types/auto-assignment.types"
import type { ProviderWithCatering } from "@/project/providers/actions/provider.actions"

// =============================================================================
// Hard Filters (return boolean — provider is eligible or not)
// =============================================================================

/**
 * Check time overlap between two events.
 * Events without start/end times are treated as full-day (conservative: always conflicts).
 */
function hasTimeOverlap(
	startA: string | null,
	endA: string | null,
	startB: string | null,
	endB: string | null
): boolean {
	if (!startA || !endA || !startB || !endB) return true
	return startA < endB && startB < endA
}

function toDateKey(date: Date): string {
	return calendarDayKey(date)
}

/**
 * Check if a provider is available for a given event (no time conflicts).
 * Scans all events to find ones where the provider is assigned on the same date
 * and checks for time overlap.
 */
export function isProviderAvailable(
	providerId: string,
	eventDate: Date,
	eventStartTime: string | null,
	eventEndTime: string | null,
	allEvents: CalendarViewEvent[],
	excludeEventId?: string
): boolean {
	const targetDateKey = toDateKey(eventDate)

	for (const event of allEvents) {
		if (excludeEventId && event.id === excludeEventId) continue

		const eventDateKey = toDateKey(event.date)
		if (eventDateKey !== targetDateKey) continue

		const isAssigned =
			event.guideId === providerId ||
			event.driverId === providerId ||
			event.vehicleId === providerId

		if (!isAssigned) continue

		if (
			hasTimeOverlap(
				eventStartTime,
				eventEndTime,
				event.startTime,
				event.endTime
			)
		) {
			return false
		}
	}

	return true
}

/**
 * Check if vehicle capacity is sufficient for the event's passenger count.
 */
export function isVehicleCapacitySufficient(
	vehicleCapacity: number | null | undefined,
	totalPassengers: number
): boolean {
	if (vehicleCapacity == null || vehicleCapacity <= 0) return true // Unknown capacity = don't filter
	if (totalPassengers <= 0) return true
	return vehicleCapacity >= totalPassengers
}

/**
 * Check if a provider is compatible with the requested role and event type.
 */
export function isRoleCompatible(
	provider: ProviderWithCatering,
	role: ProviderRole,
	eventServiceKind: string
): boolean {
	const isTransfer = eventServiceKind === "TRANSFER"

	if (role === "guide") {
		if (isTransfer) return false // Guides don't do transfers
		return provider.guia
	}

	if (role === "driver") {
		const isDriver = provider.conductor || provider.conductorMaquina
		if (!isDriver) return false
		if (isTransfer) return provider.transferIn || provider.transferOut
		return true
	}

	if (role === "vehicle") {
		const isVehicle = provider.maquina || provider.conductorMaquina
		if (!isVehicle) return false
		if (isTransfer) return provider.transferIn || provider.transferOut
		return true
	}

	return false
}

/**
 * Get total passengers for an event from its bookings.
 */
function getEventPassengerCount(event: CalendarViewEvent): number {
	if (!event.bookings) return 0
	return event.bookings.reduce((sum, booking) => sum + booking.passengerCount, 0)
}

/**
 * Get all eligible providers for a given event and role.
 * Applies all hard filters: active, role compatible, availability, capacity.
 */
export function getEligibleProviders(
	event: CalendarViewEvent,
	role: ProviderRole,
	providers: ProviderWithCatering[],
	allEvents: CalendarViewEvent[]
): ProviderScore[] {
	const totalPassengers = getEventPassengerCount(event)
	const results: ProviderScore[] = []

	for (const provider of providers) {
		// Filter: must be active
		if (!provider.isActive) {
			results.push(
				createIneligibleScore(provider, role, "Proveedor inactivo")
			)
			continue
		}

		// Filter: role compatibility
		if (!isRoleCompatible(provider, role, event.serviceKind)) {
			results.push(
				createIneligibleScore(provider, role, "No compatible con el rol")
			)
			continue
		}

		// Filter: already assigned to this event for the same role
		if (
			(role === "guide" && event.guideId === provider.id) ||
			(role === "driver" && event.driverId === provider.id) ||
			(role === "vehicle" && event.vehicleId === provider.id)
		) {
			results.push(
				createIneligibleScore(provider, role, "Ya asignado a este evento")
			)
			continue
		}

		// Filter: time availability
		if (
			!isProviderAvailable(
				provider.id,
				event.date,
				event.startTime,
				event.endTime,
				allEvents,
				event.id
			)
		) {
			results.push(
				createIneligibleScore(provider, role, "Conflicto de horario")
			)
			continue
		}

		// Filter: vehicle capacity (only for vehicles)
		if (
			role === "vehicle" &&
			!isVehicleCapacitySufficient(provider.vehicleCapacity, totalPassengers)
		) {
			results.push(
				createIneligibleScore(
					provider,
					role,
					`Capacidad insuficiente (${provider.vehicleCapacity} pax < ${totalPassengers} requeridos)`
				)
			)
			continue
		}

		// Provider is eligible — will be scored later
		results.push(
			createEligibleScore(provider, role)
		)
	}

	return results
}

// =============================================================================
// Soft Scoring (each returns 0-1)
// =============================================================================

/**
 * Score workload balance. Fewer events this week = higher score.
 * Formula: 1 - (providerEventCount / maxEventCount)
 * If maxEventCount is 0, return 1.0 (all equally idle).
 */
export function scoreWorkload(
	providerId: string,
	allEvents: CalendarViewEvent[],
	weekStart: Date,
	weekEnd: Date
): number {
	const count = getWeeklyEventCount(providerId, weekStart, weekEnd, allEvents)
	// We need context of other providers to normalize — this raw count
	// is normalized in scoreProviders
	return count
}

/**
 * Count events assigned to a provider within a week range.
 */
export function getWeeklyEventCount(
	providerId: string,
	weekStart: Date,
	weekEnd: Date,
	allEvents: CalendarViewEvent[]
): number {
	const startKey = toDateKey(weekStart)
	const endKey = toDateKey(weekEnd)

	let count = 0
	for (const event of allEvents) {
		const dateKey = toDateKey(event.date)
		if (dateKey < startKey || dateKey > endKey) continue

		if (
			event.guideId === providerId ||
			event.driverId === providerId ||
			event.vehicleId === providerId
		) {
			count++
		}
	}

	return count
}

/**
 * Count how many times a provider has been assigned to events with a specific tour name.
 */
export function getTourFamiliarityCount(
	providerId: string,
	tourName: string,
	allEvents: CalendarViewEvent[]
): number {
	let count = 0
	for (const event of allEvents) {
		if (getEventDisplayName(event) !== tourName) continue

		if (
			event.guideId === providerId ||
			event.driverId === providerId ||
			event.vehicleId === providerId
		) {
			count++
		}
	}

	return count
}

/**
 * Normalize workload score: fewer events = higher score.
 * 1.0 for least busy (0 events), 0.0 for most busy.
 */
export function computeWorkloadScore(eventCount: number, maxCount: number): number {
	if (maxCount <= 0) return 1.0
	return 1 - eventCount / maxCount
}

/**
 * Normalize cost score: lower cost = higher score.
 * 1.0 for cheapest, 0.0 for most expensive.
 * Providers with cost=0 get a neutral 0.5 (likely unconfigured).
 */
export function computeCostScore(cost: number, minCost: number, maxCost: number): number {
	if (cost <= 0) return 0.5 // Unconfigured cost — neutral score
	if (maxCost <= minCost) return 1.0 // All same cost or single provider
	return 1 - (cost - minCost) / (maxCost - minCost)
}

/**
 * Normalize familiarity score: more experience = higher score.
 * 1.0 for most familiar, 0.0 for unfamiliar.
 * If maxCount=0 (nobody assigned to this tour), return 0.5 (neutral).
 */
export function computeFamiliarityScore(
	assignmentCount: number,
	maxCount: number
): number {
	if (maxCount <= 0) return 0.5
	return assignmentCount / maxCount
}

// =============================================================================
// Orchestration
// =============================================================================

/**
 * Score a single provider for a given event.
 * Assumes hard filters have already been applied (provider is in the eligible list).
 */
export function scoreProvider(
	provider: ProviderWithCatering,
	role: ProviderRole,
	event: CalendarViewEvent,
	allEvents: CalendarViewEvent[],
	weights: ScoringWeights,
	// Normalization context (pre-computed for the eligible set)
	normContext: {
		maxWeeklyCount: number
		minCost: number
		maxCost: number
		maxFamiliarityCount: number
	}
): ProviderScore {
	const eventLocalDate = new Date(
		(event.date as Date).getUTCFullYear(),
		(event.date as Date).getUTCMonth(),
		(event.date as Date).getUTCDate()
	)
	const weekStart = startOfWeek(eventLocalDate, { weekStartsOn: 1 })
	const weekEnd = endOfWeek(eventLocalDate, { weekStartsOn: 1 })

	const weeklyCount = getWeeklyEventCount(provider.id, weekStart, weekEnd, allEvents)
	const familiarityCount = getTourFamiliarityCount(provider.id, getEventDisplayName(event), allEvents)
	const cost = getProviderServiceCost(provider, role as "guide" | "driver" | "vehicle")

	const workloadScore = computeWorkloadScore(weeklyCount, normContext.maxWeeklyCount)
	const costScore = computeCostScore(cost, normContext.minCost, normContext.maxCost)
	const familiarityScore = computeFamiliarityScore(familiarityCount, normContext.maxFamiliarityCount)

	const totalScore =
		weights.workloadBalance * workloadScore +
		weights.costOptimization * costScore +
		weights.tourFamiliarity * familiarityScore

	const breakdown: ScoreBreakdown = {
		workloadScore,
		costScore,
		familiarityScore,
	}

	return {
		providerId: provider.id,
		providerName: provider.fullName || provider.companyName || "Sin nombre",
		score: totalScore,
		breakdown,
		isEligible: true,
		defaultCost: cost,
	}
}

/**
 * Rank all providers for a specific event and role.
 * Returns sorted list: eligible first (by score desc), then ineligible.
 */
export function rankProvidersForEvent(
	providers: ProviderWithCatering[],
	role: ProviderRole,
	event: CalendarViewEvent,
	allEvents: CalendarViewEvent[],
	weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): ProviderScore[] {
	const eligibilityResults = getEligibleProviders(event, role, providers, allEvents)

	const eligibleProviderIds = new Set(
		eligibilityResults
			.filter((r) => r.isEligible)
			.map((r) => r.providerId)
	)

	if (eligibleProviderIds.size === 0) {
		return eligibilityResults
	}

	// Get eligible provider objects
	const eligibleProviders = providers.filter((p) => eligibleProviderIds.has(p.id))

	// Pre-compute normalization context across the eligible set
	const normContext = computeNormalizationContext(
		eligibleProviders,
		role,
		event,
		allEvents
	)

	// Score each eligible provider
	const scored = eligibleProviders.map((provider) =>
		scoreProvider(provider, role, event, allEvents, weights, normContext)
	)

	// Sort eligible by score descending
	scored.sort((a, b) => b.score - a.score)

	// Append ineligible at the end
	const ineligible = eligibilityResults.filter((r) => !r.isEligible)

	return [...scored, ...ineligible]
}

/**
 * Generate suggestion for a single event: for each missing role, find the best provider.
 */
export function generateSuggestionForEvent(
	event: CalendarViewEvent,
	providers: ProviderWithCatering[],
	allEvents: CalendarViewEvent[],
	weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): AutoAssignSuggestion[] {
	const missingRoles = getMissingAssignments(event)

	if (missingRoles.length === 0) return []

	const suggestions: AutoAssignSuggestion[] = []

	for (const role of missingRoles) {
		const ranked = rankProvidersForEvent(providers, role, event, allEvents, weights)
		const eligible = ranked.filter((r) => r.isEligible)

		if (eligible.length === 0) continue

		suggestions.push({
			eventId: event.id,
			tourName: getEventDisplayName(event),
			date: event.date,
			role,
			suggestedProvider: eligible[0],
			alternatives: eligible.slice(1),
		})
	}

	return suggestions
}

/**
 * Generate event suggestions (grouped by event) for a single event.
 * Returns an EventSuggestions object.
 */
export function generateEventSuggestions(
	event: CalendarViewEvent,
	providers: ProviderWithCatering[],
	allEvents: CalendarViewEvent[],
	weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): EventSuggestions {
	const suggestions = generateSuggestionForEvent(event, providers, allEvents, weights)

	const result: EventSuggestions = { eventId: event.id }

	for (const suggestion of suggestions) {
		if (suggestion.role === "guide") result.guide = suggestion.suggestedProvider
		if (suggestion.role === "driver") result.driver = suggestion.suggestedProvider
		if (suggestion.role === "vehicle") result.vehicle = suggestion.suggestedProvider
	}

	// Mark roles with no eligible providers as null
	const missingRoles = getMissingAssignments(event)
	for (const role of missingRoles) {
		if (role === "guide" && result.guide === undefined) result.guide = null
		if (role === "driver" && result.driver === undefined) result.driver = null
		if (role === "vehicle" && result.vehicle === undefined) result.vehicle = null
	}

	return result
}

/**
 * Generate a bulk auto-assign plan for multiple events.
 * Tracks inter-suggestion conflicts: if event A gets Provider X,
 * event B (overlapping) should NOT also get Provider X.
 */
export function generateBulkAutoAssignPlan(
	events: CalendarViewEvent[],
	providers: ProviderWithCatering[],
	allEvents: CalendarViewEvent[],
	weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): BulkAutoAssignPlan {
	// Find events with missing assignments
	const incompleteEvents = events.filter(
		(event) => getMissingAssignments(event).length > 0
	)

	const suggestions: AutoAssignSuggestion[] = []
	const unassignableEvents: BulkAutoAssignPlan["unassignableEvents"] = []

	// Track tentative assignments to detect inter-suggestion conflicts.
	// Map<providerId, Set<dateKey>> — tracks which dates a provider is tentatively booked.
	// For more precise tracking, we store the actual event times.
	const tentativeAssignments: Array<{
		providerId: string
		eventId: string
		date: Date
		startTime: string | null
		endTime: string | null
	}> = []

	for (const event of incompleteEvents) {
		const missingRoles = getMissingAssignments(event)
		let hasAnySuggestion = false

		for (const role of missingRoles) {
			const ranked = rankProvidersForEvent(providers, role, event, allEvents, weights)
			const eligible = ranked.filter((r) => r.isEligible)

			// Filter out providers that have tentative conflicts
			const availableEligible = eligible.filter((candidate) => {
				return !hasTentativeConflict(
					candidate.providerId,
					event,
					tentativeAssignments
				)
			})

			if (availableEligible.length > 0) {
				const selected = availableEligible[0]
				suggestions.push({
					eventId: event.id,
					tourName: getEventDisplayName(event),
					date: event.date,
					role,
					suggestedProvider: selected,
					alternatives: availableEligible.slice(1),
				})

				// Track this tentative assignment
				tentativeAssignments.push({
					providerId: selected.providerId,
					eventId: event.id,
					date: event.date,
					startTime: event.startTime,
					endTime: event.endTime,
				})

				hasAnySuggestion = true
			} else {
				// Could not find a provider for this role
				unassignableEvents.push({
					eventId: event.id,
					tourName: getEventDisplayName(event),
					reason: `Sin ${getRoleLabel(role)} disponible`,
				})
			}
		}

		if (!hasAnySuggestion && missingRoles.length > 0) {
			// Check if we already added individual role failures
			const alreadyAdded = unassignableEvents.some((u) => u.eventId === event.id)
			if (!alreadyAdded) {
				unassignableEvents.push({
					eventId: event.id,
					tourName: getEventDisplayName(event),
					reason: "Sin proveedores disponibles",
				})
			}
		}
	}

	return {
		suggestions,
		totalEvents: events.length,
		assignableEvents: new Set(suggestions.map((s) => s.eventId)).size,
		unassignableEvents,
	}
}

// =============================================================================
// Helpers (internal)
// =============================================================================

function createIneligibleScore(
	provider: ProviderWithCatering,
	_role: ProviderRole,
	reason: string
): ProviderScore {
	return {
		providerId: provider.id,
		providerName: provider.fullName || provider.companyName || "Sin nombre",
		score: 0,
		breakdown: { workloadScore: 0, costScore: 0, familiarityScore: 0 },
		isEligible: false,
		disqualifyReason: reason,
		defaultCost: 0,
	}
}

function createEligibleScore(
	provider: ProviderWithCatering,
	_role: ProviderRole
): ProviderScore {
	return {
		providerId: provider.id,
		providerName: provider.fullName || provider.companyName || "Sin nombre",
		score: 0, // Will be computed during scoring
		breakdown: { workloadScore: 0, costScore: 0, familiarityScore: 0 },
		isEligible: true,
		defaultCost: 0,
	}
}

/**
 * Pre-compute normalization bounds across the eligible provider set.
 */
function computeNormalizationContext(
	eligibleProviders: ProviderWithCatering[],
	role: ProviderRole,
	event: CalendarViewEvent,
	allEvents: CalendarViewEvent[]
): {
	maxWeeklyCount: number
	minCost: number
	maxCost: number
	maxFamiliarityCount: number
} {
	const normEventLocalDate = new Date(
		(event.date as Date).getUTCFullYear(),
		(event.date as Date).getUTCMonth(),
		(event.date as Date).getUTCDate()
	)
	const weekStart = startOfWeek(normEventLocalDate, { weekStartsOn: 1 })
	const weekEnd = endOfWeek(normEventLocalDate, { weekStartsOn: 1 })

	let maxWeeklyCount = 0
	let minCost = Infinity
	let maxCost = 0
	let maxFamiliarityCount = 0

	for (const provider of eligibleProviders) {
		const weeklyCount = getWeeklyEventCount(provider.id, weekStart, weekEnd, allEvents)
		if (weeklyCount > maxWeeklyCount) maxWeeklyCount = weeklyCount

		const cost = getProviderServiceCost(provider, role as "guide" | "driver" | "vehicle")
		if (cost > 0) {
			if (cost < minCost) minCost = cost
			if (cost > maxCost) maxCost = cost
		}

		const familiarityCount = getTourFamiliarityCount(provider.id, getEventDisplayName(event), allEvents)
		if (familiarityCount > maxFamiliarityCount) maxFamiliarityCount = familiarityCount
	}

	// Handle edge case: no provider had a cost > 0
	if (minCost === Infinity) minCost = 0

	return { maxWeeklyCount, minCost, maxCost, maxFamiliarityCount }
}

/**
 * Check if assigning a provider to an event would conflict with a tentative assignment.
 */
function hasTentativeConflict(
	providerId: string,
	event: CalendarViewEvent,
	tentativeAssignments: Array<{
		providerId: string
		eventId: string
		date: Date
		startTime: string | null
		endTime: string | null
	}>
): boolean {
	const eventDateKey = toDateKey(event.date)

	for (const tentative of tentativeAssignments) {
		if (tentative.providerId !== providerId) continue
		if (toDateKey(tentative.date) !== eventDateKey) continue

		if (
			hasTimeOverlap(
				event.startTime,
				event.endTime,
				tentative.startTime,
				tentative.endTime
			)
		) {
			return true
		}
	}

	return false
}

function getRoleLabel(role: ProviderRole): string {
	const labels: Record<ProviderRole, string> = {
		guide: "guía",
		driver: "conductor",
		vehicle: "vehículo",
	}
	return labels[role] ?? role
}
