"use client"

import { DollarSign, Users, Globe, Ticket, TrendingUp } from "lucide-react"

import { useAnalyticsSummary } from "../hooks/use-analytics"
import type { AnalyticsFilters } from "../actions/analytics.actions"

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Skeleton } from "@/shared/components/ui/skeleton"

interface AnalyticsSummaryProps {
	filters: AnalyticsFilters
}

export function AnalyticsSummary({ filters }: AnalyticsSummaryProps) {
	const { data: summary, isLoading } = useAnalyticsSummary(filters)

	const formatCurrency = (value: number) =>
		new Intl.NumberFormat("es-CL", {
			style: "currency",
			currency: "CLP",
			maximumFractionDigits: 0,
		}).format(value)

	if (isLoading) {
		return (
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
				{[...Array(5)].map((_, i) => (
					<Card key={i}>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-4 w-4" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-8 w-32" />
						</CardContent>
					</Card>
				))}
			</div>
		)
	}

	const stats = [
		{
			title: "Ingresos Totales",
			value: formatCurrency(summary?.totalRevenue ?? 0),
			icon: DollarSign,
			iconColor: "text-green-500 bg-green-500/10 p-1 rounded-full",
		},
		{
			title: "Ventas",
			value: summary?.totalSales?.toLocaleString() ?? "0",
			icon: Ticket,
			iconColor: "text-blue-500 bg-blue-500/10 p-1 rounded-full",
		},
		{
			title: "Pasajeros",
			value: summary?.totalPassengers?.toLocaleString() ?? "0",
			icon: Users,
			iconColor: "text-violet-500 bg-violet-500/10 p-1 rounded-full",
		},
		{
			title: "Voucher Promedio",
			value: formatCurrency(summary?.avgTicket ?? 0),
			icon: TrendingUp,
			iconColor: "text-amber-500 bg-amber-500/10 p-1 rounded-full",
		},
		{
			title: "Países",
			value: summary?.uniqueCountries?.toString() ?? "0",
			icon: Globe,
			iconColor: "text-cyan-500 bg-cyan-500/10 p-1 rounded-full",
		},
	]

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
			{stats.map((stat) => (
				<Card key={stat.title} className="gap-3">
					<CardHeader className="flex flex-row items-center justify-between space-y-0">
						<CardTitle className="text-muted-foreground text-sm font-medium">
							{stat.title}
						</CardTitle>
						<stat.icon className={`h-6 w-6 ${stat.iconColor}`} />
					</CardHeader>

					<CardContent>
						<div className="text-2xl font-bold">{stat.value}</div>
					</CardContent>
				</Card>
			))}
		</div>
	)
}
