"use client"

import { Bar, BarChart, CartesianGrid, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/shared/components/ui/card"
import { clp } from "./types"

type BalanceChartProps = {
	receivables: number
	payables: number
}

export function BalanceChart({ receivables, payables }: BalanceChartProps) {
	const data = [
		{
			name: "Por Cobrar",
			amount: receivables,
			color: "#10b981", // emerald-500
		},
		{
			name: "Por Pagar",
			amount: payables,
			color: "#f59e0b", // amber-500
		},
	]

	return (
		<Card className="col-span-3">
			<CardHeader>
				<CardTitle>Resumen Visual</CardTitle>
				<CardDescription>Comparativa de montos pendientes</CardDescription>
			</CardHeader>
			<CardContent className="pl-2">
				<div className="h-[300px] w-full">
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={data} layout="horizontal" barSize={80}>
							<CartesianGrid strokeDasharray="3 3" vertical={false} />
							<XAxis
								dataKey="name"
								stroke="#888888"
								fontSize={12}
								tickLine={false}
								axisLine={false}
							/>
							<Tooltip
								formatter={(value: number) => [clp(value), "Monto"]}
								cursor={{ fill: "transparent" }}
								contentStyle={{ borderRadius: "8px" }}
							/>
							<Bar dataKey="amount" radius={[4, 4, 0, 0]}>
								{data.map((entry, index) => (
									<Cell key={`cell-${index}`} fill={entry.color} />
								))}
							</Bar>
						</BarChart>
					</ResponsiveContainer>
				</div>
			</CardContent>
		</Card>
	)
}
