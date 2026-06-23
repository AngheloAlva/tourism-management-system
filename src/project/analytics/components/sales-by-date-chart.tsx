"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Bar, BarChart } from "recharts"
import { es } from "date-fns/locale"
import { format } from "date-fns"

import { useSalesByDate } from "@/project/billing/hooks/use-billing"

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/shared/components/ui/chart"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"
import {
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	CardDescription,
} from "@/shared/components/ui/card"

import type { BillingFilters } from "@/project/billing/actions/billing.actions"

interface SalesByDateChartProps {
	filters?: BillingFilters
	groupBy?: "day" | "week" | "month"
}

const chartConfig = {
	revenue: {
		label: "Ingresos",
		color: "var(--chart-1)",
	},
	salesCount: {
		label: "Ventas",
		color: "var(--chart-2)",
	},
	passengers: {
		label: "Pasajeros",
		color: "var(--chart-3)",
	},
}

export function SalesByDateChart({ filters, groupBy = "day" }: SalesByDateChartProps) {
	const { data: salesData, isLoading } = useSalesByDate(filters, groupBy)

	const formatCurrency = (value: number) =>
		new Intl.NumberFormat("es-CL", {
			style: "currency",
			currency: "CLP",
			minimumFractionDigits: 0,
		}).format(value)

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Ventas por Fecha</CardTitle>
					<CardDescription>Cargando...</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="bg-muted h-[300px] animate-pulse rounded" />
				</CardContent>
			</Card>
		)
	}

	if (!salesData || salesData.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Ventas por Fecha</CardTitle>
					<CardDescription>Tendencia de ventas</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-muted-foreground flex h-[300px] items-center justify-center text-sm">
						No hay datos de ventas en el período
					</div>
				</CardContent>
			</Card>
		)
	}

	const chartData = salesData.map((item) => {
		let label: string
		const dateStr = item.date

		if (groupBy === "month") {
			const [year, month] = dateStr.split("-")
			const date = new Date(parseInt(year), parseInt(month) - 1, 1)
			label = format(date, "MMM yyyy", { locale: es })
		} else if (groupBy === "week") {
			const date = new Date(dateStr)
			label = `Sem ${format(date, "w", { locale: es })}`
		} else {
			const date = new Date(dateStr)
			label = format(date, "dd/MM", { locale: es })
		}

		return {
			date: label,
			fullDate: dateStr,
			revenue: item.revenue,
			salesCount: item.salesCount,
			passengers: item.passengers,
		}
	})

	return (
		<Card>
			<CardHeader>
				<CardTitle>Ventas por Fecha</CardTitle>
				<CardDescription>Tendencia de ventas e ingresos</CardDescription>
			</CardHeader>
			<CardContent>
				<Tabs defaultValue="revenue" className="space-y-4">
					<TabsList>
						<TabsTrigger value="revenue">Ingresos</TabsTrigger>
						<TabsTrigger value="count">Cantidad</TabsTrigger>
					</TabsList>

					<TabsContent value="revenue">
						<ChartContainer config={chartConfig} className="h-[300px] w-full">
							<AreaChart data={chartData}>
								<defs>
									<linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor={chartConfig.revenue.color} stopOpacity={0.3} />
										<stop offset="95%" stopColor={chartConfig.revenue.color} stopOpacity={0} />
									</linearGradient>
								</defs>
								<CartesianGrid strokeDasharray="3 3" className="opacity-50" />
								<XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
								<YAxis
									tick={{ fontSize: 12 }}
									tickLine={false}
									axisLine={false}
									tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
								/>
								<ChartTooltip
									content={
										<ChartTooltipContent
											formatter={(value) => [formatCurrency(value as number), "Ingresos"]}
										/>
									}
								/>
								<Area
									type="monotone"
									dataKey="revenue"
									stroke={chartConfig.revenue.color}
									fill="url(#revenueGradient)"
									strokeWidth={2}
								/>
							</AreaChart>
						</ChartContainer>
					</TabsContent>

					<TabsContent value="count">
						<ChartContainer config={chartConfig} className="h-[300px] w-full">
							<BarChart data={chartData}>
								<CartesianGrid strokeDasharray="3 3" className="opacity-50" />
								<XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
								<YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
								<ChartTooltip
									content={
										<ChartTooltipContent
											formatter={(value, name) => {
												const labels: Record<string, string> = {
													salesCount: "Ventas",
													passengers: "Pasajeros",
												}
												return [value, labels[name as string] || name]
											}}
										/>
									}
								/>
								<Bar
									dataKey="salesCount"
									name="Ventas"
									fill={chartConfig.salesCount.color}
									radius={[4, 4, 0, 0]}
								/>
							</BarChart>
						</ChartContainer>
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	)
}
