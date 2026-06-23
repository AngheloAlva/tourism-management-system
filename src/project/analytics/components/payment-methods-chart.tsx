"use client"

import { Cell, Pie, PieChart } from "recharts"

import { usePaymentMethods } from "../hooks/use-analytics"

import { ChartContainer, ChartLegend, ChartTooltip } from "@/shared/components/ui/chart"
import { Skeleton } from "@/shared/components/ui/skeleton"
import {
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	CardDescription,
} from "@/shared/components/ui/card"

import type { AnalyticsFilters } from "../actions/analytics.actions"

interface PaymentMethodsChartProps {
	filters: AnalyticsFilters
}

const COLORS = ["#0ea5e9", "#22c55e", "#eab308", "#f97316", "#ef4444", "#a855f7"]

const METHOD_LABELS: Record<string, string> = {
	CASH: "Efectivo",
	TRANSFER: "Transferencia",
	CREDIT_CARD: "Tarjeta de Credito",
	DEBIT_CARD: "Tarjeta de Debito",
	PAYMENT_LINK_DEBIT: "Link de pago Debito",
	PAYMENT_LINK_CREDIT: "Link de pago Credito",
	// Compatibilidad historica
	CARD: "Tarjeta",
	PAYMENT_LINK: "Link de pago",
	OTHER: "Otro",
}

export function PaymentMethodsChart({ filters }: PaymentMethodsChartProps) {
	const { data, isLoading } = usePaymentMethods(filters)

	const formatCurrency = (value: number) =>
		new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(value)

	if (isLoading) {
		return <Skeleton className="h-[350px] w-full rounded-xl" />
	}

	return (
		<Card className="flex flex-col">
			<CardHeader>
				<CardTitle>Métodos de Pago</CardTitle>
				<CardDescription>Distribución por monto total</CardDescription>
			</CardHeader>

			<CardContent className="flex-1">
				{data && data.length > 0 ? (
					<ChartContainer config={{}} className="h-[300px] w-full">
						<PieChart>
							<Pie
								cx="50%"
								cy="50%"
								data={data}
								innerRadius={45}
								outerRadius={100}
								paddingAngle={5}
								dataKey="amount"
							>
								{data.map((_, index) => (
									<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
								))}
							</Pie>

							<ChartTooltip
								content={({ active, payload }) => {
									if (active && payload && payload.length) {
										const d = payload[0].payload
										return (
											<div className="bg-background rounded-lg border p-2 shadow-sm">
												<div className="flex flex-col gap-1">
													<span className="font-bold">{METHOD_LABELS[d.method] || d.method}</span>
													<span className="text-muted-foreground">
														{formatCurrency(d.amount)} ({d.percentage.toFixed(1)}%)
													</span>
													<span className="text-muted-foreground text-xs">
														{d.count} transacciones
													</span>
												</div>
											</div>
										)
									}
									return null
								}}
							/>
							<ChartLegend
								formatter={(value, entry: any) => {
									const item = data.find((d) => d.amount === entry.payload.value)
									return METHOD_LABELS[item?.method || value] || value
								}}
								layout="vertical"
								verticalAlign="middle"
								align="right"
							/>
						</PieChart>
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
