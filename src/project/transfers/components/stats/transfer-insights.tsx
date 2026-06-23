"use client"

import { DollarSign, Users, Package, TrendingUp } from "lucide-react"

import { DashboardStatCard } from "@/shared/components/ui/dashboard-stat-card"
import type { TransferWithDetails } from "../../actions/transfer.actions"

interface TransferInsightsProps {
	transfers: TransferWithDetails[]
}

export function TransferInsights({ transfers }: TransferInsightsProps) {
	const totalTransfers = transfers.length

	const clpFormatter = new Intl.NumberFormat("es-CL", {
		style: "currency",
		currency: "CLP",
		maximumFractionDigits: 0,
	})

	const allPriceDetails = transfers.flatMap((t) => t.priceDetails)

	const totalTourPrice = allPriceDetails.reduce((sum, p) => sum + p.tourPrice, 0)
	const totalEntrancePrice = allPriceDetails.reduce((sum, p) => sum + p.entrancePrice, 0)
	const totalIncome = totalTourPrice + totalEntrancePrice

	const totalPassengers = transfers.reduce((sum, transfer) => {
		return sum + transfer.passengers.length
	}, 0)

	const ageCounts = allPriceDetails.reduce(
		(acc, p) => {
			if (p.ageCategory === "child") acc.children++
			else if (p.ageCategory === "senior") acc.seniors++
			else acc.adults++
			return acc
		},
		{ adults: 0, children: 0, seniors: 0 }
	)

	const averagePerTransfer = totalTransfers > 0 ? totalIncome / totalTransfers : 0

	const now = new Date()
	const currentMonthTransfers = transfers.filter((t) => {
		const d = new Date(t.date)
		return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
	})
	const currentMonthIncome = currentMonthTransfers.reduce(
		(sum, t) =>
			sum + t.priceDetails.reduce((ps, p) => ps + p.tourPrice + p.entrancePrice, 0),
		0
	)

	const paidTransfers = transfers.filter((t) => t.paymentStatus === "FULLY_PAID").length
	const pendingTransfers = transfers.filter((t) => t.paymentStatus === "PENDING").length

	const insights = [
		{
			title: "Total Traspasos",
			value: totalTransfers,
			description: `${paidTransfers} pagados, ${pendingTransfers} pendientes`,
			icon: Package,
			iconClassName: "text-slate-600 dark:text-slate-300",
			iconWrapperClassName: "bg-slate-500/30",
		},
		{
			title: "Ingresos Totales",
			value: clpFormatter.format(totalIncome),
			description: `Tour: ${clpFormatter.format(totalTourPrice)} · Entrada: ${clpFormatter.format(totalEntrancePrice)}`,
			icon: DollarSign,
			iconClassName: "text-emerald-600 dark:text-emerald-300",
			iconWrapperClassName: "bg-emerald-500/30",
		},
		{
			title: "Total Pasajeros",
			value: totalPassengers,
			description: `Adultos: ${ageCounts.adults} · Niños: ${ageCounts.children} · Seniors: ${ageCounts.seniors}`,
			icon: Users,
			iconClassName: "text-blue-600 dark:text-blue-300",
			iconWrapperClassName: "bg-blue-500/30",
		},
		{
			title: "Promedio por Traspaso",
			value: clpFormatter.format(averagePerTransfer),
			description: `Este mes: ${clpFormatter.format(currentMonthIncome)} (${currentMonthTransfers.length} traspasos)`,
			icon: TrendingUp,
			iconClassName: "text-violet-600 dark:text-violet-300",
			iconWrapperClassName: "bg-violet-500/30",
		},
	]

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			{insights.map((insight) => (
				<DashboardStatCard
					key={insight.title}
					title={insight.title}
					value={insight.value}
					description={insight.description}
					icon={insight.icon}
					iconClassName={insight.iconClassName}
					iconWrapperClassName={insight.iconWrapperClassName}
				/>
			))}
		</div>
	)
}
