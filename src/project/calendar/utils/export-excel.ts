import type { Worksheet } from "exceljs"

import { resolveHotelForDate } from "@/project/sales/utils/resolve-hotel"
import { formatCalendarDay } from "@/shared/utils/calendar-day"
import { COMPANY_INFO } from "@/lib/company-info"
import type { DIET_TYPE } from "@/generated/prisma/enums"
import type { CalendarViewEvent } from "../types/calendar.types"
import type { GroupedExportRow } from "./tour-summary-export"
import { buildManifestRows, sortEvents, type ManifestRow } from "./manifest-rows"
import { DIET_LABELS } from "./export-translations"
import { getEventDisplayName } from "@/project/events/utils/event-display"

export interface ExcelExportOptions {
	events: CalendarViewEvent[]
	filename: string
	scopeLabel: string
	/** When true, writes one worksheet per grouped export row instead of per-event. */
	grouped?: boolean
}

// --- Styling primitives ---

const THIN_BORDER = { style: "thin", color: { argb: "FF000000" } } as const
const ALL_BORDERS = {
	top: THIN_BORDER,
	left: THIN_BORDER,
	bottom: THIN_BORDER,
	right: THIN_BORDER,
} as const

// Passenger table layout. Columns A–H are the manifest; column I is a borderless
// spacer; columns J–K carry the per-venta tracking (Voucher / Mayorista|Vendedor).
const VOUCHER_COL = 10
const COUNTERPARTY_COL = 11
const COLUMN_WIDTHS = [6, 34, 14, 12, 20, 20, 16, 8, 3, 12, 24]

function borderRange(ws: Worksheet, r1: number, c1: number, r2: number, c2: number): void {
	for (let r = r1; r <= r2; r++) {
		for (let c = c1; c <= c2; c++) {
			ws.getCell(r, c).border = ALL_BORDERS
		}
	}
}

function labelCell(ws: Worksheet, row: number, col: number, value: string): void {
	const cell = ws.getCell(row, col)
	cell.value = value
	cell.font = { bold: true, size: 10 }
	cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 }
	cell.border = ALL_BORDERS
}

function valueBox(
	ws: Worksheet,
	row: number,
	colStart: number,
	colEnd: number,
	value: string
): void {
	ws.mergeCells(row, colStart, row, colEnd)
	const cell = ws.getCell(row, colStart)
	cell.value = value
	cell.font = { size: 10 }
	cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 }
	borderRange(ws, row, colStart, row, colEnd)
}

// --- Data helpers ---

// Hoja de ruta shows "Normal" for a normal diet (not "—") to match the printed manifest.
function formatAlimentacion(
	diet: DIET_TYPE | null | undefined,
	dietOther: string | null | undefined
): string {
	if (diet === "OTHER" && dietOther && dietOther.trim() !== "") return dietOther
	if (!diet || diet === "NORMAL") return "Normal"
	return DIET_LABELS[diet]
}

// --- Block rendering ---

const HEADER_ROWS = 6 // Fecha, Tour, Chofer, Guía, Vehículo, Patente
const PASSENGER_HEADERS = ["N", "Nombre", "Rut", "País", "Hotel", "Teléfono", "Alimentación", "Edad"]

function styleHeaderCell(ws: Worksheet, row: number, col: number, value: string): void {
	const cell = ws.getCell(row, col)
	cell.value = value
	cell.font = { bold: true, size: 10 }
	cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F1" } }
	cell.alignment = { vertical: "middle", horizontal: "center" }
	cell.border = ALL_BORDERS
}

function styleDataCell(
	ws: Worksheet,
	row: number,
	col: number,
	value: string | number,
	centered: boolean
): void {
	const cell = ws.getCell(row, col)
	cell.value = value
	cell.font = { size: 10 }
	cell.border = ALL_BORDERS
	cell.alignment = {
		vertical: "middle",
		horizontal: centered ? "center" : "left",
		indent: centered ? 0 : 1,
	}
}

// Writes one passenger row across the manifest columns (A–H) plus the per-venta
// columns (Voucher, Mayorista/Vendedor). Column I is left blank (no border).
function writeManifestRow(ws: Worksheet, row: number, n: number, entry: ManifestRow): void {
	const p = entry.passenger
	const cells: [number, string | number, boolean][] = [
		[1, n, true],
		[2, p.name ?? "—", false],
		[3, p.document ?? "—", false],
		[4, p.nationality ?? "—", false],
		[5, resolveHotelForDate(p.hotels, entry.date) || "—", false],
		[6, p.phone ?? "—", false],
		[7, formatAlimentacion(p.diet, p.dietOther), false],
		[8, p.age !== null && p.age !== undefined ? p.age : "—", true],
		[VOUCHER_COL, entry.voucherLabel, true],
		[COUNTERPARTY_COL, entry.counterparty, false],
	]
	cells.forEach(([col, value, centered]) => styleDataCell(ws, row, col, value, centered))
}

function writeEmptyManifestRow(ws: Worksheet, row: number): void {
	const cells: [number, string, boolean][] = [
		[1, "—", true],
		[2, "Sin pasajeros", false],
		[3, "—", false],
		[4, "—", false],
		[5, "—", false],
		[6, "—", false],
		[7, "—", false],
		[8, "—", true],
		[VOUCHER_COL, "—", true],
		[COUNTERPARTY_COL, "—", false],
	]
	cells.forEach(([col, value, centered]) => styleDataCell(ws, row, col, value, centered))
}

/**
 * Renders one manifest block: shared header (logo + info boxes) plus a single
 * passenger table holding every row, starting at `startRow`. The header info comes
 * from `headerEvent`; the rows may span several ventas (distinguished per row by the
 * Voucher / Mayorista|Vendedor columns). Returns the first free row after the block.
 */
function renderManifestBlock(
	ws: Worksheet,
	headerEvent: CalendarViewEvent,
	rows: ManifestRow[],
	startRow: number,
	logoImageId: number | null
): number {
	const eventDate = headerEvent.date as Date

	// Tour info box: col C (label) + D:E (value), 6 rows
	const tourInfo: [string, string][] = [
		["Fecha", formatCalendarDay(eventDate, "dd-MM-yyyy")],
		["Tour", getEventDisplayName(headerEvent)],
		["Chofer", headerEvent.driver?.fullName ?? "Sin asignar"],
		["Guía", headerEvent.guide?.fullName ?? "Sin asignar"],
		["Vehículo", headerEvent.vehicle?.vehicleModel || headerEvent.vehicle?.vehicleBrand || "Sin asignar"],
		["Patente", headerEvent.vehicle?.vehiclePlate ?? "—"],
	]
	tourInfo.forEach(([label, value], i) => {
		const r = startRow + i
		labelCell(ws, r, 3, label)
		valueBox(ws, r, 4, 5, value)
	})

	// Agency box: col F (label) + G:H (value), 3 rows
	const agencyInfo: [string, string][] = [
		["Agencia", COMPANY_INFO.name],
		["Rut", COMPANY_INFO.rut],
		["Sernatur", COMPANY_INFO.sernatur],
	]
	agencyInfo.forEach(([label, value], i) => {
		const r = startRow + i
		labelCell(ws, r, 6, label)
		valueBox(ws, r, 7, 8, value)
	})

	// Logo floats over columns A:B alongside the info boxes
	if (logoImageId !== null) {
		ws.addImage(logoImageId, {
			tl: { col: 0.15, row: startRow - 1 + 0.1 },
			ext: { width: 120, height: 99 },
			editAs: "oneCell",
		})
	}

	// Passenger table header (one blank row between info boxes and table)
	const tableHeaderRow = startRow + HEADER_ROWS + 1
	PASSENGER_HEADERS.forEach((header, i) => styleHeaderCell(ws, tableHeaderRow, i + 1, header))
	styleHeaderCell(ws, tableHeaderRow, VOUCHER_COL, "Voucher")
	styleHeaderCell(ws, tableHeaderRow, COUNTERPARTY_COL, "Mayorista/Vendedor")

	// Passenger rows (all ventas merged into one table)
	let lastRow = tableHeaderRow
	if (rows.length === 0) {
		lastRow = tableHeaderRow + 1
		writeEmptyManifestRow(ws, lastRow)
	} else {
		rows.forEach((entry, idx) => {
			lastRow = tableHeaderRow + 1 + idx
			writeManifestRow(ws, lastRow, idx + 1, entry)
		})
	}

	// Two blank rows separate consecutive blocks
	return lastRow + 3
}

// Excel sheet names: max 31 chars, no \ / ? * [ ] : , and must be unique.
function buildSheetName(event: CalendarViewEvent, used: Set<string>): string {
	const time = event.startTime ? ` ${event.startTime.slice(0, 5)}` : ""
	const base = `${getEventDisplayName(event)}${time}`
		.replace(/[\\/?*[\]:]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 31)

	let name = base || "Hoja de Ruta"
	let counter = 2
	while (used.has(name.toLowerCase())) {
		const suffix = ` (${counter})`
		name = `${base.slice(0, 31 - suffix.length)}${suffix}`
		counter++
	}
	used.add(name.toLowerCase())
	return name
}

// Sheet name for a grouped export row: "{displayName} {dateKey}" truncated to 31 chars.
function buildGroupedSheetName(row: GroupedExportRow, used: Set<string>): string {
	const base = `${row.displayName} ${row.dateKey}`
		.replace(/[\\/?*[\]:]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 31)

	let name = base || "Resumen"
	let counter = 2
	while (used.has(name.toLowerCase())) {
		const suffix = ` (${counter})`
		name = `${base.slice(0, 31 - suffix.length)}${suffix}`
		counter++
	}
	used.add(name.toLowerCase())
	return name
}

function applyColumnWidths(ws: Worksheet): void {
	COLUMN_WIDTHS.forEach((width, i) => {
		ws.getColumn(i + 1).width = width
	})
	ws.properties.defaultRowHeight = 16
}

export async function generateExcel({ events, filename, grouped }: ExcelExportOptions): Promise<void> {
	// exceljs is a CJS module — webpack bundles it so named exports are accessible directly
	const { Workbook } = await import("exceljs")
	const workbook = new Workbook()

	// Load company logo once (best-effort — export still works if it can't be fetched)
	let logoImageId: number | null = null
	try {
		const res = await fetch(COMPANY_INFO.logoUrl)
		if (res.ok) {
			const buffer = await res.arrayBuffer()
			logoImageId = workbook.addImage({ buffer, extension: "png" })
		}
	} catch {
		// Logo is optional — continue without it
	}

	if (grouped) {
		// Grouped path: one worksheet per GroupedExportRow. All departures of the tour
		// collapse into ONE header + ONE passenger table; the Voucher / Mayorista|Vendedor
		// columns distinguish each venta per passenger.
		const { buildGroupedExportRows } = await import("./tour-summary-export")
		const rows = buildGroupedExportRows(events)
		const usedNames = new Set<string>()

		for (const row of rows) {
			if (row.events.length === 0) continue
			const headerEvent = sortEvents(row.events)[0]!
			const manifestRows = buildManifestRows(row.events)
			const worksheet = workbook.addWorksheet(buildGroupedSheetName(row, usedNames))
			applyColumnWidths(worksheet)
			renderManifestBlock(worksheet, headerEvent, manifestRows, 1, logoImageId)
		}
	} else {
		// Non-grouped path: one worksheet (printable page) per departure. All ventas of
		// that departure share ONE header + ONE table, distinguished per passenger.
		const usedNames = new Set<string>()
		for (const event of sortEvents(events)) {
			const worksheet = workbook.addWorksheet(buildSheetName(event, usedNames))
			applyColumnWidths(worksheet)
			renderManifestBlock(worksheet, event, buildManifestRows([event]), 1, logoImageId)
		}
	}

	// Generate and download
	const buffer = await workbook.xlsx.writeBuffer()
	const blob = new Blob([buffer], {
		type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	})
	const url = URL.createObjectURL(blob)
	const link = document.createElement("a")
	link.href = url
	link.download = filename
	document.body.appendChild(link)
	link.click()
	document.body.removeChild(link)
	URL.revokeObjectURL(url)
}
