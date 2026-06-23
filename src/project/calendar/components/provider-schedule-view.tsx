import { useMemo, useState } from "react"
import { format, addDays, startOfWeek, eachDayOfInterval } from "date-fns"
import { calendarDayKey, todayInSantiago } from "@/shared/utils/calendar-day"
import { es } from "date-fns/locale"
import { ChevronDown, ChevronRight, Search, Users } from "lucide-react"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/shared/components/ui/scroll-area"
import { Input } from "@/shared/components/ui/input"
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/shared/components/ui/collapsible"
import { Button } from "@/shared/components/ui/button"

import { ProviderScheduleRow } from "./provider-schedule-row"
import { CalendarEventCard } from "./calendar-event-card"
import { DroppableEventWrapper } from "./droppable-event-wrapper"
import { getProviderServiceCost } from "./event-detail-utils"

import type { CalendarViewEvent } from "../types/calendar.types"
import type { ProviderRole } from "../types/provider-assignment.types"
import type { ProviderWithCatering } from "@/project/providers/actions/provider.actions"

// --- Workload Summary Helpers ---

const WORKLOAD_LEVEL = {
	LIGHT: "light",
	NORMAL: "normal",
	HEAVY: "heavy",
	OVERLOADED: "overloaded",
} as const

type WorkloadLevel = (typeof WORKLOAD_LEVEL)[keyof typeof WORKLOAD_LEVEL]

function getOverallWorkloadLevel(totalEvents: number): WorkloadLevel {
	if (totalEvents <= 5) return WORKLOAD_LEVEL.LIGHT
	if (totalEvents <= 10) return WORKLOAD_LEVEL.NORMAL
	if (totalEvents <= 15) return WORKLOAD_LEVEL.HEAVY
	return WORKLOAD_LEVEL.OVERLOADED
}

function getWorkloadColorClasses(level: WorkloadLevel): string {
	switch (level) {
		case WORKLOAD_LEVEL.LIGHT:
			return "text-emerald-600 bg-emerald-500/20 dark:text-emerald-400 dark:bg-emerald-500/30"
		case WORKLOAD_LEVEL.NORMAL:
			return "text-blue-600 bg-blue-500/20 dark:text-blue-400 dark:bg-blue-500/30"
		case WORKLOAD_LEVEL.HEAVY:
			return "text-amber-600 bg-amber-500/20 dark:text-amber-400 dark:bg-amber-500/30"
		case WORKLOAD_LEVEL.OVERLOADED:
			return "text-red-600 bg-red-500/20 dark:text-red-400 dark:bg-red-500/30"
	}
}

// --- Provider Entry ---

interface ProviderEntry {
	id: string
	name: string
	role: ProviderRole
	cost: number
}

function buildProviderEntries(
	providers: ProviderWithCatering[] | undefined,
	role: ProviderRole
): ProviderEntry[] {
	if (!providers) return []

	const filtered = providers.filter((p) => {
		if (!p.isActive) return false
		if (role === "guide") return !!p.guia
		if (role === "driver") return !!(p.conductor || p.conductorMaquina)
		if (role === "vehicle") return !!(p.maquina || p.conductorMaquina)
		return false
	})

	return filtered.map((p) => {
		let name = p.fullName || p.companyName || "Sin nombre"

		if (role === "vehicle") {
			const vehicleLabel = [p.vehicleBrand, p.vehicleModel].filter(Boolean).join(" ")
			if (vehicleLabel) name = vehicleLabel
			if (p.vehiclePlate) name += ` (${p.vehiclePlate})`
		}

		return {
			id: p.id,
			name,
			role,
			cost: getProviderServiceCost(p, role),
		}
	})
}

function getProviderWeekEvents(
	events: CalendarViewEvent[],
	providerId: string,
	role: ProviderRole,
	weekDays: Date[]
): CalendarViewEvent[] {
	// weekDays are local-midnight Dates from eachDayOfInterval; event.date is @db.Date (UTC midnight).
	// Compare as yyyy-MM-dd strings to avoid cross-timezone false mismatches.
	const weekDayKeys = new Set(weekDays.map((d) => format(d, "yyyy-MM-dd")))
	return events.filter((event) => {
		if (!weekDayKeys.has(calendarDayKey(event.date as Date))) return false
		if (role === "guide" && event.guideId === providerId) return true
		if (role === "driver" && event.driverId === providerId) return true
		if (role === "vehicle" && event.vehicleId === providerId) return true
		return false
	})
}

// --- Day Header ---

const WEEK_DAYS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

// --- Props ---

interface ProviderScheduleViewProps {
	events: CalendarViewEvent[]
	selectedDate: Date
	onEventClick: (eventId: string) => void
	conflictingEventIds?: Set<string>
	providers: ProviderWithCatering[] | undefined
}

// --- Role Section ---

interface RoleSectionProps {
	title: string
	entries: ProviderEntry[]
	weekDays: Date[]
	events: CalendarViewEvent[]
	conflictingEventIds?: Set<string>
	onEventClick: (eventId: string) => void
	search: string
}

function RoleSection({
	title,
	entries,
	weekDays,
	events,
	conflictingEventIds,
	onEventClick,
	search,
}: RoleSectionProps) {
	const [isOpen, setIsOpen] = useState(true)

	const filteredEntries = useMemo(() => {
		if (!search.trim()) return entries
		const q = search.toLowerCase()
		return entries.filter((e) => e.name.toLowerCase().includes(q))
	}, [entries, search])

	if (filteredEntries.length === 0) return null

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<CollapsibleTrigger asChild>
				<Button
					variant="ghost"
					className="hover:bg-muted/50 flex w-full items-center justify-start gap-2 rounded-none border-b px-3 py-2"
				>
					{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
					<span className="text-xs font-semibold tracking-wide uppercase">{title}</span>
					<span className="text-muted-foreground text-[10px]">({filteredEntries.length})</span>
				</Button>
			</CollapsibleTrigger>
			<CollapsibleContent>
				{filteredEntries.map((entry, index) => (
					<ProviderScheduleRow
						key={entry.id}
						providerId={entry.id}
						providerName={entry.name}
						role={entry.role}
						cost={entry.cost}
						weekDays={weekDays}
						events={events}
						conflictingEventIds={conflictingEventIds}
						onEventClick={onEventClick}
						isEven={index % 2 === 0}
					/>
				))}
			</CollapsibleContent>
		</Collapsible>
	)
}

// --- Single Provider Detail View ---

interface SingleProviderDetailProps {
	entry: ProviderEntry
	weekDays: Date[]
	events: CalendarViewEvent[]
	conflictingEventIds?: Set<string>
	onEventClick: (eventId: string) => void
}

function SingleProviderDetail({
	entry,
	weekDays,
	events,
	conflictingEventIds,
	onEventClick,
}: SingleProviderDetailProps) {
	const providerEvents = useMemo(
		() => getProviderWeekEvents(events, entry.id, entry.role, weekDays),
		[events, entry.id, entry.role, weekDays]
	)

	const totalEvents = providerEvents.length
	const workloadLevel = getOverallWorkloadLevel(totalEvents)
	const todayKey = calendarDayKey(todayInSantiago())

	return (
		<div className="space-y-4">
			{/* Summary */}
			<div className="flex items-center gap-4 rounded-lg border p-4">
				<Users className="text-muted-foreground h-8 w-8" />
				<div className="flex-1">
					<h3 className="text-lg font-semibold">{entry.name}</h3>
					<p className="text-muted-foreground text-sm">
						{entry.role === "guide" && "Guía"}
						{entry.role === "driver" && "Chofer"}
						{entry.role === "vehicle" && "Vehículo"}
						{entry.cost > 0 && ` · $${entry.cost.toLocaleString()}`}
					</p>
				</div>
				<div className="text-right">
					<span
						className={cn(
							"rounded-full px-3 py-1 text-sm font-bold",
							getWorkloadColorClasses(workloadLevel)
						)}
					>
						{totalEvents} eventos esta semana
					</span>
				</div>
			</div>

			{/* Weekly grid — larger cards */}
			<div className="overflow-x-auto rounded-lg border">
				{/* Day headers */}
				<div className="bg-muted grid min-w-[900px] grid-cols-7 gap-px border-b">
					{weekDays.map((day, index) => {
						const isToday = format(day, "yyyy-MM-dd") === todayKey

						return (
							<div
								key={format(day, "yyyy-MM-dd")}
								className={cn("px-2 py-2 text-center", isToday && "bg-primary/10")}
							>
								<p className="text-muted-foreground text-[10px] font-medium uppercase">
									{WEEK_DAYS_SHORT[index]}
								</p>
								<p className={cn("text-sm font-bold", isToday && "text-primary")}>
									{format(day, "d", { locale: es })}
								</p>
							</div>
						)
					})}
				</div>

				{/* Events row */}
				<div className="grid min-w-[900px] grid-cols-7 gap-px">
					{weekDays.map((day) => {
						const dayEvents = providerEvents.filter((e) => calendarDayKey(e.date as Date) === format(day, "yyyy-MM-dd"))
						const isToday = format(day, "yyyy-MM-dd") === todayKey

						return (
							<div
								key={format(day, "yyyy-MM-dd")}
								className={cn(
									"min-h-[120px] p-2",
									isToday && "bg-primary/5",
									dayEvents.length === 0 && "border-border/50 border-dashed"
								)}
							>
								<div className="flex flex-col gap-2">
									{dayEvents.map((event) => (
										<DroppableEventWrapper key={event.id} event={event}>
											<CalendarEventCard
												event={event}
												variant="expanded"
												onClick={() => onEventClick(event.id)}
												isConflicting={conflictingEventIds?.has(event.id)}
											/>
										</DroppableEventWrapper>
									))}
									{dayEvents.length === 0 && (
										<p className="text-muted-foreground py-4 text-center text-[10px]">Disponible</p>
									)}
								</div>
							</div>
						)
					})}
				</div>
			</div>
		</div>
	)
}

// --- Main Component ---

export function ProviderScheduleView({
	events,
	selectedDate,
	onEventClick,
	conflictingEventIds,
	providers,
}: ProviderScheduleViewProps) {
	const [selectedProviderId, setSelectedProviderId] = useState("all")
	const [search, setSearch] = useState("")

	// Compute week days (Mon-Sun)
	const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
	const weekDays = eachDayOfInterval({
		start: weekStart,
		end: addDays(weekStart, 6),
	})

	// Build provider entries grouped by role
	const guides = useMemo(() => buildProviderEntries(providers, "guide"), [providers])
	const drivers = useMemo(() => buildProviderEntries(providers, "driver"), [providers])
	const vehicles = useMemo(() => buildProviderEntries(providers, "vehicle"), [providers])

	// All entries flat for the selector
	const allEntries = useMemo(
		() => [...guides, ...drivers, ...vehicles],
		[guides, drivers, vehicles]
	)

	// Selected single provider
	const selectedEntry = useMemo(
		() =>
			selectedProviderId !== "all"
				? allEntries.find((e) => e.id === selectedProviderId)
				: undefined,
		[selectedProviderId, allEntries]
	)

	const todayKey = calendarDayKey(todayInSantiago())

	return (
		<div className="space-y-3">
			{/* Provider selector + search */}
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
				<Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
					<SelectTrigger className="w-[280px]">
						<SelectValue placeholder="Todos los proveedores" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Todos los proveedores</SelectItem>
						{guides.length > 0 && (
							<SelectGroup>
								<SelectLabel>Guías</SelectLabel>
								{guides.map((g) => (
									<SelectItem key={g.id} value={g.id}>
										{g.name}
									</SelectItem>
								))}
							</SelectGroup>
						)}
						{drivers.length > 0 && (
							<SelectGroup>
								<SelectLabel>Choferes</SelectLabel>
								{drivers.map((d) => (
									<SelectItem key={d.id} value={d.id}>
										{d.name}
									</SelectItem>
								))}
							</SelectGroup>
						)}
						{vehicles.length > 0 && (
							<SelectGroup>
								<SelectLabel>Vehículos</SelectLabel>
								{vehicles.map((v) => (
									<SelectItem key={v.id} value={v.id}>
										{v.name}
									</SelectItem>
								))}
							</SelectGroup>
						)}
					</SelectContent>
				</Select>

				{selectedProviderId === "all" && (
					<div className="relative">
						<Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
						<Input
							placeholder="Buscar proveedor..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="w-[220px] pl-8"
						/>
					</div>
				)}
			</div>

			{/* All providers view */}
			{selectedProviderId === "all" && (
				<div className="overflow-x-auto rounded-lg border">
					{/* Day column headers */}
					<div className="bg-muted grid min-w-[900px] grid-cols-[200px_repeat(7,1fr)_80px] border-b">
						<div className="px-3 py-2">
							<span className="text-muted-foreground text-[10px] font-medium uppercase">
								Proveedor
							</span>
						</div>
						{weekDays.map((day, index) => {
							const isToday = format(day, "yyyy-MM-dd") === todayKey

							return (
								<div
									key={format(day, "yyyy-MM-dd")}
									className={cn("border-l px-2 py-2 text-center", isToday && "bg-primary/10")}
								>
									<p className="text-muted-foreground text-[10px] font-medium uppercase">
										{WEEK_DAYS_SHORT[index]}
									</p>
									<p className={cn("text-sm font-bold", isToday && "text-primary")}>
										{format(day, "d", { locale: es })}
									</p>
								</div>
							)
						})}
						<div className="border-l px-2 py-2 text-center">
							<span className="text-muted-foreground text-[10px] font-medium uppercase">Carga</span>
						</div>
					</div>

					{/* Role sections */}
					<ScrollArea className="max-h-[65vh]">
						<RoleSection
							title="Guías"
							entries={guides}
							weekDays={weekDays}
							events={events}
							conflictingEventIds={conflictingEventIds}
							onEventClick={onEventClick}
							search={search}
						/>
						<RoleSection
							title="Choferes"
							entries={drivers}
							weekDays={weekDays}
							events={events}
							conflictingEventIds={conflictingEventIds}
							onEventClick={onEventClick}
							search={search}
						/>
						<RoleSection
							title="Vehículos"
							entries={vehicles}
							weekDays={weekDays}
							events={events}
							conflictingEventIds={conflictingEventIds}
							onEventClick={onEventClick}
							search={search}
						/>
					</ScrollArea>
				</div>
			)}

			{/* Single provider detail view */}
			{selectedEntry && (
				<SingleProviderDetail
					entry={selectedEntry}
					weekDays={weekDays}
					events={events}
					conflictingEventIds={conflictingEventIds}
					onEventClick={onEventClick}
				/>
			)}

			{/* Fallback when no providers */}
			{!providers?.length && (
				<div className="flex items-center justify-center rounded-lg border py-12">
					<p className="text-muted-foreground text-sm">No hay proveedores activos para mostrar</p>
				</div>
			)}
		</div>
	)
}
