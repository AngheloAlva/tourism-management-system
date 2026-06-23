import type { CalendarViewEvent } from "../types/calendar.types"
import { buildTourSummaryRows } from "./tour-summary-groups"

// ---- Export row type ---------------------------------------------------

export interface GroupedExportRow {
	displayName: string
	dateKey: string
	/** REGULAR for collapsed groups, PRIVATE for individual rows */
	mode: "REGULAR" | "PRIVATE"
	totalPax: number
	/** Number of events in the group ("N salidas") */
	departures: number
	totalCapacity: number
	/** Underlying events for per-event detail in the export layout */
	events: CalendarViewEvent[]
}

// ---- Main function -----------------------------------------------------

/**
 * Wraps buildTourSummaryRows and maps the row union to a flat
 * GroupedExportRow array suitable for PDF/Excel grouped rendering.
 *
 * Pure function — no side-effects, no DOM, no React.
 */
export function buildGroupedExportRows(
	events: CalendarViewEvent[],
): GroupedExportRow[] {
	const rows = buildTourSummaryRows(events)

	return rows.map((row): GroupedExportRow => {
		if (row.kind === "collapsed") {
			return {
				displayName: row.displayName,
				dateKey: row.dateKey,
				mode: "REGULAR",
				totalPax: row.totalPax,
				departures: row.departures,
				totalCapacity: row.totalCapacity,
				events: row.events,
			}
		}

		// IndividualRow (PRIVATE or null-key fallback)
		return {
			displayName: row.displayName,
			dateKey: row.dateKey,
			mode: row.event.mode === "PRIVATE" ? "PRIVATE" : "REGULAR",
			totalPax: row.totalPax,
			departures: 1,
			totalCapacity: row.totalCapacity,
			events: [row.event],
		}
	})
}
