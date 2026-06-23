"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Sparkles, Loader2, ChevronDown, AlertCircle, Check, X } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { calendarDayKey } from "@/shared/utils/calendar-day"

import { cn } from "@/lib/utils"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import { Checkbox } from "@/shared/components/ui/checkbox"
import { Progress } from "@/shared/components/ui/progress"
import { ScrollArea } from "@/shared/components/ui/scroll-area"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/shared/components/ui/collapsible"

import { updateEvent } from "@/project/events/actions/event.actions"
import type { CalendarViewEvent } from "../types/calendar.types"
import type { ProviderRole } from "../types/provider-assignment.types"
import type {
	AutoAssignSuggestion,
	BulkAutoAssignPlan,
	ProviderScore,
} from "../types/auto-assignment.types"
import type { ProviderWithCatering } from "@/project/providers/actions/provider.actions"

// --- Role Labels ---

const ROLE_LABEL: Record<ProviderRole, string> = {
	guide: "Guía",
	driver: "Conductor",
	vehicle: "Vehículo",
}

const ROLE_BADGE_COLORS: Record<ProviderRole, string> = {
	guide: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
	driver: "bg-sky-500/20 text-sky-700 dark:text-sky-300",
	vehicle: "bg-violet-500/20 text-violet-700 dark:text-violet-300",
}

// --- Props ---

interface AutoAssignPreviewDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	plan: BulkAutoAssignPlan | null
	events: CalendarViewEvent[]
	providers: ProviderWithCatering[]
	isLoading?: boolean
}

// --- Types for internal override tracking ---

interface OverrideKey {
	eventId: string
	role: ProviderRole
}

function overrideKeyStr(eventId: string, role: ProviderRole): string {
	return `${eventId}::${role}`
}

// --- Component ---

export function AutoAssignPreviewDialog({
	open,
	onOpenChange,
	plan,
	events,
	providers,
	isLoading = false,
}: AutoAssignPreviewDialogProps) {
	const router = useRouter()

	// Track which suggestions are excluded (unchecked)
	const [excludedKeys, setExcludedKeys] = useState<Set<string>>(new Set())

	// Track provider overrides (user picked a different provider than suggested)
	const [overrides, setOverrides] = useState<Map<string, string>>(new Map())

	// Application state
	const [isApplying, setIsApplying] = useState(false)
	const [applyProgress, setApplyProgress] = useState(0)
	const [applyTotal, setApplyTotal] = useState(0)

	// Group suggestions by date for display
	const groupedByDate = useMemo(() => {
		if (!plan) return new Map<string, AutoAssignSuggestion[]>()

		const groups = new Map<string, AutoAssignSuggestion[]>()

		for (const suggestion of plan.suggestions) {
			const dateKey = calendarDayKey(suggestion.date as Date)
			const existing = groups.get(dateKey) ?? []
			existing.push(suggestion)
			groups.set(dateKey, existing)
		}

		return groups
	}, [plan])

	// Active (non-excluded) suggestions count
	const activeSuggestionCount = useMemo(() => {
		if (!plan) return 0
		return plan.suggestions.filter((s) => !excludedKeys.has(overrideKeyStr(s.eventId, s.role)))
			.length
	}, [plan, excludedKeys])

	// Toggle inclusion of a suggestion
	const toggleSuggestion = useCallback((eventId: string, role: ProviderRole) => {
		const key = overrideKeyStr(eventId, role)
		setExcludedKeys((prev) => {
			const next = new Set(prev)
			if (next.has(key)) {
				next.delete(key)
			} else {
				next.add(key)
			}
			return next
		})
	}, [])

	// Override provider for a suggestion
	const handleOverride = useCallback((eventId: string, role: ProviderRole, providerId: string) => {
		const key = overrideKeyStr(eventId, role)
		setOverrides((prev) => {
			const next = new Map(prev)
			next.set(key, providerId)
			return next
		})
	}, [])

	// Get the resolved provider for a suggestion (override or original)
	const getResolvedProviderId = useCallback(
		(suggestion: AutoAssignSuggestion): string => {
			const key = overrideKeyStr(suggestion.eventId, suggestion.role)
			return overrides.get(key) ?? suggestion.suggestedProvider.providerId
		},
		[overrides]
	)

	// Get the resolved provider score (for display)
	const getResolvedProvider = useCallback(
		(suggestion: AutoAssignSuggestion): ProviderScore => {
			const key = overrideKeyStr(suggestion.eventId, suggestion.role)
			const overrideId = overrides.get(key)
			if (!overrideId || overrideId === suggestion.suggestedProvider.providerId) {
				return suggestion.suggestedProvider
			}
			const alt = suggestion.alternatives.find((a) => a.providerId === overrideId)
			return alt ?? suggestion.suggestedProvider
		},
		[overrides]
	)

	// Apply all active suggestions
	const handleApply = useCallback(async () => {
		if (!plan) return

		const activeSuggestions = plan.suggestions.filter(
			(s) => !excludedKeys.has(overrideKeyStr(s.eventId, s.role))
		)

		if (activeSuggestions.length === 0) {
			toast.error("No hay asignaciones seleccionadas para aplicar")
			return
		}

		// Group suggestions by eventId to make a single updateEvent call per event
		const byEvent = new Map<string, AutoAssignSuggestion[]>()
		for (const s of activeSuggestions) {
			const existing = byEvent.get(s.eventId) ?? []
			existing.push(s)
			byEvent.set(s.eventId, existing)
		}

		setIsApplying(true)
		setApplyTotal(byEvent.size)
		setApplyProgress(0)

		let successCount = 0
		let failCount = 0
		let progressSoFar = 0

		const updatePromises = Array.from(byEvent.entries()).map(async ([eventId, suggestions]) => {
			const event = events.find((e) => e.id === eventId)
			if (!event) {
				failCount++
				return
			}

			// Build update payload for this event
			const updateData: Record<string, unknown> = {
				isCompleted: event.status === "CONFIRMED",
			}

			for (const suggestion of suggestions) {
				const resolvedId = getResolvedProviderId(suggestion)
				const resolvedProvider = providers.find((p) => p.id === resolvedId)

				if (suggestion.role === "guide") {
					updateData.guideId = resolvedId
					updateData.guideCost = resolvedProvider
						? resolvedProvider.guideCost || resolvedProvider.costPerDay || 0
						: suggestion.suggestedProvider.defaultCost
				} else if (suggestion.role === "driver") {
					updateData.driverId = resolvedId
					updateData.driverCost = resolvedProvider
						? resolvedProvider.driverCost || resolvedProvider.costPerDay || 0
						: suggestion.suggestedProvider.defaultCost
				} else if (suggestion.role === "vehicle") {
					updateData.vehicleId = resolvedId
					updateData.vehicleCost = resolvedProvider
						? resolvedProvider.vehicleCost || resolvedProvider.costPerDay || 0
						: suggestion.suggestedProvider.defaultCost
				}
			}

			try {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const result = await updateEvent(eventId, updateData as any)
				if (result.success) {
					successCount++
				} else {
					failCount++
				}
			} catch {
				failCount++
			}

			progressSoFar++
			setApplyProgress(progressSoFar)
		})

		await Promise.allSettled(updatePromises)

		setIsApplying(false)

		if (failCount === 0) {
			toast.success(`${successCount} eventos asignados correctamente`)
		} else if (successCount > 0) {
			toast.warning(`${successCount} exitosos, ${failCount} fallidos`)
		} else {
			toast.error("No se pudo asignar ningún evento")
		}

		router.refresh()
		resetState()
		onOpenChange(false)
	}, [plan, excludedKeys, events, providers, getResolvedProviderId, router, onOpenChange])

	const resetState = () => {
		setExcludedKeys(new Set())
		setOverrides(new Map())
		setApplyProgress(0)
		setApplyTotal(0)
	}

	const handleDialogChange = (nextOpen: boolean) => {
		if (!nextOpen) resetState()
		onOpenChange(nextOpen)
	}

	return (
		<Dialog open={open} onOpenChange={handleDialogChange}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Sparkles className="h-5 w-5 text-purple-500" />
						Auto-asignación inteligente
					</DialogTitle>
					<DialogDescription>
						{isLoading
							? "Analizando eventos y proveedores..."
							: plan && plan.assignableEvents > 0
								? `${plan.assignableEvents} eventos pueden ser asignados`
								: "No hay eventos asignables"}
						{!isLoading &&
							plan &&
							plan.unassignableEvents.length > 0 &&
							`, ${plan.unassignableEvents.length} sin proveedor disponible`}
					</DialogDescription>
				</DialogHeader>

				{/* Loading state */}
				{isLoading && (
					<div className="flex flex-col items-center justify-center gap-3 py-12">
						<Loader2 className="h-8 w-8 animate-spin text-purple-500" />
						<p className="text-muted-foreground text-sm">Calculando las mejores asignaciones...</p>
					</div>
				)}

				{/* Content (only when plan is ready) */}
				{!isLoading && plan && (
					<>
						{/* Summary stats */}
						<div className="flex gap-3">
							<div className="flex items-center gap-1.5 text-sm">
								<Check className="h-4 w-4 text-emerald-500" />
								<span className="text-muted-foreground">
									{activeSuggestionCount} asignaciones seleccionadas
								</span>
							</div>
							<div className="flex items-center gap-1.5 text-sm">
								<X className="h-4 w-4 text-red-500" />
								<span className="text-muted-foreground">
									{plan.suggestions.length - activeSuggestionCount} excluidas
								</span>
							</div>
						</div>

						{/* Suggestions list */}
						<ScrollArea className="max-h-[400px]">
							<div className="space-y-4 pr-3">
								{Array.from(groupedByDate.entries()).map(([dateKey, suggestions]) => (
									<DateGroup
										key={dateKey}
										dateKey={dateKey}
										suggestions={suggestions}
										events={events}
										excludedKeys={excludedKeys}
										overrides={overrides}
										onToggle={toggleSuggestion}
										onOverride={handleOverride}
										getResolvedProvider={getResolvedProvider}
									/>
								))}
							</div>
						</ScrollArea>

						{/* Unassignable events (collapsed) */}
						{plan.unassignableEvents.length > 0 && (
							<UnassignableSection events={plan.unassignableEvents} />
						)}

						{/* Progress during apply */}
						{isApplying && (
							<div className="space-y-2">
								<div className="text-muted-foreground flex items-center gap-2 text-sm">
									<Loader2 className="h-4 w-4 animate-spin" />
									Asignando evento {applyProgress} de {applyTotal}...
								</div>
								<Progress value={applyTotal > 0 ? (applyProgress / applyTotal) * 100 : 0} />
							</div>
						)}

						<DialogFooter className="gap-2 sm:gap-0">
							<Button
								variant="outline"
								onClick={() => handleDialogChange(false)}
								disabled={isApplying}
							>
								Cancelar
							</Button>
							<Button
								onClick={handleApply}
								disabled={isApplying || activeSuggestionCount === 0}
								className={cn(
									"gap-1.5 border-0 text-white",
									"bg-gradient-to-r from-purple-600 to-pink-600",
									"hover:from-purple-700 hover:to-pink-700",
									"disabled:from-purple-600/50 disabled:to-pink-600/50 disabled:opacity-60"
								)}
							>
								{isApplying ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Sparkles className="h-4 w-4 text-pink-200" />
								)}
								Aplicar {activeSuggestionCount} asignaciones
							</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	)
}

// --- Date Group Sub-component ---

interface DateGroupProps {
	dateKey: string
	suggestions: AutoAssignSuggestion[]
	events: CalendarViewEvent[]
	excludedKeys: Set<string>
	overrides: Map<string, string>
	onToggle: (eventId: string, role: ProviderRole) => void
	onOverride: (eventId: string, role: ProviderRole, providerId: string) => void
	getResolvedProvider: (suggestion: AutoAssignSuggestion) => ProviderScore
}

function DateGroup({
	dateKey,
	suggestions,
	events,
	excludedKeys,
	onToggle,
	onOverride,
	getResolvedProvider,
}: DateGroupProps) {
	// dateKey is "yyyy-MM-dd" from calendarDayKey — parse via UTC parts to avoid local tz shift
	const [dy, dm, dd] = dateKey.split("-").map(Number)
	const dateLabel = format(new Date(dy, dm - 1, dd), "EEEE d 'de' MMMM", { locale: es })

	return (
		<div>
			<h4 className="text-muted-foreground mb-2 text-sm font-semibold capitalize">{dateLabel}</h4>
			<div className="space-y-2">
				{suggestions.map((suggestion) => {
					const key = overrideKeyStr(suggestion.eventId, suggestion.role)
					const isExcluded = excludedKeys.has(key)
					const event = events.find((e) => e.id === suggestion.eventId)
					const resolvedProvider = getResolvedProvider(suggestion)

					return (
						<SuggestionRow
							key={key}
							suggestion={suggestion}
							event={event}
							isExcluded={isExcluded}
							resolvedProvider={resolvedProvider}
							onToggle={() => onToggle(suggestion.eventId, suggestion.role)}
							onOverride={(providerId) =>
								onOverride(suggestion.eventId, suggestion.role, providerId)
							}
						/>
					)
				})}
			</div>
		</div>
	)
}

// --- Suggestion Row Sub-component ---

interface SuggestionRowProps {
	suggestion: AutoAssignSuggestion
	event: CalendarViewEvent | undefined
	isExcluded: boolean
	resolvedProvider: ProviderScore
	onToggle: () => void
	onOverride: (providerId: string) => void
}

function SuggestionRow({
	suggestion,
	event,
	isExcluded,
	resolvedProvider,
	onToggle,
	onOverride,
}: SuggestionRowProps) {
	const allOptions = [suggestion.suggestedProvider, ...suggestion.alternatives]

	const scorePercent = Math.round(resolvedProvider.score * 100)

	return (
		<div
			className={cn(
				"flex items-center gap-3 rounded-lg border p-3 transition-opacity",
				isExcluded && "opacity-40"
			)}
		>
			<Checkbox
				checked={!isExcluded}
				onCheckedChange={onToggle}
				aria-label={`Incluir asignación de ${ROLE_LABEL[suggestion.role]} para ${suggestion.tourName}`}
			/>

			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span className="truncate text-sm font-medium">{suggestion.tourName}</span>
					{event?.startTime && (
						<span className="text-muted-foreground shrink-0 text-xs">
							{event.startTime}
							{event.endTime && ` – ${event.endTime}`}
						</span>
					)}
				</div>

				<div className="mt-1 flex items-center gap-2">
					<Badge
						variant="secondary"
						className={cn("shrink-0 text-xs", ROLE_BADGE_COLORS[suggestion.role])}
					>
						{ROLE_LABEL[suggestion.role]}
					</Badge>

					{/* Provider selector (override) */}
					<Select
						value={resolvedProvider.providerId}
						onValueChange={onOverride}
						disabled={isExcluded}
					>
						<SelectTrigger className="h-7 w-[180px] text-xs">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{allOptions.map((option) => (
								<SelectItem key={option.providerId} value={option.providerId}>
									{option.providerName}
									<span className="text-muted-foreground ml-1">
										({Math.round(option.score * 100)}%)
									</span>
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{/* Score indicator */}
					<span
						className={cn(
							"shrink-0 text-xs font-medium",
							scorePercent >= 70
								? "text-emerald-600 dark:text-emerald-400"
								: scorePercent >= 40
									? "text-amber-600 dark:text-amber-400"
									: "text-red-600 dark:text-red-400"
						)}
					>
						{scorePercent}%
					</span>
				</div>
			</div>
		</div>
	)
}

// --- Unassignable Section ---

interface UnassignableSectionProps {
	events: BulkAutoAssignPlan["unassignableEvents"]
}

function UnassignableSection({ events }: UnassignableSectionProps) {
	return (
		<Collapsible>
			<CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 text-sm font-medium">
				<AlertCircle className="h-4 w-4 text-amber-500" />
				{events.length} sin proveedor disponible
				<ChevronDown className="ml-auto h-4 w-4 transition-transform [[data-state=open]_&]:rotate-180" />
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="mt-2 space-y-1.5">
					{events.map((item, index) => (
						<div
							key={`${item.eventId}-${index}`}
							className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs dark:border-amber-500/30 dark:bg-amber-500/10"
						>
							<p className="font-medium">{item.tourName}</p>
							<p className="text-muted-foreground">{item.reason}</p>
						</div>
					))}
				</div>
			</CollapsibleContent>
		</Collapsible>
	)
}
