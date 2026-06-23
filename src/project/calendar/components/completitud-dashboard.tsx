"use client"

import { useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ChevronDown, CheckCircle2, AlertCircle, Clock } from "lucide-react"

import { cn } from "@/lib/utils"
import { Progress } from "@/shared/components/ui/progress"
import { Badge } from "@/shared/components/ui/badge"
import { Button } from "@/shared/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/components/ui/collapsible"

import type { UseCompletitudReturn } from "../types/calendar.types"
import { getEventDisplayName } from "@/project/events/utils/event-display"

const MISSING_LABEL = {
	guide: "Sin guia",
	driver: "Sin chofer",
	vehicle: "Sin vehiculo",
} as const

function getColorTier(percentage: number) {
	if (percentage >= 90) return "green"
	if (percentage >= 50) return "amber"
	return "red"
}

const COLOR_CLASSES = {
	green: {
		progress: "[&>[data-slot=progress-indicator]]:bg-emerald-500",
		text: "text-emerald-600 dark:text-emerald-400",
		badge: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
		bar: "bg-emerald-500",
		barBg: "bg-emerald-500/20",
	},
	amber: {
		progress: "[&>[data-slot=progress-indicator]]:bg-amber-500",
		text: "text-amber-600 dark:text-amber-400",
		badge: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
		bar: "bg-amber-500",
		barBg: "bg-amber-500/20",
	},
	red: {
		progress: "[&>[data-slot=progress-indicator]]:bg-red-500",
		text: "text-red-600 dark:text-red-400",
		badge: "bg-red-500/20 text-red-700 dark:text-red-300",
		bar: "bg-red-500",
		barBg: "bg-red-500/20",
	},
} as const

interface CompletitudDashboardProps {
	metrics: UseCompletitudReturn
	onEventClick: (eventId: string) => void
}

export function CompletitudDashboard({ metrics, onEventClick }: CompletitudDashboardProps) {
	const [isOpen, setIsOpen] = useState(false)
	const { overall, dailyBreakdown, incompleteEvents } = metrics
	const tier = getColorTier(overall.percentage)
	const colors = COLOR_CLASSES[tier]

	if (overall.total === 0) return null

	const allComplete = overall.percentage === 100

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<div className="rounded-lg border bg-card p-4">
				<CollapsibleTrigger asChild>
					<Button
						variant="ghost"
						className="flex h-auto w-full items-center justify-between p-0 hover:bg-transparent"
						aria-label="Alternar panel de completitud de asignaciones"
					>
						<div className="flex items-center gap-3">
							{allComplete ? (
								<CheckCircle2 className="h-5 w-5 text-emerald-500" />
							) : (
								<AlertCircle className={cn("h-5 w-5", colors.text)} />
							)}
							<div className="text-left">
								<span className="text-sm font-medium">Completitud de asignaciones</span>
								<span className={cn("ml-2 text-sm font-bold", colors.text)}>
									{overall.percentage}%
								</span>
							</div>
							<Badge variant="secondary" className={cn("text-xs", colors.badge)}>
								{overall.complete}/{overall.total}
							</Badge>
						</div>
						<ChevronDown
							className={cn(
								"h-4 w-4 text-muted-foreground transition-transform",
								isOpen && "rotate-180"
							)}
						/>
					</Button>
				</CollapsibleTrigger>

				{/* Summary progress bar - always visible */}
				<div className="mt-3">
					<Progress
						value={overall.percentage}
						className={cn("h-2", colors.progress)}
					/>
					<p className="mt-1 text-xs text-muted-foreground">
						{allComplete
							? "Todos los eventos tienen asignacion completa"
							: `${overall.complete} de ${overall.total} eventos con asignacion completa, ${overall.total - overall.complete} pendientes`}
					</p>
				</div>

				<CollapsibleContent>
					<div className="mt-4 space-y-4">
						{/* Daily breakdown */}
						{dailyBreakdown.length > 0 && (
							<div className="space-y-2">
								<h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									Desglose por dia
								</h4>
								<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
									{dailyBreakdown.map((day) => {
										const dayTier = getColorTier(day.percentage)
										const dayColors = COLOR_CLASSES[dayTier]
										return (
											<div
												key={day.dateStr}
												className="flex items-center gap-2 rounded-md border bg-muted/30 p-2"
											>
												<div className="min-w-0 flex-1">
													<p className="truncate text-xs font-medium capitalize">
														{format(day.date, "EEE d MMM", { locale: es })}
													</p>
													<div className="mt-1 flex items-center gap-2">
														<div className={cn("h-1.5 flex-1 rounded-full", dayColors.barBg)}>
															<div
																className={cn("h-full rounded-full transition-all", dayColors.bar)}
																style={{ width: `${day.percentage}%` }}
															/>
														</div>
														<span className={cn("text-xs font-medium tabular-nums", dayColors.text)}>
															{day.complete}/{day.total}
														</span>
													</div>
												</div>
												{day.percentage === 100 && (
													<CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
												)}
											</div>
										)
									})}
								</div>
							</div>
						)}

						{/* Incomplete events list */}
						{incompleteEvents.length > 0 && (
							<div className="space-y-2">
								<h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									Eventos pendientes ({incompleteEvents.length})
								</h4>
								<div className="max-h-48 space-y-1 overflow-y-auto">
									{incompleteEvents.map(({ event, missing }) => (
										<button
											key={event.id}
											type="button"
											onClick={() => onEventClick(event.id)}
											className="flex w-full items-center gap-2 rounded-md border bg-muted/30 p-2 text-left transition-colors hover:bg-muted/60"
										>
											<Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
											<div className="min-w-0 flex-1">
												<p className="truncate text-xs font-medium">
												{getEventDisplayName(event)}
												</p>
												<p className="text-xs text-muted-foreground">
													{/* Reconstruct from UTC parts — event.date is @db.Date (UTC midnight) */}
												{format(
														new Date(
															(event.date as Date).getUTCFullYear(),
															(event.date as Date).getUTCMonth(),
															(event.date as Date).getUTCDate()
														),
														"EEE d MMM",
														{ locale: es }
													)}
													{event.startTime ? ` · ${event.startTime}` : ""}
												</p>
											</div>
											<div className="flex shrink-0 gap-1">
												{missing.map((role) => (
													<Badge
														key={role}
														variant="outline"
														className="text-[10px] px-1.5 py-0"
													>
														{MISSING_LABEL[role]}
													</Badge>
												))}
											</div>
										</button>
									))}
								</div>
							</div>
						)}
					</div>
				</CollapsibleContent>
			</div>
		</Collapsible>
	)
}
