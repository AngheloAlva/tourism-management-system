"use client"

import { Bar, XAxis, YAxis, BarChart, CartesianGrid, Legend } from "recharts"
import { es } from "date-fns/locale"
import { format } from "date-fns"
import { useMemo } from "react"

import { useTopToursByMonth } from "../hooks/use-analytics"

import { ChartContainer, ChartTooltip } from "@/shared/components/ui/chart"
import { Skeleton } from "@/shared/components/ui/skeleton"
import {
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	CardDescription,
} from "@/shared/components/ui/card"

import type { AnalyticsFilters } from "../actions/analytics.actions"

interface TopToursByMonthChartProps {
	filters: AnalyticsFilters
}

const COLORS = ["#2563eb", "#16a34a", "#eab308", "#f97316", "#a855f7"]

export function TopToursByMonthChart({ filters }: TopToursByMonthChartProps) {
	const { data, isLoading } = useTopToursByMonth(filters)

	const { chartData, tourNames } = useMemo(() => {
		if (!data || data.length === 0) return { chartData: [], tourNames: [] }

		const names = data[0]?.tours.map((t) => t.tourName) || []

		const transformed = data.map((monthData) => {
			const entry: Record<string, string | number> = {
				month: monthData.month,
			}
			monthData.tours.forEach((tour) => {
				entry[tour.tourName] = tour.salesCount
			})
			return entry
		})

		return { chartData: transformed, tourNames: names }
	}, [data])

	const formatMonth = (monthStr: string) => {
		try {
			const [year, month] = monthStr.split("-")
			const date = new Date(parseInt(year), parseInt(month) - 1, 1)
			return format(date, "MMM yy", { locale: es })
		} catch {
			return monthStr
		}
	}

	if (isLoading) {
		return <Skeleton className="h-[350px] w-full rounded-xl" />
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Top 5 Tours por Mes</CardTitle>
				<CardDescription>Cantidad de ventas mensuales de los tours más populares</CardDescription>
			</CardHeader>

			<CardContent className="p-0">
				{chartData && chartData.length > 0 ? (
					<ChartContainer config={{}} className="h-[300px] w-full">
						<BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
							<CartesianGrid strokeDasharray="3 3" vertical={false} />
							<XAxis
								dataKey="month"
								tickFormatter={formatMonth}
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								fontSize={12}
							/>
							<YAxis
								width={40}
								fontSize={12}
								tickLine={false}
								axisLine={false}
								allowDecimals={false}
							/>
							<ChartTooltip
								content={({ active, payload, label }) => {
									if (active && payload && payload.length) {
										const total = payload.reduce(
											(sum, entry) => sum + (Number(entry.value) || 0),
											0
										)
										return (
											<div className="bg-background min-w-[180px] rounded-lg border p-3 shadow-sm">
												<div className="mb-2 border-b pb-2">
													<span className="font-semibold">{formatMonth(label)}</span>
													<span className="text-muted-foreground ml-2 text-sm">
														({total} ventas)
													</span>
												</div>
												<div className="space-y-1">
													{payload.map((entry, index) => (
														<div
															key={entry.dataKey}
															className="flex items-center justify-between text-sm"
														>
															<div className="flex items-center gap-2">
																<div
																	className="h-2.5 w-2.5 rounded-sm"
																	style={{ backgroundColor: COLORS[index % COLORS.length] }}
																/>
																<span className="max-w-[120px] truncate">{entry.dataKey}</span>
															</div>
															<span className="font-medium">{entry.value}</span>
														</div>
													))}
												</div>
											</div>
										)
									}
									return null
								}}
							/>
							<Legend
								formatter={(value) => (
									<span className="text-xs">
										{value.length > 15 ? `${value.slice(0, 15)}...` : value}
									</span>
								)}
								wrapperStyle={{ fontSize: "12px" }}
							/>
							{tourNames.map((name, index) => (
								<Bar
									key={name}
									dataKey={name}
									// stackId="tours"
									fill={COLORS[index % COLORS.length]}
									// radius={index === tourNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
									radius={[4, 4, 0, 0]}
								/>
							))}
						</BarChart>
					</ChartContainer>
				) : (
					<div className="text-muted-foreground flex h-[300px] items-center justify-center">
						No hay datos para el período seleccionado
					</div>
				)}
			</CardContent>
		</Card>
	)
}
