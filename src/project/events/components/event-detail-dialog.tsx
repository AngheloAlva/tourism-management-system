"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
	Loader2,
	Users,
	Wrench,
	DollarSign,
	StickyNote,
	User,
	Car,
	UtensilsCrossed,
} from "lucide-react"

import { getEventById } from "../actions/event.actions"
import { EventDetailForm } from "./event-detail-form"
import { formatCurrency } from "@/shared/lib/format-currency"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Badge } from "@/shared/components/ui/badge"
import { Progress } from "@/shared/components/ui/progress"
import { ScrollArea } from "@/shared/components/ui/scroll-area"

interface EventDetailDialogProps {
	eventId: string | null
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function EventDetailDialog({ eventId, open, onOpenChange }: EventDetailDialogProps) {
	const { data: event, isLoading } = useQuery({
		queryKey: ["event", eventId],
		queryFn: () => (eventId ? getEventById(eventId) : null),
		enabled: !!eventId && open,
	})

	const operationalCosts = useMemo(() => {
		if (!event) return null
		const guideCost = event.guideCost ?? 0
		const driverCost = event.driverCost ?? 0
		const vehicleCost = event.vehicleCost ?? 0
		const cateringCost = event.cateringCost ?? 0
		const total = guideCost + driverCost + vehicleCost + cateringCost
		if (total === 0) return null
		return { guideCost, driverCost, vehicleCost, cateringCost, total }
	}, [event])

	const capacityPercent = useMemo(() => {
		if (!event || !event.maxCapacity || event.maxCapacity === 0) return 0
		return Math.round((event.currentBookings / event.maxCapacity) * 100)
	}, [event])

	const isAtCapacity = event ? event.currentBookings >= (event.maxCapacity ?? 0) : false

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-5xl p-0">
				<DialogHeader className="px-6 pt-6">
					<DialogTitle>Detalle del Evento</DialogTitle>
				</DialogHeader>

				{isLoading ? (
					<div className="flex h-60 items-center justify-center">
						<Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
					</div>
				) : event ? (
					<ScrollArea className="max-h-[80vh] px-6 pb-6">
						{/* Operational Summary — Read-only */}
						<div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
							{/* Capacity Card */}
							<Card>
								<CardHeader className="flex flex-row items-center gap-2 pb-2">
									<Users className="text-muted-foreground h-4 w-4" />
									<CardTitle className="text-sm font-medium">Capacidad</CardTitle>
								</CardHeader>
								<CardContent className="space-y-2">
									<div className="flex items-center justify-between">
										<span className="text-2xl font-bold">
											{event.currentBookings}/{event.maxCapacity ?? "—"}
										</span>
										<Badge
											className={
												isAtCapacity
													? "bg-red-100 text-red-800 hover:bg-red-100"
													: "bg-green-100 text-green-800 hover:bg-green-100"
											}
										>
											{isAtCapacity ? "Lleno" : "Disponible"}
										</Badge>
									</div>
									{event.maxCapacity != null && event.maxCapacity > 0 && (
										<Progress
											value={Math.min(capacityPercent, 100)}
											className={
												capacityPercent > 80
													? "[&>[data-slot=progress-indicator]]:bg-red-500"
													: capacityPercent > 60
														? "[&>[data-slot=progress-indicator]]:bg-yellow-500"
														: "[&>[data-slot=progress-indicator]]:bg-green-500"
											}
										/>
									)}
								</CardContent>
							</Card>

							{/* Operational Resources Card */}
							<Card>
								<CardHeader className="flex flex-row items-center gap-2 pb-2">
									<Wrench className="text-muted-foreground h-4 w-4" />
									<CardTitle className="text-sm font-medium">
										Recursos Operacionales
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-1.5 text-sm">
									<div className="flex items-center gap-2">
										<User className="text-muted-foreground h-3.5 w-3.5" />
										<span className="text-muted-foreground">Guía:</span>
										<span className="font-medium">
											{event.guide?.fullName ?? "Sin asignar"}
										</span>
									</div>
									<div className="flex items-center gap-2">
										<User className="text-muted-foreground h-3.5 w-3.5" />
										<span className="text-muted-foreground">Conductor:</span>
										<span className="font-medium">
											{event.driver?.fullName ?? "Sin asignar"}
										</span>
									</div>
									<div className="flex items-center gap-2">
										<Car className="text-muted-foreground h-3.5 w-3.5" />
										<span className="text-muted-foreground">Vehículo:</span>
										<span className="font-medium">
											{event.vehicle
												? `${event.vehicle.vehiclePlate} - ${event.vehicle.vehicleBrand} ${event.vehicle.vehicleModel}`
												: "Sin asignar"}
										</span>
									</div>
									<div className="flex items-center gap-2">
										<UtensilsCrossed className="text-muted-foreground h-3.5 w-3.5" />
										<span className="text-muted-foreground">Catering:</span>
										<span className="font-medium">
											{event.cateringProvider?.companyName ??
												event.cateringProvider?.fullName ??
												"Sin asignar"}
										</span>
									</div>
								</CardContent>
							</Card>

							{/* Operational Costs Card */}
							{operationalCosts && (
								<Card>
									<CardHeader className="flex flex-row items-center gap-2 pb-2">
										<DollarSign className="text-muted-foreground h-4 w-4" />
										<CardTitle className="text-sm font-medium">
											Costos Operacionales
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-1.5 text-sm">
										{operationalCosts.guideCost > 0 && (
											<div className="flex justify-between">
												<span className="text-muted-foreground">Guía</span>
												<span className="font-mono">
													{formatCurrency(operationalCosts.guideCost)}
												</span>
											</div>
										)}
										{operationalCosts.driverCost > 0 && (
											<div className="flex justify-between">
												<span className="text-muted-foreground">Conductor</span>
												<span className="font-mono">
													{formatCurrency(operationalCosts.driverCost)}
												</span>
											</div>
										)}
										{operationalCosts.vehicleCost > 0 && (
											<div className="flex justify-between">
												<span className="text-muted-foreground">Vehículo</span>
												<span className="font-mono">
													{formatCurrency(operationalCosts.vehicleCost)}
												</span>
											</div>
										)}
										{operationalCosts.cateringCost > 0 && (
											<div className="flex justify-between">
												<span className="text-muted-foreground">Catering</span>
												<span className="font-mono">
													{formatCurrency(operationalCosts.cateringCost)}
												</span>
											</div>
										)}
										<div className="border-t pt-1.5">
											<div className="flex justify-between font-semibold">
												<span>Total</span>
												<span className="font-mono">
													{formatCurrency(operationalCosts.total)}
												</span>
											</div>
										</div>
									</CardContent>
								</Card>
							)}

							{/* Operational Notes Card */}
							{event.operationalNotes && (
								<Card>
									<CardHeader className="flex flex-row items-center gap-2 pb-2">
										<StickyNote className="text-muted-foreground h-4 w-4" />
										<CardTitle className="text-sm font-medium">
											Notas Operativas
										</CardTitle>
									</CardHeader>
									<CardContent>
										<p className="text-muted-foreground text-sm whitespace-pre-wrap">
											{event.operationalNotes}
										</p>
									</CardContent>
								</Card>
							)}
						</div>

						{/* Editable Form */}
						<EventDetailForm
							event={event}
							onCancel={() => onOpenChange(false)}
							onSuccess={() => onOpenChange(false)}
						/>
					</ScrollArea>
				) : (
					<div className="text-muted-foreground flex h-60 items-center justify-center">
						No se encontró el evento
					</div>
				)}
			</DialogContent>
		</Dialog>
	)
}
