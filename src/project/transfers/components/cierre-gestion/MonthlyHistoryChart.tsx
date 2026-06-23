"use client"

import { useMemo, useState } from "react"
import { Bar, XAxis, YAxis, Legend, BarChart, Cell } from "recharts"

import {
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	CardDescription,
} from "@/shared/components/ui/card"

import type { CGRow } from "./types"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/shared/components/ui/chart"

type MonthlyHistoryChartProps = {
	recepciones: CGRow[]
	traspasos: CGRow[]
}

export function MonthlyHistoryChart({ recepciones, traspasos }: MonthlyHistoryChartProps) {
	const [activeIndex, setActiveIndex] = useState<number | null>(null)

	const data = useMemo(() => {
		const monthlyData: Record<string, { name: string; received: number; transferred: number }> = {}

		// Process Recepciones (Received)
		recepciones.forEach((r) => {
			const date = new Date(r.fecha)
			const key = `${date.getFullYear()}-${date.getMonth()}`
			const name = date.toLocaleDateString("es-CL", { month: "short", year: "2-digit" })

			if (!monthlyData[key]) {
				monthlyData[key] = { name, received: 0, transferred: 0 }
			}
			monthlyData[key].received += r.total
		})

		// Process Traspasos (Transferred)
		traspasos.forEach((t) => {
			const date = new Date(t.fecha)
			const key = `${date.getFullYear()}-${date.getMonth()}`
			const name = date.toLocaleDateString("es-CL", { month: "short", year: "2-digit" })

			if (!monthlyData[key]) {
				monthlyData[key] = { name, received: 0, transferred: 0 }
			}
			monthlyData[key].transferred += t.total
		})

		// Convert to array and sort chronologically
		return Object.keys(monthlyData)
			.sort((a, b) => {
				const [yearA, monthA] = a.split("-").map(Number)
				const [yearB, monthB] = b.split("-").map(Number)
				return yearA !== yearB ? yearA - yearB : monthA - monthB
			})
			.map((key) => monthlyData[key])
	}, [recepciones, traspasos])

	if (data.length === 0) return null

	return (
		<Card className="print:hidden">
			<CardHeader>
				<CardTitle>Historial Mensual</CardTitle>
				<CardDescription>Comparativa de flujos pagados mes a mes</CardDescription>
			</CardHeader>
			<CardContent className="p-0">
				<ChartContainer config={{}} className="h-[350px] w-full">
					<BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
						<rect
							x="0"
							y="0"
							width="100%"
							height="85%"
							fill="url(#default-multiple-pattern-dots)"
						/>
						<defs>
							<DottedBackgroundPattern />
						</defs>

						<XAxis
							dataKey="name"
							tickLine={false}
							tickMargin={10}
							axisLine={false}
							tickFormatter={(value) => value.slice(0, 3)}
						/>
						<YAxis
							stroke="#888888"
							fontSize={12}
							tickLine={false}
							axisLine={false}
							tickFormatter={(value) => `$${value / 1000}k`}
						/>
						<ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
						<Legend />
						<Bar dataKey="received" name="Pagado (Recibido)" fill="var(--color-primary)" radius={4}>
							{data.map((_, index) => (
								<Cell
									key={`cell-received-${index}`}
									fillOpacity={activeIndex === null ? 1 : activeIndex === index ? 1 : 0.3}
									stroke={activeIndex === index ? "var(--color-primary)" : ""}
									onMouseEnter={() => setActiveIndex(index)}
									className="duration-200"
								/>
							))}
						</Bar>
						<Bar
							dataKey="transferred"
							name="Cobrado (Transferido)"
							fill="var(--color-emerald-500)"
							radius={4}
						>
							{data.map((_, index) => (
								<Cell
									key={`cell-transferred-${index}`}
									fillOpacity={activeIndex === null ? 1 : activeIndex === index ? 1 : 0.3}
									stroke={activeIndex === index ? "var(--color-emerald-500)" : ""}
									onMouseEnter={() => setActiveIndex(index)}
									className="duration-200"
								/>
							))}
						</Bar>
						{/* <Bar
							name="Recibido (Cobrado)"
							dataKey="received"
							fill="#10b981"
							radius={[4, 4, 0, 0]}
						/>
						<Bar
							name="Pagado (Transferido)"
							dataKey="transferred"
							fill="#f59e0b"
							radius={[4, 4, 0, 0]}
						/> */}
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	)
}

const DottedBackgroundPattern = () => {
	return (
		<pattern
			id="default-multiple-pattern-dots"
			x="0"
			y="0"
			width="10"
			height="10"
			patternUnits="userSpaceOnUse"
		>
			<circle className="dark:text-muted/40 text-muted" cx="2" cy="2" r="1" fill="currentColor" />
		</pattern>
	)
}
