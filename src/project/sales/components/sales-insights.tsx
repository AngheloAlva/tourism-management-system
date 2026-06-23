"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { DollarSign, ShoppingCart, FileText, TrendingUp, Calendar, ClipboardList } from "lucide-react"
import type { SalesSummary } from "../actions/sale-record.actions"

interface SalesInsightsProps {
	summary: SalesSummary
}

export function SalesInsights({ summary }: SalesInsightsProps) {
	const insights = [
		{
			title: "Total Ventas",
			value: summary.totalSales,
			icon: ShoppingCart,
			description: "Ventas confirmadas",
			color: "text-green-600",
			bgColor: "bg-green-100",
		},
		{
			title: "Cotizaciones",
			value: summary.totalQuotes,
			icon: FileText,
			description: "Cotizaciones pendientes",
			color: "text-blue-600",
			bgColor: "bg-blue-100",
		},
		{
			title: "Ingresos Totales",
			value: new Intl.NumberFormat("es-CL", {
				style: "currency",
				currency: "CLP",
				minimumFractionDigits: 0,
			}).format(summary.totalRevenue),
			icon: DollarSign,
			description: "De ventas realizadas",
			color: "text-emerald-600",
			bgColor: "bg-emerald-100",
		},
		{
			title: "Ingresos Potenciales",
			value: new Intl.NumberFormat("es-CL", {
				style: "currency",
				currency: "CLP",
				minimumFractionDigits: 0,
			}).format(summary.pendingRevenue),
			icon: TrendingUp,
			description: "De cotizaciones",
			color: "text-amber-600",
			bgColor: "bg-amber-100",
		},
		{
			title: "Ventas del Mes",
			value: summary.salesThisMonth,
			icon: Calendar,
			description: "En el mes actual",
			color: "text-purple-600",
			bgColor: "bg-purple-100",
		},
		{
			title: "Cotizaciones del Mes",
			value: summary.quotesThisMonth,
			icon: ClipboardList,
			description: "En el mes actual",
			color: "text-pink-600",
			bgColor: "bg-pink-100",
		},
	]

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{insights.map((insight, index) => {
				const Icon = insight.icon
				return (
					<Card key={index}>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">{insight.title}</CardTitle>
							<div className={`rounded-full p-2 ${insight.bgColor}`}>
								<Icon className={`h-4 w-4 ${insight.color}`} />
							</div>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{insight.value}</div>
							<p className="text-xs text-muted-foreground mt-1">{insight.description}</p>
						</CardContent>
					</Card>
				)
			})}
		</div>
	)
}
