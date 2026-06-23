"use client"

import { AlertTriangle, UserX, Car, Utensils, Users } from "lucide-react"

import { Alert, AlertTitle, AlertDescription } from "@/shared/components/ui/alert"
import { Badge } from "@/shared/components/ui/badge"

import type { DepartureEvent } from "../types/departure.types"
import { getEventDisplayName } from "@/project/events/utils/event-display"

interface DepartureAlertsProps {
	events: DepartureEvent[]
}

export function DepartureAlerts({ events }: DepartureAlertsProps) {
	// Filtrar eventos por tipo de problema
	const eventsWithoutGuide = events.filter(
		(event) => event.serviceKind !== "TRANSFER" && !event.guide?.fullName
	)
	const eventsWithoutDriver = events.filter((event) => !event.driver?.fullName)
	const eventsWithoutVehicle = events.filter(
		(event) => !event.vehicle?.vehiclePlate && !event.vehicle?.vehicleBrand
	)
	const overCapacityEvents = events.filter((event) => event.currentBookings > event.maxCapacity)

	// Filtrar eventos que podrían necesitar catering (tours largos, no transfers)
	// Asumimos que tours con duración mayor a 4 horas o que tengan horario de comida podrían necesitar catering
	const eventsWithoutCatering = events.filter((event) => {
		// Solo para tours, no transfers
		if (event.serviceKind === "TRANSFER") return false

		// Si tiene catering asignado, no hay problema
		if (event.cateringProvider?.fullName || event.cateringProvider?.companyName) return false

		// Si tiene más de 6 pasajeros, probablemente necesite catering
		if (event.currentBookings > 6) return true

		return false
	})

	// Si no hay alertas, no mostrar nada
	const totalAlerts =
		eventsWithoutGuide.length +
		eventsWithoutDriver.length +
		eventsWithoutVehicle.length +
		eventsWithoutCatering.length +
		overCapacityEvents.length

	if (totalAlerts === 0) {
		return null
	}

	return (
		<div className="space-y-3">
			{/* Resumen de alertas */}
			<Alert>
				<AlertTriangle className="h-4 w-4" />
				<AlertTitle>Se detectaron {totalAlerts} problemas operativos</AlertTitle>
				<AlertDescription>
					Revisa las alertas a continuación para asegurar que todos los eventos estén completamente
					configurados.
				</AlertDescription>
			</Alert>

			{/* Alerta de eventos sin guía */}
			{eventsWithoutGuide.length > 0 && (
				<Alert variant="destructive">
					<UserX className="h-4 w-4" />
					<AlertTitle className="flex items-center gap-2">
						{eventsWithoutGuide.length === 1
							? "Evento sin guía asignado"
							: `${eventsWithoutGuide.length} eventos sin guía asignado`}
					</AlertTitle>
					<AlertDescription>
						<div className="mt-2 space-y-1">
							{eventsWithoutGuide.map((event) => (
								<div
									key={`guide-${event.id}`}
									className="bg-destructive/10 flex items-center justify-between gap-4 rounded-md px-3 py-2"
								>
									<div>
										<p className="font-medium">{getEventDisplayName(event)}</p>
										<p className="text-xs opacity-80">
											{event.startTime || "Sin horario"} • {event.currentBookings} pasajeros
										</p>
									</div>
									<Badge variant="outline" className="border-destructive text-destructive">
										Sin guía
									</Badge>
								</div>
							))}
						</div>
					</AlertDescription>
				</Alert>
			)}

			{/* Alerta de eventos sin conductor */}
			{eventsWithoutDriver.length > 0 && (
				<Alert variant="destructive">
					<Users className="h-4 w-4" />
					<AlertTitle className="flex items-center gap-2">
						{eventsWithoutDriver.length === 1
							? "Evento sin conductor asignado"
							: `${eventsWithoutDriver.length} eventos sin conductor asignado`}
					</AlertTitle>
					<AlertDescription>
						<div className="mt-2 space-y-1">
							{eventsWithoutDriver.map((event) => (
								<div
									key={`driver-${event.id}`}
									className="bg-destructive/10 flex items-center justify-between gap-4 rounded-md px-3 py-2"
								>
									<div>
										<p className="font-medium">{getEventDisplayName(event)}</p>
										<p className="text-xs opacity-80">
											{event.startTime || "Sin horario"} • {event.currentBookings} pasajeros
										</p>
									</div>
									<Badge variant="outline" className="border-destructive text-destructive">
										Sin conductor
									</Badge>
								</div>
							))}
						</div>
					</AlertDescription>
				</Alert>
			)}

			{/* Alerta de eventos sin vehículo */}
			{eventsWithoutVehicle.length > 0 && (
				<Alert variant="destructive">
					<Car className="h-4 w-4" />
					<AlertTitle className="flex items-center gap-2">
						{eventsWithoutVehicle.length === 1
							? "Evento sin vehículo asignado"
							: `${eventsWithoutVehicle.length} eventos sin vehículo asignado`}
					</AlertTitle>
					<AlertDescription>
						<div className="mt-2 space-y-1">
							{eventsWithoutVehicle.map((event) => (
								<div
									key={`vehicle-${event.id}`}
									className="bg-destructive/10 flex items-center justify-between gap-4 rounded-md px-3 py-2"
								>
									<div>
										<p className="font-medium">{getEventDisplayName(event)}</p>
										<p className="text-xs opacity-80">
											{event.startTime || "Sin horario"} • {event.currentBookings} pasajeros
										</p>
									</div>
									<Badge variant="outline" className="border-destructive text-destructive">
										Sin vehículo
									</Badge>
								</div>
							))}
						</div>
					</AlertDescription>
				</Alert>
			)}

			{/* Alerta de eventos sin catering (warning, no crítico) */}
			{eventsWithoutCatering.length > 0 && (
				<Alert>
					<Utensils className="h-4 w-4" />
					<AlertTitle className="flex items-center gap-2">
						{eventsWithoutCatering.length === 1
							? "Evento podría necesitar catering"
							: `${eventsWithoutCatering.length} eventos podrían necesitar catering`}
					</AlertTitle>
					<AlertDescription>
						<div className="mt-2 space-y-1">
							{eventsWithoutCatering.map((event) => (
								<div
									key={`catering-${event.id}`}
									className="flex items-center justify-between gap-4 rounded-md bg-orange-50 px-3 py-2"
								>
									<div>
										<p className="font-medium">{getEventDisplayName(event)}</p>
										<p className="text-xs opacity-80">
											{event.startTime || "Sin horario"} • {event.currentBookings} pasajeros
										</p>
									</div>
									<Badge variant="outline" className="border-orange-300 text-orange-700">
										Sin catering
									</Badge>
								</div>
							))}
						</div>
					</AlertDescription>
				</Alert>
			)}

			{/* Alerta de sobrecupo */}
			{overCapacityEvents.length > 0 && (
				<Alert variant="destructive">
					<AlertTriangle className="h-4 w-4" />
					<AlertTitle className="flex items-center gap-2">
						{overCapacityEvents.length === 1
							? "Evento con sobrecupo"
							: `${overCapacityEvents.length} eventos con sobrecupo`}
					</AlertTitle>
					<AlertDescription>
						<div className="mt-2 space-y-1">
							{overCapacityEvents.map((event) => (
								<div
									key={`capacity-${event.id}`}
									className="bg-destructive/10 flex items-center justify-between rounded-md px-3 py-2"
								>
									<div>
										<p className="font-medium">{getEventDisplayName(event)}</p>
										<p className="text-xs opacity-80">
											{event.startTime || "Sin horario"} • Capacidad: {event.maxCapacity}
										</p>
									</div>
									<Badge variant="outline" className="border-destructive text-destructive">
										{event.currentBookings}/{event.maxCapacity}
									</Badge>
								</div>
							))}
						</div>
					</AlertDescription>
				</Alert>
			)}
		</div>
	)
}
