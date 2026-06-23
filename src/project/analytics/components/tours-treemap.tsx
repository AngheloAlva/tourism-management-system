"use client"

import { useMemo } from "react"
import { LayoutGrid } from "lucide-react"
import { Treemap, ResponsiveContainer, Tooltip } from "recharts"

import { useTopTours } from "../hooks/use-analytics"
import type { AnalyticsFilters } from "../actions/analytics.actions"

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card"
import { Skeleton } from "@/shared/components/ui/skeleton"

interface ToursTreemapProps {
	filters: AnalyticsFilters
}

// Color palette for treemap
const COLORS = [
	"#3b82f6", // blue
	"#22c55e", // green
	"#f59e0b", // amber
	"#8b5cf6", // violet
	"#ec4899", // pink
	"#06b6d4", // cyan
	"#f97316", // orange
	"#84cc16", // lime
	"#6366f1", // indigo
	"#14b8a6", // teal
]

interface TreemapItem {
	name: string
	shortName: string
	value: number
	revenue: number
	percentage: number
	fill: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomContent = (props: any) => {
	const { x, y, width, height, name, shortName, percentage } = props

	if (width < 50 || height < 40) return null

	return (
		<g>
			<rect
				x={x}
				y={y}
				width={width}
				height={height}
				rx={4}
				style={{
					fill: props.fill,
					stroke: "rgba(255,255,255,0.3)",
					strokeWidth: 2,
				}}
			/>
			<text
				x={x + width / 2}
				y={y + height / 2 - 8}
				textAnchor="middle"
				fill="#fff"
				fontSize={width > 100 ? 13 : 11}
				fontWeight="500"
			>
				{width > 120 ? name : shortName}
			</text>
			<text
				x={x + width / 2}
				y={y + height / 2 + 10}
				textAnchor="middle"
				fill="rgba(255,255,255,0.85)"
				fontSize={11}
			>
				{percentage?.toFixed(1)}%
			</text>
		</g>
	)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
	if (!active || !payload || !payload.length) return null

	const data = payload[0].payload as TreemapItem

	const formatCurrency = (value: number) =>
		new Intl.NumberFormat("es-CL", {
			style: "currency",
			currency: "CLP",
		}).format(value)

	return (
		<div className="bg-popover text-popover-foreground min-w-[180px] rounded-lg border p-3 shadow-lg">
			<p className="mb-2 text-sm font-semibold">{data.name}</p>
			<div className="space-y-1 text-xs">
				<p className="flex justify-between">
					<span className="text-muted-foreground">Pasajeros:</span>
					<span className="font-medium">{data.value.toLocaleString()}</span>
				</p>
				<p className="flex justify-between">
					<span className="text-muted-foreground">Ingresos:</span>
					<span className="font-medium">{formatCurrency(data.revenue)}</span>
				</p>
				<p className="flex justify-between">
					<span className="text-muted-foreground">% del total:</span>
					<span className="font-medium">{data.percentage.toFixed(1)}%</span>
				</p>
			</div>
		</div>
	)
}

export function ToursTreemap({ filters }: ToursTreemapProps) {
	const { data: topTours, isLoading } = useTopTours(filters)

	const treemapData = useMemo(() => {
		if (!topTours || topTours.length === 0) return []

		return topTours.map(
			(tour, index): TreemapItem => ({
				name: tour.tourName,
				shortName: tour.tourName.length > 15 ? tour.tourName.slice(0, 12) + "..." : tour.tourName,
				value: tour.passengersCount,
				revenue: tour.revenue,
				percentage: tour.percentage,
				fill: COLORS[index % COLORS.length],
			})
		)
	}, [topTours])

	const totalPassengers = topTours?.reduce((sum, t) => sum + t.passengersCount, 0) ?? 0

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-48" />
					<Skeleton className="h-4 w-32" />
				</CardHeader>
				<CardContent>
					<Skeleton className="h-[350px] w-full" />
				</CardContent>
			</Card>
		)
	}

	if (!topTours || topTours.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Tours Más Vendidos</CardTitle>
					<CardDescription>No hay datos para el período seleccionado</CardDescription>
				</CardHeader>
			</Card>
		)
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<LayoutGrid className="h-5 w-5" />
					Tours Más Vendidos
				</CardTitle>
				<CardDescription>
					Distribución por pasajeros • Total: {totalPassengers.toLocaleString()} pasajeros
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="h-[350px] w-full">
					<ResponsiveContainer width="100%" height="100%">
						<Treemap
							dataKey="value"
							stroke="#ffffff"
							data={treemapData}
							aspectRatio={4 / 3}
							content={<CustomContent />}
						>
							<Tooltip content={<CustomTooltip />} />
						</Treemap>
					</ResponsiveContainer>
				</div>
			</CardContent>
		</Card>
	)
}
