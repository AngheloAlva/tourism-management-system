import { useCallback, useRef } from "react"

import {
	generateEventSuggestions,
	generateBulkAutoAssignPlan,
	rankProvidersForEvent,
} from "../utils/scoring-engine"
import { DEFAULT_SCORING_WEIGHTS } from "../types/auto-assignment.types"
import type { CalendarViewEvent } from "../types/calendar.types"
import type { ProviderRole } from "../types/provider-assignment.types"
import type {
	ScoringWeights,
	ProviderScore,
	BulkAutoAssignPlan,
	EventSuggestions,
} from "../types/auto-assignment.types"
import type { ProviderWithCatering } from "@/project/providers/actions/provider.actions"

interface UseAutoAssignmentOptions {
	weights?: ScoringWeights
}

interface UseAutoAssignmentReturn {
	/** Get the top suggestion for a specific event and role (lazy, computed on demand) */
	getSuggestionForEvent: (eventId: string, role: ProviderRole) => ProviderScore | null
	/** Get ranked alternatives for a specific event and role (lazy, computed on demand) */
	getAlternativesForEvent: (eventId: string, role: ProviderRole) => ProviderScore[]
	/** Get all suggestions for a specific event (lazy, computed on demand) */
	getEventSuggestions: (eventId: string) => EventSuggestions | undefined
	/** Generate a full bulk auto-assign plan (lazy, only when called) */
	generateBulkPlan: () => BulkAutoAssignPlan
}

/**
 * React hook that wraps the scoring engine.
 * All scoring is LAZY — computed on demand, not eagerly on every render.
 * This prevents blocking the main thread with expensive O(n*m) computations.
 */
export function useAutoAssignment(
	targetEvents: CalendarViewEvent[],
	providers: ProviderWithCatering[] | undefined,
	options: UseAutoAssignmentOptions = {},
	allEvents?: CalendarViewEvent[]
): UseAutoAssignmentReturn {
	const weights = options.weights ?? DEFAULT_SCORING_WEIGHTS
	const safeProviders = providers ?? []
	const eventsForConflictCheck = allEvents ?? targetEvents

	// Cache for individual event suggestions (invalidated on re-render via ref reset)
	const cacheRef = useRef<Map<string, EventSuggestions>>(new Map())
	const cacheKeyRef = useRef<string>("")

	// Simple cache key based on array lengths + first/last IDs to detect data changes
	const currentKey = `${targetEvents.length}-${safeProviders.length}-${targetEvents[0]?.id ?? ""}-${targetEvents[targetEvents.length - 1]?.id ?? ""}`
	if (currentKey !== cacheKeyRef.current) {
		cacheRef.current = new Map()
		cacheKeyRef.current = currentKey
	}

	const computeSuggestionsForEvent = useCallback(
		(eventId: string): EventSuggestions | undefined => {
			if (safeProviders.length === 0) return undefined

			// Check cache first
			const cached = cacheRef.current.get(eventId)
			if (cached) return cached

			const event = targetEvents.find((e) => e.id === eventId)
			if (!event) return undefined

			const suggestions = generateEventSuggestions(
				event,
				safeProviders,
				eventsForConflictCheck,
				weights
			)

			cacheRef.current.set(eventId, suggestions)
			return suggestions
		},
		[targetEvents, safeProviders, eventsForConflictCheck, weights]
	)

	const getSuggestionForEvent = useCallback(
		(eventId: string, role: ProviderRole): ProviderScore | null => {
			const suggestions = computeSuggestionsForEvent(eventId)
			if (!suggestions) return null

			if (role === "guide") return suggestions.guide ?? null
			if (role === "driver") return suggestions.driver ?? null
			if (role === "vehicle") return suggestions.vehicle ?? null

			return null
		},
		[computeSuggestionsForEvent]
	)

	const getAlternativesForEvent = useCallback(
		(eventId: string, role: ProviderRole): ProviderScore[] => {
			const event = targetEvents.find((e) => e.id === eventId)
			if (!event || safeProviders.length === 0) return []

			const ranked = rankProvidersForEvent(
				safeProviders,
				role,
				event,
				eventsForConflictCheck,
				weights
			)

			return ranked.filter((r) => r.isEligible).slice(1)
		},
		[targetEvents, eventsForConflictCheck, safeProviders, weights]
	)

	const getEventSuggestions = useCallback(
		(eventId: string): EventSuggestions | undefined => {
			return computeSuggestionsForEvent(eventId)
		},
		[computeSuggestionsForEvent]
	)

	const generateBulkPlan = useCallback((): BulkAutoAssignPlan => {
		return generateBulkAutoAssignPlan(targetEvents, safeProviders, eventsForConflictCheck, weights)
	}, [targetEvents, safeProviders, eventsForConflictCheck, weights])

	return {
		getSuggestionForEvent,
		getAlternativesForEvent,
		getEventSuggestions,
		generateBulkPlan,
	}
}
