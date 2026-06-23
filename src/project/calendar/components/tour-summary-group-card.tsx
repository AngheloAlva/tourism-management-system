"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, AlertTriangle, Users } from "lucide-react"

import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/shared/components/ui/collapsible"

import { CalendarEventCard } from "./calendar-event-card"
import { computeGroupAssignmentStatus } from "../utils/group-assignment-status"
import type { CollapsedGroupRow, IndividualRow } from "../utils/tour-summary-groups"

// --- Missing assignment icon badges (mirrors CalendarEventCard) ---

function GroupMissingBadges({
	missingGuide,
	missingDriver,
	missingVehicle,
	isTransfer,
}: {
	missingGuide: boolean
	missingDriver: boolean
	missingVehicle: boolean
	isTransfer: boolean
}) {
	const missing: string[] = []
	if (!isTransfer && missingGuide) missing.push("G")
	if (missingDriver) missing.push("C")
	if (missingVehicle) missing.push("V")

	if (missing.length === 0) return null

	return (
		<div className="flex gap-0.5">
			{missing.map((label) => (
				<span
					key={label}
					className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500/20 text-[8px] font-bold text-red-700 dark:bg-red-500/30 dark:text-red-300"
				>
					{label}
				</span>
			))}
		</div>
	)
}

function GroupPassengerAlertIcon() {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white">
					<Users className="h-2.5 w-2.5" />
				</span>
			</TooltipTrigger>
			<TooltipContent side="top">Uno o más pasajeros con datos incompletos</TooltipContent>
		</Tooltip>
	)
}

// --- Collapsed Group Card ---

interface TourSummaryGroupCardProps {
	row: CollapsedGroupRow
	/** "cell" = compact vertical stack for month/week narrow cells; "list" = roomier day-view list */
	variant?: "cell" | "list"
	onGroupAssign: (row: CollapsedGroupRow) => void
	/** When true the Collapsible expand trigger is shown; false in month/week cells */
	allowExpand?: boolean
	conflictingEventIds?: Set<string>
	onEventClick?: (eventId: string) => void
}

export function TourSummaryGroupCard({
	row,
	variant = "list",
	onGroupAssign,
	allowExpand = false,
	conflictingEventIds,
	onEventClick,
}: TourSummaryGroupCardProps) {
	const [isOpen, setIsOpen] = useState(false)

	const hasDistinctTimes = row.distinctStartTimes.length >= 2
	const isCell = variant === "cell"

	const status = computeGroupAssignmentStatus(row)

	const colorClasses =
		row.serviceKind === "TRANSFER"
			? "border-purple-200 bg-purple-50 dark:border-purple-500/40 dark:bg-purple-500/10"
			: "border-blue-200 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10"

	// ---------------------------------------------------------------
	// CELL variant (month/week): the whole card is one interactive zone
	// — no nested controls, so role="button" on the outer div is valid.
	// ---------------------------------------------------------------
	if (isCell) {
		return (
			<div
				role="button"
				tabIndex={0}
				data-testid="group-card"
				data-variant={variant}
				onClick={() => onGroupAssign(row)}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault()
						onGroupAssign(row)
					}
				}}
				className={cn(
					"rounded-lg border bg-card transition-colors cursor-pointer hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
					colorClasses
				)}
			>
				<div className="flex flex-col gap-1 p-2">
					{/* Tour name — wraps up to 2 lines (R3.3) */}
					<p className="line-clamp-2 break-words text-xs font-semibold leading-tight">
						{row.displayName}
					</p>

					{/* Stats + status icons in a single row (R3.2): pax on the left, alerts pushed right */}
					<div className="flex items-center gap-1.5 text-xs">
						<span className="flex items-center gap-0.5 text-muted-foreground">
							<Users className="h-3 w-3 shrink-0" />
							<span className="tabular-nums font-medium">
								{row.totalPax}/{row.totalCapacity}
							</span>
						</span>
						{row.departures > 1 && (
							<span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
								{row.departures} salidas
							</span>
						)}
						<div className="ml-auto flex items-center gap-1">
							{status.passengerAlert && <GroupPassengerAlertIcon />}
							<GroupMissingBadges
								missingGuide={status.missingGuide}
								missingDriver={status.missingDriver}
								missingVehicle={status.missingVehicle}
								isTransfer={status.isTransfer}
							/>
						</div>
					</div>

					{/* Distinct times notice (compact) */}
					{hasDistinctTimes && (
						<div className="flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
							<AlertTriangle className="h-2.5 w-2.5 shrink-0" />
							<span>{row.distinctStartTimes.length} horarios distintos</span>
						</div>
					)}
				</div>
			</div>
		)
	}

	// ---------------------------------------------------------------
	// LIST variant (day-view): chevron <button> is the FIRST sibling;
	// ALL remaining row content (name + date + stats + status icons)
	// lives inside ONE role="button" div so there are no dead zones.
	//
	// Layout:
	//   [chevron-button?] [card-body role="button" — name+date+stats+icons]
	//
	// The outer wrapper is a plain div with no role. The chevron is a
	// real <button> positioned BEFORE (leftmost sibling of) the card-body,
	// NOT nested inside it. This satisfies ARIA (no interactive inside
	// interactive) while making the full meaningful area clickable.
	// ---------------------------------------------------------------
	return (
		<Collapsible open={allowExpand ? isOpen : false} onOpenChange={allowExpand ? setIsOpen : undefined}>
			{/* Outer wrapper: plain div, no role — avoids nesting interactive elements */}
			<div
				data-testid="group-card"
				data-variant={variant}
				className={cn("rounded-lg border bg-card transition-colors", colorClasses)}
			>
				{/* Row: chevron sibling (leftmost) + card-body (role=button, full-width) */}
				<div className="flex items-center gap-0">
					{/* Expand chevron — a real <button>, SIBLING of the card body (not inside it).
					    stopPropagation ensures clicking the chevron only expands, never assigns. */}
					{allowExpand && (
						<div className="shrink-0 pl-2">
							<CollapsibleTrigger asChild>
								<button
									className="flex items-center gap-1 rounded p-1 hover:bg-black/5 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									aria-label={isOpen ? "Colapsar grupo" : "Expandir grupo"}
									onClick={(e) => e.stopPropagation()}
								>
									{isOpen ? (
										<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
									) : (
										<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
									)}
								</button>
							</CollapsibleTrigger>
						</div>
					)}

					{/* Card body — the entire meaningful area (name + date + stats + status icons).
					    role="button" covers everything so there are no non-interactive dead zones.
					    No nested interactive elements — chevron lives as a sibling above. */}
					<div
						role="button"
						tabIndex={0}
						className="flex min-w-0 flex-1 cursor-pointer items-center gap-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 hover:brightness-95"
						onClick={() => onGroupAssign(row)}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault()
								onGroupAssign(row)
							}
						}}
					>
						{/* Tour name + date — wraps up to 2 lines (R3.3) */}
						<div className="min-w-0 flex-1 p-3">
							<p className="line-clamp-2 break-words font-semibold text-sm">{row.displayName}</p>
							<p className="text-muted-foreground text-xs">{row.dateKey}</p>
						</div>

						{/* Stats — inside the card-body button so clicks here also assign */}
						<div className="flex items-center gap-3 pr-2 text-sm">
							<span className="flex items-center gap-1 text-muted-foreground">
								<Users className="h-3.5 w-3.5" />
								<span className="font-medium tabular-nums">
									{row.totalPax}/{row.totalCapacity}
								</span>
							</span>
							<span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
								{row.departures} {row.departures === 1 ? "salida" : "salidas"}
							</span>
						</div>

						{/* Status / alert icons (R3.2) — inside card-body button, no dead zone */}
						<div className="flex items-center gap-1.5 shrink-0 pr-3">
							{status.passengerAlert && <GroupPassengerAlertIcon />}
							<GroupMissingBadges
								missingGuide={status.missingGuide}
								missingDriver={status.missingDriver}
								missingVehicle={status.missingVehicle}
								isTransfer={status.isTransfer}
							/>
						</div>
					</div>
				</div>

				{/* Distinct times notice — below the row, non-interactive */}
				{hasDistinctTimes && (
					<div className="mx-3 mb-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
						<AlertTriangle className="h-3.5 w-3.5 shrink-0" />
						<span>
							este tour tiene {row.distinctStartTimes.length} salidas con horarios distintos
						</span>
					</div>
				)}

				{/* Expanded individual event cards (day-list context only) */}
				{allowExpand && (
					<CollapsibleContent>
						<div className="space-y-2 px-3 pb-3">
							{row.events.map((event) => (
								<CalendarEventCard
									key={event.id}
									event={event}
									variant="expanded"
									onClick={() => onEventClick?.(event.id)}
									isConflicting={conflictingEventIds?.has(event.id)}
								/>
							))}
						</div>
					</CollapsibleContent>
				)}
			</div>
		</Collapsible>
	)
}

// --- Individual Card (PRIVATE events) ---

interface TourSummaryIndividualCardProps {
	row: IndividualRow
	onEventClick: (eventId: string) => void
	conflictingEventIds?: Set<string>
}

export function TourSummaryIndividualCard({
	row,
	onEventClick,
	conflictingEventIds,
}: TourSummaryIndividualCardProps) {
	return (
		<CalendarEventCard
			event={row.event}
			variant="expanded"
			onClick={() => onEventClick(row.event.id)}
			isConflicting={conflictingEventIds?.has(row.event.id)}
		/>
	)
}
