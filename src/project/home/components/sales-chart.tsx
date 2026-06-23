"use client"

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { useSalesChart } from "../hooks/use-home"

import {
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	CardDescription,
} from "@/shared/components/ui/card"
import {
	ChartConfig,
	ChartLegend,
	ChartTooltip,
	ChartContainer,
	ChartLegendContent,
	ChartTooltipContent,
} from "@/shared/components/ui/chart"

const chartConfig = {
	sales: {
		label: "Ventas",
		color: "var(--chart-1)",
	},
	quotes: {
		label: "Cotizaciones",
		color: "var(--chart-2)",
	},
} satisfies ChartConfig

export function SalesChart() {
	const { data: chartData, isLoading } = useSalesChart()

	if (isLoading) {
		return (
			<Card className="col-span-4 h-fit">
				<CardHeader>
					<div className="bg-muted mb-2 h-6 w-48 rounded" />
					<div className="bg-muted h-4 w-32 rounded" />
				</CardHeader>
				<CardContent>
					<div className="bg-muted h-[200px] w-full rounded" />
				</CardContent>
			</Card>
		)
	}

	return (
		<Card className="col-span-4 h-fit">
			<CardHeader>
				<CardTitle>Resumen de Ventas</CardTitle>
				<CardDescription>Mostrando ventas y cotizaciones de los últimos 12 meses</CardDescription>
			</CardHeader>

			<CardContent>
				<ChartContainer config={chartConfig}>
					<AreaChart
						accessibilityLayer
						data={chartData}
						margin={{
							left: 12,
							right: 12,
						}}
					>
						<ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />

						<CartesianGrid vertical={false} />

						<XAxis
							dataKey="name"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							tickFormatter={(value) => value.slice(0, 3)}
						/>

						<Area
							dataKey="quotes"
							type="natural"
							fill="var(--color-quotes)"
							fillOpacity={0.4}
							stroke="var(--color-quotes)"
							stackId="a"
						/>
						<Area
							dataKey="sales"
							type="natural"
							fill="var(--color-sales)"
							fillOpacity={0.4}
							stroke="var(--color-sales)"
							stackId="a"
						/>

						<ChartLegend content={<ChartLegendContent />} />
					</AreaChart>
				</ChartContainer>
			</CardContent>
		</Card>
	)
}
