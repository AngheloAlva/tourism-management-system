/**
 * Time range overlap helper — shared between server action and client-side preview.
 * Conservative rule: if either side is missing start or end, assume overlap (clash).
 * Semantics mirror checkProviderAvailability in event.actions.ts (L694-701).
 */

interface TimeRange {
	start: string | null
	end: string | null
}

function timeRangesOverlap(a: TimeRange, b: TimeRange): boolean {
	// Conservative: if either side has null/undefined times, treat as overlap
	if (!a.start || !a.end || !b.start || !b.end) return true

	return (
		(a.start >= b.start && a.start < b.end) ||
		(a.end > b.start && a.end <= b.end) ||
		(a.start <= b.start && a.end >= b.end)
	)
}

export { timeRangesOverlap }
export type { TimeRange }
