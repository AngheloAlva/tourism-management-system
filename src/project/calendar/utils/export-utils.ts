import { format } from "date-fns"

import { resolveHotelForDate } from "@/project/sales/utils/resolve-hotel"
import { formatCalendarDay, calendarDayKey } from "@/shared/utils/calendar-day"
import type { CalendarViewEvent, PdfEventData } from "../types/calendar.types"
import { formatDiet, formatAllergies } from "./export-translations"
import type { ExportScope } from "./export-filters"
import { getEventDisplayName } from "@/project/events/utils/event-display"
import type { GroupedExportRow } from "./tour-summary-export"

export type ExportFormat = "pdf" | "xlsx"

function insertSoftBreaks(value: string): string {
	return value.replace(/(.{4})/g, "$1​")
}

export function slugify(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-zA-Z0-9]+/g, "-")
		.toLowerCase()
		.replace(/^-+|-+$/g, "")
}

export function buildExportFilename({
	scope,
	format: fmt,
}: {
	scope: ExportScope
	format: ExportFormat
}): string {
	const ext = fmt === "pdf" ? "pdf" : "xlsx"

	switch (scope.kind) {
		case "day": {
			const dateStr = calendarDayKey(scope.date)
			return `control-salidas_dia_${dateStr}.${ext}`
		}

		case "tour": {
			const dateStr = calendarDayKey(scope.date)
			const slug = slugify(scope.tourName)
			return `control-salidas_tour-${slug}_${dateStr}.${ext}`
		}

		case "provider-type": {
			const dateStr = calendarDayKey(scope.date)
			const typeSlug =
				scope.providerType === "guide"
					? "guias"
					: scope.providerType === "driver"
						? "conductores"
						: "vehiculos"
			return `control-salidas_${typeSlug}_${dateStr}.${ext}`
		}

		case "selection": {
			// Use today as fallback; caller should resolve first event date if needed
			const dateStr = format(new Date(), "yyyy-MM-dd")
			return `control-salidas_seleccion_${dateStr}.${ext}`
		}
	}
}

export interface GeneratePdfOptions {
	events: CalendarViewEvent[]
	filename: string
	date: string
	totalPassengers: number
	/** When true, events are collapsed into grouped sections via buildGroupedExportRows. */
	grouped?: boolean
}

// Lazily imported to avoid circular dep at module load time.
async function getGroupedExportRows(events: CalendarViewEvent[]): Promise<GroupedExportRow[]> {
	const { buildGroupedExportRows } = await import("./tour-summary-export")
	return buildGroupedExportRows(events)
}

export async function generatePdf({
	events,
	filename,
	date,
	totalPassengers,
	grouped,
}: GeneratePdfOptions): Promise<void> {
	const [React, { pdf }, { DailyRoutePdf }] = await Promise.all([
		import("react"),
		import("@react-pdf/renderer"),
		import("../components/daily-route-pdf"),
	])

	// When grouped, flatten grouped rows back to per-event PdfEventData but sorted by group
	// so that REGULAR collapsed groups appear as one representative entry followed by their
	// individual events, and PRIVATE rows appear individually. The PDF component renders a
	// section per PdfEventData entry, which is the correct granularity for the route manifest.
	// The grouping summary (totalPax, departures) is embedded in the section title via a
	// dedicated grouped section component injected through the events array ordering.
	const pdfEvents = grouped
		? await buildGroupedPdfData(events)
		: mapEventsToPdfData(events)

	const element = React.createElement(DailyRoutePdf, {
		date,
		events: pdfEvents,
		totalPassengers,
	}) as Parameters<typeof pdf>[0]
	const blob = await pdf(element).toBlob()

	const url = URL.createObjectURL(blob)
	const link = document.createElement("a")
	link.href = url
	link.download = filename
	document.body.appendChild(link)
	link.click()
	document.body.removeChild(link)
	URL.revokeObjectURL(url)
}

/**
 * Pure annotation helper: applies a group-summary label to the first entry of
 * a REGULAR multi-departure group and leaves every entry's passengerCount intact.
 *
 * Rules:
 *  - Only REGULAR rows with departures > 1 receive a group label.
 *  - The label is applied ONLY to the first entry (index 0).
 *  - Every entry keeps its OWN passengerCount (not inflated to group total).
 *  - PRIVATE rows and single-departure rows are returned unchanged.
 *
 * Exported for unit testing.
 */
export function annotateGroupedPdfEntries(
	row: GroupedExportRow,
	entries: PdfEventData[],
): PdfEventData[] {
	if (row.mode !== "REGULAR" || row.departures <= 1 || entries.length === 0) {
		return entries
	}
	return entries.map((entry, idx) => {
		if (idx === 0) {
			return {
				...entry,
				tourName: `${row.displayName} (${row.departures} salidas · ${row.totalPax} pax total)`,
				// passengerCount intentionally NOT changed — keeps the event's own count
			}
		}
		return entry
	})
}

/**
 * For grouped (TOUR_SUMMARY) PDF exports: orders PdfEventData entries by group
 * (REGULAR collapsed groups first, then PRIVATE individual rows) sorted by dateKey.
 * Within each group, individual events are each mapped to their own PdfEventData entry
 * so the PDF route-manifest format is preserved. The group label is applied only once
 * (on the first event of each group) so the manifest shows correct per-salida pax.
 */
async function buildGroupedPdfData(events: CalendarViewEvent[]): Promise<PdfEventData[]> {
	const rows = await getGroupedExportRows(events)
	const result: PdfEventData[] = []

	for (const row of rows) {
		const rawEntries: PdfEventData[] = []
		for (const event of row.events) {
			const base = mapEventsToPdfData([event])
			if (base.length === 0) continue
			rawEntries.push({ ...base[0]! })
		}
		const annotated = annotateGroupedPdfEntries(row, rawEntries)
		result.push(...annotated)
	}

	return result
}

export function mapEventsToPdfData(events: CalendarViewEvent[]): PdfEventData[] {
	return events
		.slice()
		.sort((a, b) => {
			if (!a.startTime && !b.startTime) return 0
			if (!a.startTime) return 1
			if (!b.startTime) return -1
			return a.startTime.localeCompare(b.startTime)
		})
		.map((event) => {
			const guideName = event.guide?.fullName ?? "Sin asignar"
			const driverName = event.driver?.fullName ?? "Sin asignar"

			const vehicleParts = [
				event.vehicle?.vehicleBrand,
				event.vehicle?.vehicleModel,
				event.vehicle?.vehiclePlate ? `(${event.vehicle.vehiclePlate})` : null,
			].filter(Boolean)
			const vehicleInfo = vehicleParts.length > 0 ? vehicleParts.join(" ") : "Sin asignar"

			const eventDate = event.date as Date
			const passengers =
				event.bookings?.flatMap(
					(booking) => {
						// Use bookingPassengers (non-excluded) if available, fall back to saleRecord.passengers
						const activePassengers = booking.bookingPassengers?.length
							? booking.bookingPassengers
								.filter((bp) => !bp.excluded)
								.map((bp) => bp.passenger)
							: booking.saleRecord?.passengers ?? []
						return activePassengers.map((p) => ({
							name: p.name || "—",
							hotel: resolveHotelForDate(p.hotels, eventDate) || "—",
							phone: p.phone ? insertSoftBreaks(p.phone) : "—",
							nationality: p.nationality || "—",
							document: p.document || "—",
							age: p.age !== null && p.age !== undefined ? String(p.age) : "—",
							allergies: formatAllergies(p.allergies),
							diet: formatDiet(p.diet, p.dietOther),
						}))
					}
				) ?? []

			const passengerCount =
				event.bookings?.reduce((sum, b) => sum + b.passengerCount, 0) ?? 0

			const notes = [event.operationalNotes, event.comments].filter(Boolean).join(" | ")

			return {
				tourName: getEventDisplayName(event),
				date: (event.date as Date).toISOString(),
				startTime: event.startTime ?? "",
				endTime: event.endTime ?? "",
				mode: event.mode,
				guideName,
				driverName,
				vehicleInfo,
				passengers,
				passengerCount,
				notes,
			}
		})
}
