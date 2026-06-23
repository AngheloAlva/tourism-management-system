"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Bar, BarChart } from "recharts"
import { es } from "date-fns/locale"
import { format } from "date-fns"

import { useCashFlowHistory } from "../hooks/use-cash-flow"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"
import {
	ChartLegend,
	ChartTooltip,
	ChartContainer,
	ChartLegendContent,
	ChartTooltipContent,
} from "@/shared/components/ui/chart"
import {
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	CardDescription,
} from "@/shared/components/ui/card"

const chartConfig = {
	balance: {
		label: "Balance",
		color: "var(--color-primary)",
	},
	income: {
		label: "Ingresos",
		color: "var(--color-green-500)",
	},
	expenses: {
		label: "Gastos",
		color: "var(--color-red-500)",
	},
	deposits: {
		label: "Depósitos",
		color: "var(--color-blue-500)",
	},
}

export function CashFlowChart() {
	const { data: history, isLoading } = useCashFlowHistory()

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Flujo de Caja Histórico</CardTitle>
					<CardDescription>Cargando...</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="bg-muted h-[300px] animate-pulse rounded" />
				</CardContent>
			</Card>
		)
	}

	if (!history || history.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Flujo de Caja Histórico</CardTitle>
					<CardDescription>Últimos 30 días</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-muted-foreground flex h-[300px] items-center justify-center text-sm">
						No hay datos históricos disponibles
					</div>
				</CardContent>
			</Card>
		)
	}

	const chartData = [...history].reverse().map((item) => {
		// item.date is CashBox.date (@db.Date, UTC midnight). Reconstruct local components
		// so date-fns format reads the correct calendar day regardless of server TZ.
		const localDay = new Date(item.date.getUTCFullYear(), item.date.getUTCMonth(), item.date.getUTCDate())
		return {
			date: format(localDay, "dd MMM", { locale: es }),
			fullDate: format(localDay, "EEEE, d 'de' MMMM", { locale: es }),
			balance:
				item.finalBalance ??
				item.initialBalance + item.totalIncome - item.totalExpenses - item.totalDeposits,
			income: item.totalIncome,
			expenses: item.totalExpenses,
			deposits: item.totalDeposits,
		}
	})

	const formatCurrency = (value: number) =>
		new Intl.NumberFormat("es-CL", {
			style: "currency",
			currency: "CLP",
			minimumFractionDigits: 0,
		}).format(value)

	return (
		<Card>
			<CardHeader>
				<CardTitle>Flujo de Caja Histórico</CardTitle>
				<CardDescription>Últimos 30 días</CardDescription>
			</CardHeader>
			<CardContent className="py-0 pr-0">
				<Tabs defaultValue="balance" className="space-y-4">
					<TabsList>
						<TabsTrigger value="balance">Balance</TabsTrigger>
						<TabsTrigger value="movements">Movimientos</TabsTrigger>
					</TabsList>

					<TabsContent value="balance">
						<ChartContainer config={chartConfig} className="h-[320px] w-full">
							<AreaChart data={chartData}>
								<defs>
									<linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor={chartConfig.balance.color} stopOpacity={0.3} />
										<stop offset="95%" stopColor={chartConfig.balance.color} stopOpacity={0} />
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
											labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || ""}
											formatter={(value) => [formatCurrency(value as number), "Balance"]}
										/>
									}
								/>
								<Area
									type="monotone"
									dataKey="balance"
									stroke={chartConfig.balance.color}
									fill="url(#balanceGradient)"
									strokeWidth={2}
								/>
							</AreaChart>
						</ChartContainer>
					</TabsContent>

					<TabsContent value="movements">
						<ChartContainer config={chartConfig} className="h-[320px] w-full">
							<BarChart data={chartData}>
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
											labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || ""}
											formatter={(value, name) => {
												const labels: Record<string, string> = {
													income: "Ingresos",
													expenses: "Gastos",
													deposits: "Depósitos",
												}
												return [formatCurrency(value as number), labels[name as string] || name]
											}}
										/>
									}
								/>
								<ChartLegend content={<ChartLegendContent />} />
								<Bar
									dataKey="income"
									name="Ingresos"
									fill={chartConfig.income.color}
									radius={[4, 4, 0, 0]}
								/>
								<Bar
									dataKey="expenses"
									name="Gastos"
									fill={chartConfig.expenses.color}
									radius={[4, 4, 0, 0]}
								/>
								<Bar
									dataKey="deposits"
									name="Depósitos"
									fill={chartConfig.deposits.color}
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
