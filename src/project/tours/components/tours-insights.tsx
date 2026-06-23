"use client"

import { MapPin, Bus } from "lucide-react"

import { DashboardStatCard } from "@/shared/components/ui/dashboard-stat-card"

import type { TourSummary } from "../actions/tour.actions"

interface ToursInsightsProps {
	summary: TourSummary
}

export function ToursInsights({ summary }: ToursInsightsProps) {
	const insights = [
		{
			title: "Tours Activos",
			value: summary.activeTours,
			icon: MapPin,
			description: "Tours activos",
			iconClassName: "text-violet-600 dark:text-violet-300",
			iconWrapperClassName: "bg-violet-500/30",
		},
		{
			title: "Tours Regulares",
			value: summary.totalRegularTours,
			icon: MapPin,
			description: "Tours regulares",
			iconClassName: "text-blue-600 dark:text-blue-300",
			iconWrapperClassName: "bg-blue-500/30",
		},
		{
			title: "Transfers",
			value: summary.totalTransfers,
			icon: Bus,
			description: "Servicios de transfer",
			iconClassName: "text-emerald-600 dark:text-emerald-300",
			iconWrapperClassName: "bg-emerald-500/30",
		},
	]

	return (
		<div className="grid gap-4 md:grid-cols-3">
			{insights.map((insight) => (
				<DashboardStatCard
					key={insight.title}
					title={insight.title}
					value={insight.value}
					description={insight.description}
					icon={insight.icon}
					iconClassName={insight.iconClassName}
					iconWrapperClassName={insight.iconWrapperClassName}
				/>
			))}
		</div>
	)
}
