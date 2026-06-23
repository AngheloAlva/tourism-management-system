"use client"

import { DollarSign, Users, Package, TrendingUp } from "lucide-react"

import { DashboardStatCard } from "@/shared/components/ui/dashboard-stat-card"
import type { ReceptionWithDetails } from "../../actions/reception.actions"

interface ReceptionInsightsProps {
	receptions: ReceptionWithDetails[]
}

export function ReceptionInsights({ receptions }: ReceptionInsightsProps) {
	const totalReceptions = receptions.length

	const totalIncome = receptions.reduce((sum, reception) => {
		return (
			sum +
			reception.payments.reduce((paymentSum, payment) => {
				return payment.refund ? paymentSum - payment.amount : paymentSum + payment.amount
			}, 0)
		)
	}, 0)

	const totalPassengers = receptions.reduce((sum, reception) => {
		return sum + reception.passengers.length
	}, 0)

	const averagePerReception = totalReceptions > 0 ? totalIncome / totalReceptions : 0

	const totalEvents = receptions.reduce((sum, reception) => {
		return sum + reception.eventBookings.length
	}, 0)

	// Payment status breakdown
	const paidCount = receptions.filter((r) => r.paymentStatus === "FULLY_PAID").length
	const pendingCount = totalReceptions - paidCount

	// Income breakdown by tour price vs entrance price
	const totalTourPrice = receptions.reduce(
		(sum, r) => sum + r.priceDetails.reduce((s, pd) => s + pd.tourPrice, 0),
		0
	)
	const totalEntrancePrice = receptions.reduce(
		(sum, r) => sum + r.priceDetails.reduce((s, pd) => s + pd.entrancePrice, 0),
		0
	)

	// Age category breakdown from priceDetails
	const ageCounts = receptions.reduce(
		(acc, r) => {
			for (const pd of r.priceDetails) {
				if (pd.ageCategory === "child") acc.children++
				else if (pd.ageCategory === "senior") acc.seniors++
				else acc.adults++
			}
			return acc
		},
		{ adults: 0, children: 0, seniors: 0 }
	)

	// Current month stats
	const now = new Date()
	const currentMonthReceptions = receptions.filter((r) => {
		const d = new Date(r.date)
		return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
	})
	const currentMonthIncome = currentMonthReceptions.reduce((sum, reception) => {
		return (
			sum +
			reception.payments.reduce((paymentSum, payment) => {
				return payment.refund ? paymentSum - payment.amount : paymentSum + payment.amount
			}, 0)
		)
	}, 0)

	const insights = [
		{
			title: "Total Recepciones",
			value: totalReceptions,
			description: `${paidCount} pagadas · ${pendingCount} pendientes`,
			icon: Package,
			iconClassName: "text-slate-600 dark:text-slate-300",
			iconWrapperClassName: "bg-slate-500/30",
		},
		{
			title: "Ingresos Totales",
			value: `$${totalIncome.toLocaleString("es-CL")}`,
			description: `Tour: $${totalTourPrice.toLocaleString("es-CL")} · Entrada: $${totalEntrancePrice.toLocaleString("es-CL")}`,
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
			title: "Promedio por Recepción",
			value: `$${averagePerReception.toLocaleString("es-CL")}`,
			description: `Este mes: $${currentMonthIncome.toLocaleString("es-CL")} (${currentMonthReceptions.length} recepciones)`,
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
