"use client"

import { FileText, DollarSign, CheckCircle, Clock } from "lucide-react"

import { usePaymentStatementSummary } from "../hooks/use-payment-statements"
import { DashboardStatCard } from "@/shared/components/ui/dashboard-stat-card"
import { InsightsSkeleton } from "@/shared/components/ui/insights-skeleton"

import type { PaymentStatementFilters } from "../types/payment-statement.types"

interface PaymentStatementSummaryProps {
	filters: PaymentStatementFilters
}

export function PaymentStatementSummary({ filters }: PaymentStatementSummaryProps) {
	const { data: summary, isLoading } = usePaymentStatementSummary(filters)

	const formatCurrency = (amount: number) =>
		new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(amount)

	if (!filters.agencyIds || filters.agencyIds.length === 0) {
		return (
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<DashboardStatCard
						key={i}
						title="-"
						value="-"
						icon={FileText}
						description="Selecciona una agencia"
					/>
				))}
			</div>
		)
	}

	if (isLoading) {
		return <InsightsSkeleton count={4} />
	}

	if (!summary) return null

	const kpis = [
		{
			title: "Total Ventas",
			value: summary.totalSales.toString(),
			description: `${summary.pendingGenerationCount} pendientes de generar`,
			icon: FileText,
			iconStyle: "text-blue-500",
			iconWrapperStyle: "bg-blue-500/30",
		},
		{
			title: "Monto Total",
			value: formatCurrency(summary.totalAmount),
			description: "Total del período",
			icon: DollarSign,
			iconStyle: "text-emerald-500",
			iconWrapperStyle: "bg-emerald-500/30",
		},
		{
			title: "Pagado",
			value: formatCurrency(summary.paidAmount),
			description: `${Math.round((summary.paidAmount / (summary.totalAmount || 1)) * 100)}% del total`,
			icon: CheckCircle,
			iconStyle: "text-green-500",
			iconWrapperStyle: "bg-green-500/30",
		},
		{
			title: "Pendiente",
			value: formatCurrency(summary.pendingAmount),
			description: "Por cobrar",
			icon: Clock,
			iconStyle: "text-primary",
			iconWrapperStyle: "bg-primary/30",
		},
	]

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			{kpis.map((kpi) => (
				<DashboardStatCard
					key={kpi.title}
					title={kpi.title}
					value={kpi.value}
					description={kpi.description}
					icon={kpi.icon}
					iconClassName={kpi.iconStyle}
					iconWrapperClassName={kpi.iconWrapperStyle}
				/>
			))}
		</div>
	)
}
