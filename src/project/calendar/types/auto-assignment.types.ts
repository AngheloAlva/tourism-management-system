import type { ProviderRole } from "./provider-assignment.types"

// --- Scoring Weights ---

interface ScoringWeights {
	workloadBalance: number
	costOptimization: number
	tourFamiliarity: number
}

const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
	workloadBalance: 0.4,
	costOptimization: 0.35,
	tourFamiliarity: 0.25,
} as const

// --- Score Breakdown ---

interface ScoreBreakdown {
	workloadScore: number
	costScore: number
	familiarityScore: number
}

// --- Provider Score ---

interface ProviderScore {
	providerId: string
	providerName: string
	score: number
	breakdown: ScoreBreakdown
	isEligible: boolean
	disqualifyReason?: string
	defaultCost: number
}

// --- Auto Assign Suggestion ---

interface AutoAssignSuggestion {
	eventId: string
	tourName: string
	date: Date
	role: ProviderRole
	suggestedProvider: ProviderScore
	alternatives: ProviderScore[]
}

// --- Bulk Auto Assign Plan ---

interface UnassignableEvent {
	eventId: string
	tourName: string
	reason: string
}

interface BulkAutoAssignPlan {
	suggestions: AutoAssignSuggestion[]
	totalEvents: number
	assignableEvents: number
	unassignableEvents: UnassignableEvent[]
}

// --- Event Suggestions (grouped by event) ---

interface EventSuggestions {
	eventId: string
	guide?: ProviderScore | null
	driver?: ProviderScore | null
	vehicle?: ProviderScore | null
}

export { DEFAULT_SCORING_WEIGHTS }
export type {
	ScoringWeights,
	ScoreBreakdown,
	ProviderScore,
	AutoAssignSuggestion,
	UnassignableEvent,
	BulkAutoAssignPlan,
	EventSuggestions,
}
