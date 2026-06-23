"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from "recharts"

import { useSalesBySeller } from "../hooks/use-billing"

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/shared/components/ui/chart"
import {
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	CardDescription,
} from "@/shared/components/ui/card"

import type { BillingFilters } from "../actions/billing.actions"

interface SalesBySellerChartProps {
	filters?: BillingFilters
}

const colors = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
]

const chartConfig = {
	revenue: {
		label: "Ingresos",
		color: "var(--chart-1)",
	},
	salesCount: {
		label: "Ventas",
		color: "var(--chart-2)",
	},
}

export function SalesBySellerChart({ filters }: SalesBySellerChartProps) {
	const { data: sellers, isLoading } = useSalesBySeller(filters)

	const formatCurrency = (value: number) =>
		new Intl.NumberFormat("es-CL", {
			style: "currency",
			currency: "CLP",
			minimumFractionDigits: 0,
		}).format(value)

	if (isLoading) {
		return (
			<Card className="lg:col-span-2">
				<CardHeader>
					<CardTitle>Ventas por Vendedor</CardTitle>
					<CardDescription>Cargando...</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="bg-muted h-[300px] animate-pulse rounded" />
				</CardContent>
			</Card>
		)
	}

	if (!sellers || sellers.length === 0) {
		return (
			<Card className="lg:col-span-2">
				<CardHeader>
					<CardTitle>Ventas por Vendedor</CardTitle>
					<CardDescription>Ranking de vendedores</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-muted-foreground flex h-[300px] items-center justify-center text-sm">
						No hay datos de ventas en el período
					</div>
				</CardContent>
			</Card>
		)
	}

	const chartData = sellers.slice(0, 10).map((seller) => ({
		name: seller.sellerName.split(" ")[0],
		fullName: seller.sellerName,
		revenue: seller.revenue,
		salesCount: seller.salesCount,
		quotesCount: seller.quotesCount,
		passengers: seller.passengers,
	}))

	return (
		<Card className="lg:col-span-2">
			<CardHeader>
				<CardTitle>Ventas por Vendedor</CardTitle>
				<CardDescription>Ranking por ingresos generados</CardDescription>
			</CardHeader>
			<CardContent className="pl-0">
				<ChartContainer config={chartConfig} className="h-[300px] w-full">
					<BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis
							type="number"
							tick={{ fontSize: 12 }}
							tickLine={false}
							axisLine={false}
							tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
						/>
						<YAxis
							type="category"
							dataKey="name"
							tick={{ fontSize: 12 }}
							tickLine={false}
							axisLine={false}
							width={80}
						/>
						<ChartTooltip
							content={
								<ChartTooltipContent
									labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ""}
									formatter={(value, name) => {
										if (name === "revenue") {
											return [formatCurrency(value as number), "Ingresos"]
										}
										return [value, "Ventas"]
									}}
								/>
							}
						/>
						<Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
							{chartData.map((_, index) => (
								<Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
							))}
						</Bar>
					</BarChart>
				</ChartContainer>

				<div className="mt-4 space-y-2 pl-6">
					{sellers.slice(0, 5).map((seller, index) => (
						<div
							key={seller.sellerId}
							className="flex items-center justify-between rounded-md border p-2"
						>
							<div className="flex items-center gap-3">
								<div
									className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
									style={{ backgroundColor: colors[index % colors.length] }}
								>
									{index + 1}
								</div>
								<div>
									<p className="text-sm font-medium">{seller.sellerName}</p>
									<p className="text-muted-foreground text-xs">
										{seller.salesCount} ventas • {seller.passengers} pasajeros
									</p>
								</div>
							</div>
							<p className="font-semibold">{formatCurrency(seller.revenue)}</p>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	)
}
