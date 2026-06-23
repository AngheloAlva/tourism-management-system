"use client"

import { Users, UserCheck, Car, MapPin } from "lucide-react"

import { DashboardStatCard } from "@/shared/components/ui/dashboard-stat-card"

import type { ProviderSummary } from "../actions/provider.actions"

interface ProvidersInsightsProps {
	summary: ProviderSummary
}

export function ProvidersInsights({ summary }: ProvidersInsightsProps) {
	const insights = [
		{
			title: "Total Proveedores",
			value: summary.total,
			icon: Users,
			description: "Proveedores registrados",
			iconClassName: "text-blue-600 dark:text-blue-300",
			iconWrapperClassName: "bg-blue-500/30",
		},
		{
			title: "Activos",
			value: summary.active,
			icon: UserCheck,
			description: "Proveedores activos",
			iconClassName: "text-emerald-600 dark:text-emerald-300",
			iconWrapperClassName: "bg-emerald-500/30",
		},
		{
			title: "Guías",
			value: summary.guides,
			icon: MapPin,
			description: "Guías turísticos",
			iconClassName: "text-violet-600 dark:text-violet-300",
			iconWrapperClassName: "bg-violet-500/30",
		},
		{
			title: "Conductores",
			value: summary.drivers,
			icon: Car,
			description: "Conductores registrados",
			iconClassName: "text-orange-600 dark:text-orange-300",
			iconWrapperClassName: "bg-primary/30",
		},
	]

	return (
		<div className="grid gap-4 md:grid-cols-4">
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
