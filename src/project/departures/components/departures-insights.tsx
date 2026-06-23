"use client"

import { AlertTriangle, Bus, CalendarClock, Users } from "lucide-react"

import { DashboardStatCard } from "@/shared/components/ui/dashboard-stat-card"

import type { DepartureEvent } from "../types/departure.types"

interface DeparturesInsightsProps {
	events: DepartureEvent[]
}

export function DeparturesInsights({ events }: DeparturesInsightsProps) {
	const totalEvents = events.length
	const totalSales = events.reduce((sum, event) => sum + event.bookings.length, 0)
	const totalPassengers = events.reduce((sum, event) => sum + event.currentBookings, 0)
	const totalAlerts = events.filter((event) => {
		const isTransfer = event.serviceKind === "TRANSFER"
		const hasNoGuide = !isTransfer && !event.guide?.fullName
		const hasNoDriver = !event.driver?.fullName
		const hasNoVehicle = !event.vehicle?.vehiclePlate && !event.vehicle?.vehicleBrand
		const isOverCapacity = event.currentBookings > event.maxCapacity

		return hasNoGuide || hasNoDriver || hasNoVehicle || isOverCapacity
	}).length

	return (
		<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
			<DashboardStatCard
				title="Eventos del día"
				value={totalEvents}
				description="Con ventas asociadas"
				icon={CalendarClock}
				iconClassName="text-orange-600 dark:text-orange-300"
				iconWrapperClassName="bg-primary/30"
			/>
			<DashboardStatCard
				title="Ventas asociadas"
				value={totalSales}
				description="Vouchers del día"
				icon={Bus}
				iconClassName="text-sky-600 dark:text-sky-300"
				iconWrapperClassName="bg-sky-500/30"
			/>
			<DashboardStatCard
				title="Pasajeros"
				value={totalPassengers}
				description="Capacidad ocupada"
				icon={Users}
				iconClassName="text-emerald-600 dark:text-emerald-300"
				iconWrapperClassName="bg-emerald-500/30"
			/>
			<DashboardStatCard
				title="Alertas operativas"
				value={totalAlerts}
				description="Asignaciones pendientes o sobrecupo"
				icon={AlertTriangle}
				iconClassName="text-rose-600 dark:text-rose-300"
				iconWrapperClassName="bg-rose-500/30"
			/>
		</div>
	)
}
