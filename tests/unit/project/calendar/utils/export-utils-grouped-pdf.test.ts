/**
 * Unit tests for annotateGroupedPdfEntries — pure helper that applies group
 * summary annotations to PdfEventData arrays without inflating per-event pax.
 *
 * H1 regression coverage:
 *  - A 3-event REGULAR group keeps each event's REAL passengerCount
 *  - The group label "(N salidas · totalPax pax total)" appears only ONCE
 *    (on the first event of each group), not on every entry
 *  - A single-departure REGULAR row (departures === 1) gets no group suffix
 *  - PRIVATE rows are never annotated regardless of count
 */

import { describe, it, expect } from "vitest"
import { annotateGroupedPdfEntries } from "@/project/calendar/utils/export-utils"
import type { PdfEventData } from "@/project/calendar/types/calendar.types"
import type { GroupedExportRow } from "@/project/calendar/utils/tour-summary-export"

// ---- Factories ---------------------------------------------------------

function makePdfEntry(overrides: Partial<PdfEventData> = {}): PdfEventData {
	return {
		tourName: "Valle de la Luna",
		date: "2026-06-01T00:00:00.000Z",
		startTime: "08:00",
		endTime: "13:00",
		mode: "REGULAR",
		guideName: "Sin asignar",
		driverName: "Sin asignar",
		vehicleInfo: "Sin asignar",
		passengers: [],
		passengerCount: 5,
		notes: "",
		...overrides,
	}
}

function makeGroupedRow(overrides: Partial<GroupedExportRow> & { eventCount?: number } = {}): {
	row: GroupedExportRow
	entries: PdfEventData[]
} {
	const eventCount = overrides.eventCount ?? 3
	// entries simulate the raw per-event PdfEventData before annotation
	const entries: PdfEventData[] = Array.from({ length: eventCount }, (_, i) =>
		makePdfEntry({ passengerCount: 10 + i, tourName: overrides.displayName ?? "Valle de la Luna" })
	)
	const row: GroupedExportRow = {
		displayName: overrides.displayName ?? "Valle de la Luna",
		dateKey: overrides.dateKey ?? "2026-06-01",
		mode: overrides.mode ?? "REGULAR",
		totalPax: overrides.totalPax ?? entries.reduce((s, e) => s + e.passengerCount, 0),
		departures: overrides.departures ?? eventCount,
		totalCapacity: overrides.totalCapacity ?? 15 * eventCount,
		events: [],
		...overrides,
	}
	return { row, entries }
}

// ---- Tests -------------------------------------------------------------

describe("annotateGroupedPdfEntries — H1 regression: per-event pax integrity", () => {
	it("3-event REGULAR group: each entry keeps its own passengerCount (not inflated to group total)", () => {
		const { row, entries } = makeGroupedRow({ eventCount: 3, totalPax: 33 })
		// Individual counts are 10, 11, 12

		const annotated = annotateGroupedPdfEntries(row, entries)

		expect(annotated[0].passengerCount).toBe(10)
		expect(annotated[1].passengerCount).toBe(11)
		expect(annotated[2].passengerCount).toBe(12)
	})

	it("3-event REGULAR group: group label appears ONLY on the first entry", () => {
		const { row, entries } = makeGroupedRow({ eventCount: 3, departures: 3, totalPax: 33 })

		const annotated = annotateGroupedPdfEntries(row, entries)

		// First entry gets the suffix
		expect(annotated[0].tourName).toContain("3 salidas")
		expect(annotated[0].tourName).toContain("33 pax total")
		// Other entries do NOT get the group label
		expect(annotated[1].tourName).not.toContain("salidas")
		expect(annotated[2].tourName).not.toContain("salidas")
	})

	it("single-departure REGULAR row: no group suffix added", () => {
		const { row, entries } = makeGroupedRow({ eventCount: 1, departures: 1, totalPax: 10 })

		const annotated = annotateGroupedPdfEntries(row, entries)

		expect(annotated[0].tourName).toBe("Valle de la Luna")
		expect(annotated[0].passengerCount).toBe(10)
	})

	it("PRIVATE row: never annotated regardless of count", () => {
		const { row, entries } = makeGroupedRow({ eventCount: 1, mode: "PRIVATE", departures: 1, totalPax: 7 })

		const annotated = annotateGroupedPdfEntries(row, entries)

		expect(annotated[0].tourName).toBe("Valle de la Luna")
		expect(annotated[0].passengerCount).toBe(10)
	})

	it("returns entries in same order as input", () => {
		const { row, entries } = makeGroupedRow({ eventCount: 2, departures: 2, totalPax: 21 })

		const annotated = annotateGroupedPdfEntries(row, entries)

		expect(annotated).toHaveLength(2)
	})
})
