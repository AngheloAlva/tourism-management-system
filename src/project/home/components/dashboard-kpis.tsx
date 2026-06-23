"use client"

import {
	Users,
	MapPin,
	FileText,
	Calendar,
	Building2,
	TrendingUp,
	DollarSign,
	AlertCircle,
} from "lucide-react"

import { useDashboardStats } from "../hooks/use-home"

import { DashboardStatCard } from "@/shared/components/ui/dashboard-stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"

export function DashboardKPIs() {
	const { data: stats, isLoading } = useDashboardStats()

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

	if (!stats) return null

	const formatTrend = (
		trendYoY: number | null | undefined,
		trendMoM: number
	) => {
		// Preferimos YoY (vs mismo mes año pasado) para amortiguar la estacionalidad
		// fuerte del turismo en San Pedro. Si no hay data del año pasado, caemos a MoM.
		if (trendYoY !== null && trendYoY !== undefined) {
			const sign = trendYoY > 0 ? "+" : ""
			return `${sign}${trendYoY.toFixed(1)}% vs mismo mes año anterior`
		}
		const sign = trendMoM > 0 ? "+" : ""
		return `${sign}${trendMoM.toFixed(1)}% vs mes anterior`
	}

	const kpis = [
		{
			title: "Ventas del Mes",
			value: stats.sales.current,
			description: formatTrend(stats.sales.trendYoY, stats.sales.trend),
			icon: TrendingUp,
			iconClassName: "text-green-500",
			iconWrapperClassName: "bg-green-500/30",
		},
		{
			title: "Ingresos del Mes",
			value: `$${stats.income.current.toLocaleString()}`,
			description: formatTrend(stats.income.trendYoY, stats.income.trend),
			icon: DollarSign,
			iconClassName: "text-blue-500",
			iconWrapperClassName: "bg-blue-500/30",
		},
		{
			title: "Cotizaciones Pendientes",
			value: stats.quotes.pending,
			description: "Requieren seguimiento",
			icon: FileText,
			iconClassName: "text-primary",
			iconWrapperClassName: "bg-primary/30",
		},
		{
			title: "Servicios Activos",
			value: stats.services.active,
			description: "Por realizar o en proceso",
			icon: Calendar,
			iconClassName: "text-purple-500",
			iconWrapperClassName: "bg-purple-500/30",
		},
		{
			title: "Pasajeros del Mes",
			value: stats.passengers.current,
			description: "Total registrados",
			icon: Users,
			iconClassName: "text-indigo-500",
			iconWrapperClassName: "bg-indigo-500/30",
		},
		{
			title: "Tours Activos",
			value: stats.tours.active,
			description: "Disponibles para venta",
			icon: MapPin,
			iconClassName: "text-pink-500",
			iconWrapperClassName: "bg-pink-500/30",
		},
		{
			title: "Agencias Activas",
			value: stats.agencies.active,
			description: "Partners comerciales",
			icon: Building2,
			iconClassName: "text-cyan-500",
			iconWrapperClassName: "bg-cyan-500/30",
		},
		{
			title: "Pagos Pendientes",
			value: stats.payments.pending,
			description: "Traspasos y Recepciones",
			icon: AlertCircle,
			iconClassName: "text-red-500",
			iconWrapperClassName: "bg-red-500/30",
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
					iconClassName={kpi.iconClassName}
					iconWrapperClassName={kpi.iconWrapperClassName}
				/>
			))}
		</div>
	)
}
