"use client"

import { useState } from "react"
import { Area, XAxis, YAxis, AreaChart, CartesianGrid } from "recharts"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"

import { useSalesEvolution } from "../hooks/use-analytics"

import { ChartContainer, ChartTooltip } from "@/shared/components/ui/chart"
import { Skeleton } from "@/shared/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"
import {
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	CardDescription,
} from "@/shared/components/ui/card"

import type { AnalyticsFilters } from "../actions/analytics.actions"

interface SalesEvolutionChartProps {
	filters: AnalyticsFilters
}

type GroupBy = "day" | "month"

export function SalesEvolutionChart({ filters }: SalesEvolutionChartProps) {
	const [groupBy, setGroupBy] = useState<GroupBy>("day")
	const { data, isLoading } = useSalesEvolution(filters, groupBy)

	const formatCurrency = (value: number) =>
		new Intl.NumberFormat("es-CL", {
			style: "currency",
			currency: "CLP",
		}).format(value)

	const formatDate = (dateStr: string) => {
		try {
			if (groupBy === "month") {
				// Format: "yyyy-MM" -> "Ene 2025"
				const [year, month] = dateStr.split("-")
				const date = new Date(parseInt(year), parseInt(month) - 1, 1)
				return format(date, "MMM yyyy", { locale: es })
			}
			return format(parseISO(dateStr), "d MMM", { locale: es })
		} catch {
			return dateStr
		}
	}

	if (isLoading) {
		return <Skeleton className="h-[350px] w-full rounded-xl" />
	}

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between">
				<div>
					<CardTitle>Evolución de Ventas</CardTitle>
					<CardDescription>
						Ingresos {groupBy === "day" ? "diarios" : "mensuales"} en el período seleccionado
					</CardDescription>
				</div>
				<Tabs value={groupBy} onValueChange={(value) => setGroupBy(value as GroupBy)}>
					<TabsList className="h-8">
						<TabsTrigger value="day" className="h-6 px-3 text-xs">
							Diario
						</TabsTrigger>
						<TabsTrigger value="month" className="h-6 px-3 text-xs">
							Mensual
						</TabsTrigger>
					</TabsList>
				</Tabs>
			</CardHeader>
			<CardContent>
				{data && data.length > 0 ? (
					<ChartContainer config={{}} className="h-[300px] w-full">
						<AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
							<defs>
								<linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
									<stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
									<stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
								</linearGradient>
							</defs>
							<CartesianGrid strokeDasharray="3 3" vertical={false} />
							<XAxis
								dataKey="date"
								tickFormatter={formatDate}
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								fontSize={12}
							/>
							<YAxis
								width={70}
								fontSize={12}
								tickLine={false}
								axisLine={false}
								tickFormatter={formatCurrency}
							/>
							<ChartTooltip
								content={({ active, payload, label }) => {
									if (active && payload && payload.length) {
										return (
											<div className="bg-background rounded-lg border p-2 shadow-sm">
												<div className="flex flex-col">
													<span className="text-muted-foreground mb-1 text-[0.70rem] uppercase">
														{formatDate(label)}
													</span>
													<span className="text-base font-medium">
														{formatCurrency(payload[0].value as number)}
													</span>
													<span className="text-muted-foreground text-xs">
														{payload[0].payload.count} ventas
													</span>
												</div>
											</div>
										)
									}
									return null
								}}
							/>
							<Area
								type="monotone"
								dataKey="revenue"
								stroke="#2563eb"
								fillOpacity={1}
								fill="url(#colorRevenue)"
							/>
						</AreaChart>
					</ChartContainer>
				) : (
					<div className="text-muted-foreground flex h-full items-center justify-center">
						No hay datos para el período seleccionado
					</div>
				)}
			</CardContent>
		</Card>
	)
}
