"use client"

import { FileText, TrendingUp, ClipboardList } from "lucide-react"
import { DashboardStatCard } from "@/shared/components/ui/dashboard-stat-card"
import type { SalesSummary } from "../actions/sale-record.actions"

interface QuotesOnlyInsightsProps {
	summary: SalesSummary
}

export function QuotesOnlyInsights({ summary }: QuotesOnlyInsightsProps) {
	const clpFormatter = new Intl.NumberFormat("es-CL", {
		style: "currency",
		currency: "CLP",
		minimumFractionDigits: 0,
	})

	const conversionRate =
		summary.totalQuotes > 0
			? Math.round((summary.convertedQuotes / summary.totalQuotes) * 100)
			: 0

	const yoyDiff = summary.quotesThisMonth - summary.quotesLastYearSameMonth
	const yoyLabel =
		summary.quotesLastYearSameMonth > 0
			? `vs ${summary.quotesLastYearSameMonth} mismo mes año anterior (${yoyDiff >= 0 ? "+" : ""}${yoyDiff})`
			: "Sin datos del año anterior"

	const insights = [
		{
			title: "Total Cotizaciones",
			value: summary.totalQuotes,
			icon: FileText,
			description: `${summary.convertedQuotes} convertidas a venta (${conversionRate}%)`,
			iconClassName: "text-blue-600 dark:text-blue-300",
			iconWrapperClassName: "bg-blue-500/30",
		},
		{
			title: "Ingresos Potenciales",
			value: clpFormatter.format(summary.pendingRevenue),
			icon: TrendingUp,
			description: `Promedio por cotización: ${clpFormatter.format(summary.avgQuoteValue)}`,
			iconClassName: "text-amber-600 dark:text-amber-300",
			iconWrapperClassName: "bg-amber-500/30",
		},
		{
			title: "Cotizaciones del Mes",
			value: summary.quotesThisMonth,
			icon: ClipboardList,
			description: yoyLabel,
			iconClassName: "text-pink-600 dark:text-pink-300",
			iconWrapperClassName: "bg-pink-500/30",
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
