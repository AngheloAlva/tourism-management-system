"use client"

import { DollarSign, TrendingUp, Users, RefreshCw } from "lucide-react"

import { useBillingSummary } from "@/project/billing/hooks/use-billing"
import { cn } from "@/lib/utils"

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"

import type { BillingFilters } from "@/project/billing/actions/billing.actions"

interface BillingSummaryProps {
	filters?: BillingFilters
}

export function BillingSummary({ filters }: BillingSummaryProps) {
	const { data: summary, isLoading } = useBillingSummary(filters)

	if (isLoading) {
		return (
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Card key={i} className="animate-pulse">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<div className="bg-muted h-4 w-24 rounded" />
							<div className="bg-muted h-4 w-4 rounded" />
						</CardHeader>
						<CardContent>
							<div className="bg-muted mb-2 h-8 w-16 rounded" />
							<div className="bg-muted h-3 w-32 rounded" />
						</CardContent>
					</Card>
				))}
			</div>
		)
	}

	if (!summary) return null

	const formatCurrency = (amount: number) =>
		new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(amount)

	const kpis = [
		{
			title: "Total Ventas",
			value: summary.totalSales.toString(),
			description: `${summary.totalQuotes} cotizaciones`,
			icon: TrendingUp,
			color: "text-emerald-500 bg-emerald-500/10",
		},
		{
			title: "Ingresos Totales",
			value: formatCurrency(summary.totalRevenue),
			description: "Pagos recibidos",
			icon: DollarSign,
			color: "text-blue-500 bg-blue-500/10",
		},
		{
			title: "Total por Voucher Promedio",
			value: formatCurrency(summary.averageTicket),
			description: "Valor promedio por voucher",
			icon: Users,
			color: "text-purple-500 bg-purple-500/10",
		},
		{
			title: "Tasa de Conversión",
			value: `${summary.conversionRate.toFixed(1)}%`,
			description: "Cotizaciones a ventas",
			icon: RefreshCw,
			color: "text-primary bg-primary/10",
		},
	]

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			{kpis.map((kpi) => (
				<Card key={kpi.title} className="gap-2">
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
						<kpi.icon className={cn("h-7 w-7 rounded-full p-1.5", kpi.color)} />
					</CardHeader>

					<CardContent className="space-y-2">
						<div className="text-2xl font-bold">{kpi.value}</div>
						<p className="text-muted-foreground text-xs">{kpi.description}</p>
					</CardContent>
				</Card>
			))}
		</div>
	)
}
