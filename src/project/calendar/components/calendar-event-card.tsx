import { Users, Ban, Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { SALE_MODE } from "@/generated/prisma/enums"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip"
import { isPassengerComplete } from "@/shared/utils/passenger-utils"
import { getEventDisplayName } from "@/project/events/utils/event-display"
import { countCalendarRoster } from "../utils/passenger-totals"

import type {
	CalendarEventCardProps,
	CalendarViewEvent,
	BookingPassengerData,
	Passenger,
} from "../types/calendar.types"

// --- Helpers ---

function countIncompletePassengers(
	bookings?: Array<{
		saleRecord?: { passengers: Passenger[] }
		bookingPassengers?: BookingPassengerData[]
	}>
): number {
	if (!bookings) return 0
	let count = 0
	bookings.forEach((booking) => {
		const activePassengers = booking.bookingPassengers?.length
			? booking.bookingPassengers.filter((bp) => !bp.excluded).map((bp) => bp.passenger)
			: (booking.saleRecord?.passengers ?? [])
		activePassengers.forEach((p) => {
			if (!isPassengerComplete(p)) count++
		})
	})
	return count
}

function getTotalPax(event: CalendarViewEvent): number {
	// Count the real roster (registered passengers), not just what was charged,
	// so the chip matches the event detail header. getEvents already resolves
	// transfers/exclusions into saleRecord.passengers, so this stays accurate.
	return countCalendarRoster(event.bookings)
}

// --- Missing Assignment Badges (solo se muestran los que FALTAN) ---

function MissingAssignmentBadges({ event }: { event: CalendarViewEvent }) {
	const missing: string[] = []

	if (event.serviceKind !== "TRANSFER" && !event.guideId) missing.push("G")
	if (!event.driverId) missing.push("C")
	if (!event.vehicleId) missing.push("V")

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

// --- Color Classes ---

// Legacy "Anulado" tours (carried over from the previous app's migration):
// matched tolerantly (case-insensitive, trimmed, singular or plural) so we catch
// the inconsistent spellings present in the migrated data.
function isCancelledTour(tourName: string | undefined): boolean {
	if (!tourName) return false
	const normalized = tourName.trim().toLowerCase()
	return normalized === "anulado" || normalized === "anulados"
}

function getEventColorClasses(event: CalendarViewEvent): string {
	// Render cancelled tours in a muted gray tone so they don't get confused
	// with active events.
	if (isCancelledTour(event.tour?.name)) {
		return "border-gray-300 bg-gray-100 text-gray-500 dark:border-gray-500/40 dark:bg-gray-500/15 dark:text-gray-400"
	}
	if (event.serviceKind === "TRANSFER") {
		return "border-purple-200 bg-purple-100 text-purple-800 dark:border-purple-500/50 dark:bg-purple-500/20 dark:text-purple-100"
	}
	if (event.mode === SALE_MODE.PRIVATE) {
		return "border-green-200 bg-green-100 text-green-800 dark:border-green-500/50 dark:bg-green-500/20 dark:text-green-100"
	}
	return "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-500/50 dark:bg-blue-500/20 dark:text-blue-100"
}

// --- Selection Checkbox ---

function SelectionCheckbox({ isSelected }: { isSelected: boolean }) {
	return (
		<div
			className={cn(
				"flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
				isSelected
					? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500"
					: "border-slate-400 bg-white dark:border-slate-500 dark:bg-slate-800"
			)}
		>
			{isSelected && <Check className="h-3 w-3" />}
		</div>
	)
}

// --- Alert Icons (Users for incomplete passengers, Ban for conflict) ---

function IncompletePassengersIcon({ count }: { count: number }) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white">
					<Users className="h-2.5 w-2.5" />
				</span>
			</TooltipTrigger>
			<TooltipContent side="top">
				{count} pasajero(s) con datos incompletos
			</TooltipContent>
		</Tooltip>
	)
}

function ConflictIcon() {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Ban className="h-3 w-3 shrink-0 text-red-600 dark:text-red-400" />
			</TooltipTrigger>
			<TooltipContent side="top">Este evento tiene un conflicto de proveedor</TooltipContent>
		</Tooltip>
	)
}

// --- Compact Card (Month / Week) ---

function CompactCard({
	event,
	onClick,
	isConflicting,
	isSelectionMode,
	isSelected,
	onSelect,
}: {
	event: CalendarViewEvent
	onClick: () => void
	isConflicting?: boolean
	isSelectionMode?: boolean
	isSelected?: boolean
	onSelect?: (eventId: string) => void
}) {
	const incompleteCount = countIncompletePassengers(event.bookings)
	const hasIncomplete = incompleteCount > 0
	const totalPax = getTotalPax(event)

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation()
		if (isSelectionMode && onSelect) {
			onSelect(event.id)
		} else {
			onClick()
		}
	}

	return (
		<div
			onClick={handleClick}
			className={cn(
				"relative flex cursor-pointer flex-col rounded border px-1.5 py-1 text-xs shadow-sm transition-all hover:opacity-80 hover:shadow-md",
				{ "brightness-90": event.status === "CONFIRMED" },
				isConflicting && "ring-1 ring-red-400/60 dark:ring-red-500/50",
				isSelectionMode && isSelected && "ring-2 ring-blue-500 dark:ring-blue-400",
				getEventColorClasses(event)
			)}
		>
			<div className="flex min-w-0 items-start gap-1">
				{isSelectionMode && <SelectionCheckbox isSelected={!!isSelected} />}
				<span className="line-clamp-2 font-semibold break-words leading-tight">
					{getEventDisplayName(event)}
				</span>
			</div>
			<div className="mt-0.5 flex items-center justify-between text-[10px] opacity-80">
				<span>{totalPax} pax</span>
				<div className="flex items-center gap-1">
					{hasIncomplete && !isSelectionMode && (
						<IncompletePassengersIcon count={incompleteCount} />
					)}
					{isConflicting && <ConflictIcon />}
					{(event._count?.transfers ?? 0) > 0 && (
						<span className="shrink-0 rounded bg-amber-100 px-1 text-[9px] font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
							T
						</span>
					)}
					<MissingAssignmentBadges event={event} />
				</div>
			</div>
		</div>
	)
}

// --- Expanded Card (Day View) ---

function ExpandedCard({
	event,
	onClick,
	isConflicting,
	isSelectionMode,
	isSelected,
	onSelect,
}: {
	event: CalendarViewEvent
	onClick: () => void
	isConflicting?: boolean
	isSelectionMode?: boolean
	isSelected?: boolean
	onSelect?: (eventId: string) => void
}) {
	const incompleteCount = countIncompletePassengers(event.bookings)
	const hasIncomplete = incompleteCount > 0
	const totalPax = getTotalPax(event)

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation()
		if (isSelectionMode && onSelect) {
			onSelect(event.id)
		} else {
			onClick()
		}
	}

	return (
		<div
			onClick={handleClick}
			className={cn(
				"relative flex h-full cursor-pointer flex-col gap-1 overflow-hidden rounded border px-2 py-1.5 text-xs shadow-sm transition-all hover:opacity-80 hover:shadow-md",
				{ "brightness-90": event.status === "CONFIRMED" },
				isConflicting && "ring-1 ring-red-400/60 dark:ring-red-500/50",
				isSelectionMode && isSelected && "ring-2 ring-blue-500 dark:ring-blue-400",
				getEventColorClasses(event)
			)}
		>
			<div className="flex min-w-0 items-start gap-1">
				{isSelectionMode && <SelectionCheckbox isSelected={!!isSelected} />}
				<span className="line-clamp-2 font-semibold break-words leading-tight">
					{getEventDisplayName(event)}
				</span>
			</div>
			<div className="flex items-center justify-between text-[10px] opacity-80">
				<span>{totalPax} pax</span>
				<div className="flex items-center gap-1">
					{hasIncomplete && !isSelectionMode && (
						<IncompletePassengersIcon count={incompleteCount} />
					)}
					{isConflicting && <ConflictIcon />}
					{(event._count?.transfers ?? 0) > 0 && (
						<span className="shrink-0 rounded bg-amber-100 px-1 text-[9px] font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
							T
						</span>
					)}
					<MissingAssignmentBadges event={event} />
				</div>
			</div>
		</div>
	)
}

// --- Main Component ---

export function CalendarEventCard({
	event,
	variant,
	onClick,
	isConflicting,
	isSelectionMode,
	isSelected,
	onSelect,
}: CalendarEventCardProps) {
	if (variant === "expanded") {
		return (
			<ExpandedCard
				event={event}
				onClick={onClick}
				isConflicting={isConflicting}
				isSelectionMode={isSelectionMode}
				isSelected={isSelected}
				onSelect={onSelect}
			/>
		)
	}

	return (
		<CompactCard
			event={event}
			onClick={onClick}
			isConflicting={isConflicting}
			isSelectionMode={isSelectionMode}
			isSelected={isSelected}
			onSelect={onSelect}
		/>
	)
}
