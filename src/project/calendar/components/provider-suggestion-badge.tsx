"use client"

import { useState } from "react"
import { Sparkles, ChevronDown, Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/shared/components/ui/button"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/shared/components/ui/tooltip"

import type { ProviderScore } from "../types/auto-assignment.types"
import type { ProviderRole } from "../types/provider-assignment.types"

const ROLE_LABEL: Record<ProviderRole, string> = {
	guide: "guía",
	driver: "conductor",
	vehicle: "vehículo",
}

interface ProviderSuggestionBadgeProps {
	suggestion: ProviderScore | null | undefined
	alternatives?: ProviderScore[]
	onAccept: (providerId: string, defaultCost: number) => void
	role: ProviderRole
}

export function ProviderSuggestionBadge({
	suggestion,
	alternatives = [],
	onAccept,
	role,
}: ProviderSuggestionBadgeProps) {
	const [isExpanded, setIsExpanded] = useState(false)

	// null = no eligible providers found
	if (suggestion === null) {
		return (
			<div className="flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 px-2 py-1.5 dark:border-slate-600">
				<Sparkles className="h-3 w-3 text-slate-400" />
				<span className="text-xs text-slate-500 dark:text-slate-400">
					Sin {ROLE_LABEL[role]} disponible
				</span>
			</div>
		)
	}

	// undefined = not applicable (role is assigned or not needed)
	if (!suggestion) return null

	const scorePercent = Math.round(suggestion.score * 100)

	return (
		<div className="space-y-1">
			<div className="flex items-center gap-1.5 rounded-md border border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 px-2 py-1.5 dark:border-purple-500/30 dark:from-purple-500/10 dark:to-pink-500/10">
				<Sparkles className="h-3 w-3 shrink-0 text-purple-500 dark:text-purple-400" />

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<span className="flex-1 truncate text-xs font-medium text-purple-700 dark:text-purple-300">
								{suggestion.providerName}
							</span>
						</TooltipTrigger>
						<TooltipContent side="top" className="max-w-xs">
							<div className="space-y-1 text-xs">
								<p className="font-medium">Desglose de puntuación</p>
								<div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
									<span>Carga de trabajo:</span>
									<span>{Math.round(suggestion.breakdown.workloadScore * 100)}%</span>
									<span>Costo:</span>
									<span>{Math.round(suggestion.breakdown.costScore * 100)}%</span>
									<span>Familiaridad:</span>
									<span>{Math.round(suggestion.breakdown.familiarityScore * 100)}%</span>
								</div>
								{suggestion.defaultCost > 0 && (
									<p className="pt-0.5">
										Costo: ${suggestion.defaultCost.toLocaleString()}
									</p>
								)}
								{alternatives.length > 0 && (
									<div className="border-t border-slate-500/30 pt-1">
										<p className="font-medium">Alternativas:</p>
										{alternatives.slice(0, 3).map((alt) => (
											<p key={alt.providerId}>
												{alt.providerName} ({Math.round(alt.score * 100)}%)
											</p>
										))}
									</div>
								)}
							</div>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				{/* Score indicator */}
				<div className="flex items-center gap-1">
					<div className="h-1.5 w-8 overflow-hidden rounded-full bg-purple-200 dark:bg-purple-800">
						<div
							className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 dark:from-purple-400 dark:to-pink-400"
							style={{ width: `${scorePercent}%` }}
						/>
					</div>
					<span className="text-[10px] tabular-nums text-purple-600 dark:text-purple-400">
						{scorePercent}%
					</span>
				</div>

				{/* Accept button */}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-5 gap-1 px-1.5 text-[10px] font-medium text-purple-700 hover:bg-purple-100 hover:text-purple-900 dark:text-purple-300 dark:hover:bg-purple-500/20 dark:hover:text-purple-200"
					onClick={() => onAccept(suggestion.providerId, suggestion.defaultCost)}
				>
					<Check className="h-3 w-3" />
					Aceptar
				</Button>

				{/* Expand toggle (only if there are alternatives) */}
				{alternatives.length > 0 && (
					<button
						type="button"
						onClick={() => setIsExpanded(!isExpanded)}
						className="rounded p-0.5 text-purple-500 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-500/20"
					>
						<ChevronDown
							className={cn(
								"h-3 w-3 transition-transform",
								isExpanded && "rotate-180"
							)}
						/>
					</button>
				)}
			</div>

			{/* Expanded alternatives list */}
			{isExpanded && alternatives.length > 0 && (
				<div className="ml-4 space-y-0.5 border-l-2 border-purple-200 pl-2 dark:border-purple-500/30">
					{alternatives.slice(0, 5).map((alt) => (
						<button
							key={alt.providerId}
							type="button"
							onClick={() => onAccept(alt.providerId, alt.defaultCost)}
							className="flex w-full items-center justify-between rounded px-1.5 py-1 text-left text-xs text-slate-600 hover:bg-purple-50 dark:text-slate-400 dark:hover:bg-purple-500/10"
						>
							<span className="truncate">{alt.providerName}</span>
							<span className="ml-2 shrink-0 tabular-nums text-[10px] text-slate-500">
								{Math.round(alt.score * 100)}%
							</span>
						</button>
					))}
				</div>
			)}
		</div>
	)
}
