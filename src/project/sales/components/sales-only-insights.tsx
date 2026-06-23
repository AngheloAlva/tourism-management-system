"use client"

import { DollarSign, ShoppingCart, Calendar } from "lucide-react"
import { DashboardStatCard } from "@/shared/components/ui/dashboard-stat-card"
import type { SalesSummary } from "../actions/sale-record.actions"

interface SalesOnlyInsightsProps {
	summary: SalesSummary
}

export function SalesOnlyInsights({ summary }: SalesOnlyInsightsProps) {
	const clpFormatter = new Intl.NumberFormat("es-CL", {
		style: "currency",
		currency: "CLP",
		minimumFractionDigits: 0,
	})

	const yoyDiff = summary.salesThisMonth - summary.salesLastYearSameMonth
	const yoyLabel =
		summary.salesLastYearSameMonth > 0
			? `vs ${summary.salesLastYearSameMonth} mismo mes año anterior (${yoyDiff >= 0 ? "+" : ""}${yoyDiff})`
			: "Sin datos del año anterior"

	const insights = [
		{
			title: "Total Ventas",
			value: summary.totalSales,
			icon: ShoppingCart,
			description: "Ventas confirmadas",
			iconClassName: "text-green-600 dark:text-green-300",
			iconWrapperClassName: "bg-green-500/30",
		},
		{
			title: "Ingresos del Mes",
			value: clpFormatter.format(summary.monthlyRevenue),
			icon: DollarSign,
			description: `Total histórico: ${clpFormatter.format(summary.totalRevenue)}`,
			iconClassName: "text-emerald-600 dark:text-emerald-300",
			iconWrapperClassName: "bg-emerald-500/30",
		},
		{
			title: "Ventas del Mes",
			value: summary.salesThisMonth,
			icon: Calendar,
			description: yoyLabel,
			iconClassName: "text-violet-600 dark:text-violet-300",
			iconWrapperClassName: "bg-violet-500/30",
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
