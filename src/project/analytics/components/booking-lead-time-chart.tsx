"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { useBookingLeadTime } from "../hooks/use-analytics"

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

interface BookingLeadTimeChartProps {
	filters: AnalyticsFilters
}

export function BookingLeadTimeChart({ filters }: BookingLeadTimeChartProps) {
	const { data, isLoading } = useBookingLeadTime(filters)

	if (isLoading) {
		return <Skeleton className="h-[350px] w-full rounded-xl" />
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Anticipación de Reserva</CardTitle>
				<CardDescription>Tiempo entre la compra y el tour</CardDescription>
			</CardHeader>

			<CardContent className="p-0">
				{data && data.length > 0 ? (
					<ChartContainer config={{}} className="h-[300px] w-full">
						<BarChart
							data={data}
							layout="vertical"
							margin={{ top: 0, right: 30, left: 20, bottom: 0 }}
						>
							<CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
							<XAxis type="number" hide />
							<YAxis
								dataKey="range"
								type="category"
								width={80}
								tick={{ fontSize: 12 }}
								axisLine={false}
								tickLine={false}
							/>
							<ChartTooltip
								cursor={{ fill: "transparent" }}
								content={({ active, payload }) => {
									if (active && payload && payload.length) {
										const d = payload[0].payload
										return (
											<div className="bg-background rounded-lg border p-2 shadow-sm">
												<div className="flex flex-col gap-1">
													<span className="font-bold">{d.range}</span>
													<span>{d.count} reservas</span>
													<span className="text-muted-foreground text-xs">
														{d.percentage.toFixed(1)}% del total
													</span>
												</div>
											</div>
										)
									}
									return null
								}}
							/>
							<Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
						</BarChart>
					</ChartContainer>
				) : (
					<div className="text-muted-foreground flex h-full items-center justify-center">
						No hay datos
					</div>
				)}
			</CardContent>
		</Card>
	)
}
