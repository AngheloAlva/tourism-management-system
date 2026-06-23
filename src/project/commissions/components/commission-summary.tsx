"use client"

import { DollarSign, TicketIcon, TrendingUpIcon, MinusCircleIcon } from "lucide-react"

import { useCommissionSummary } from "../hooks/use-commissions"

import { DashboardStatCard } from "@/shared/components/ui/dashboard-stat-card"
import { InsightsSkeleton } from "@/shared/components/ui/insights-skeleton"

import type { CommissionFilters, CommissionKind } from "../types/commission.types"

interface CommissionSummaryProps {
	kind: CommissionKind
	filters: CommissionFilters
	commissionPercentage: number
}

function formatCLP(amount: number) {
	return new Intl.NumberFormat("es-CL", {
		style: "currency",
		currency: "CLP",
	}).format(amount)
}

export function CommissionSummaryCards({ kind, filters, commissionPercentage }: CommissionSummaryProps) {
	const { data: summary, isLoading } = useCommissionSummary(kind, filters)

	if (!filters.operatorId) return null

	if (isLoading) {
		return <InsightsSkeleton count={6} />
	}

	if (!summary) return null

	const commissionAmount = Math.round(summary.totalTourOnly * (commissionPercentage / 100))

	const cards = [
		{
			title: "Ventas",
			value: summary.totalSales.toString(),
			icon: TicketIcon,
			iconStyle: "text-blue-600",
			iconWrapperStyle: "bg-blue-500/30",
		},
		{
			title: "Total Bruto",
			value: formatCLP(summary.totalSaleAmount),
			icon: DollarSign,
			iconStyle: "text-muted-foreground",
		},
		{
			title: "Entradas",
			value: formatCLP(summary.totalEntranceFees),
			icon: MinusCircleIcon,
			iconStyle: "text-amber-600",
			iconWrapperStyle: "bg-amber-500/30",
			valueClassName: "text-amber-600 dark:text-amber-300",
		},
		{
			title: "Total Tours",
			value: formatCLP(summary.totalTourOnly),
			icon: TrendingUpIcon,
			iconStyle: "text-emerald-600",
			iconWrapperStyle: "bg-emerald-500/30",
			valueClassName: "text-emerald-600 dark:text-emerald-300",
		},
		{
			title: `Comisión (${commissionPercentage}%)`,
			value: formatCLP(commissionAmount),
			icon: DollarSign,
			iconStyle: "text-violet-600",
			iconWrapperStyle: "bg-violet-500/30",
			valueClassName: "text-violet-600 dark:text-violet-300",
		},
		{
			title: "Comisión Pagada",
			value: formatCLP(summary.totalCommissionPaid),
			icon: DollarSign,
			iconStyle: "text-indigo-600",
			iconWrapperStyle: "bg-indigo-500/30",
			valueClassName: "text-indigo-600 dark:text-indigo-300",
		},
	]

	return (
		<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
			{cards.map((card) => (
				<DashboardStatCard
					key={card.title}
					title={card.title}
					value={card.value}
					icon={card.icon}
					iconClassName={card.iconStyle}
					iconWrapperClassName={card.iconWrapperStyle}
					valueClassName={card.valueClassName}
				/>
			))}
		</div>
	)
}
