"use client"

import { Calendar, Users, Clock, MapPin, AlertTriangle, UserX, Car, Settings2 } from "lucide-react"
import { es } from "date-fns/locale"
import { format } from "date-fns"

import { cn } from "@/lib/utils"

import { ScrollArea } from "@/shared/components/ui/scroll-area"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import { Card, CardContent } from "@/shared/components/ui/card"

import type { DepartureEvent } from "../types/departure.types"
import { getEventDisplayName } from "@/project/events/utils/event-display"

interface EventListProps {
	selectedDate: Date
	events: DepartureEvent[]
	selectedEventId: string | null
	onSelectEvent: (eventId: string) => void
	onEditEvent?: (eventId: string) => void
}

export function EventList({
	events,
	selectedDate,
	onSelectEvent,
	selectedEventId,
	onEditEvent,
}: EventListProps) {
	if (events.length === 0) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-center">
					<Calendar className="text-muted-foreground mx-auto h-12 w-12" />
					<h3 className="text-muted-foreground mt-4 text-lg font-medium">
						No hay eventos para el día seleccionado
					</h3>
					<p className="text-muted-foreground mt-2 text-sm">
						{format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: es })}
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className="flex h-full flex-col gap-0">
			<div className="flex items-center justify-between border-b py-4">
				<div>
					<h2 className="text-lg font-semibold">Eventos del Día</h2>
					<p className="text-muted-foreground text-sm">
						{format(selectedDate, "EEEE, dd 'de' MMMM", { locale: es })}
					</p>
				</div>

				<Badge className="ml-auto">{events.length} eventos</Badge>
			</div>

			<ScrollArea className="h-[calc(100%-80px)]">
				<div className="space-y-2 p-4">
					{events.map((event) => {
						const isSelected = selectedEventId === event.id
						const totalPax = event.bookings.reduce((acc, b) => acc + b.passengerCount, 0)
						const isTransfer = event.serviceKind === "TRANSFER"
						const hasNoGuide = !isTransfer && !event.guide?.fullName
						const hasNoDriver = !event.driver?.fullName
						const hasNoVehicle = !event.vehicle?.vehiclePlate && !event.vehicle?.vehicleBrand
						const isOverCapacity = event.currentBookings > event.maxCapacity
						const hasAlert = hasNoGuide || hasNoDriver || hasNoVehicle || isOverCapacity

						return (
							<Card
								key={event.id}
								className={cn(
									"cursor-pointer py-0 transition-all hover:shadow-md",
									isSelected &&
										"dark:border-primary/60 dark:bg-primary/10 border-orange-300 bg-orange-50/60",
									hasAlert &&
										!isSelected &&
										"border-red-300 bg-red-50/40 dark:border-red-500/60 dark:bg-red-500/10"
								)}
								onClick={() => onSelectEvent(event.id)}
							>
								<CardContent className="p-4">
									<div className="space-y-3">
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<div className="flex items-start gap-2">
													{hasAlert && (
														<AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
													)}
													<h3 className="leading-tight font-semibold">{getEventDisplayName(event)}</h3>
												</div>

												<div className="mt-2 flex flex-wrap items-center gap-2">
													<Badge
														className={cn(
															"border-blue-200 bg-blue-100 text-xs text-blue-800 dark:border-blue-500/50 dark:bg-blue-500/20 dark:text-blue-100",
															{
																"border-green-200 bg-green-100 text-green-800":
																	event.mode === "PRIVATE",
																"dark:border-green-500/50 dark:bg-green-500/20 dark:text-green-100":
																	event.mode === "PRIVATE",
															}
														)}
													>
														{event.mode === "PRIVATE" ? "Privado" : "Regular"}
													</Badge>
													{hasNoGuide && (
														<Badge variant="destructive" className="text-xs">
															<UserX className="mr-1 h-3 w-3" />
															Sin guía
														</Badge>
													)}
													{hasNoDriver && (
														<Badge variant="destructive" className="text-xs">
															<Users className="mr-1 h-3 w-3" />
															Sin conductor
														</Badge>
													)}
													{hasNoVehicle && (
														<Badge variant="destructive" className="text-xs">
															<Car className="mr-1 h-3 w-3" />
															Sin vehículo
														</Badge>
													)}
												</div>
											</div>

											<div className="flex flex-col items-end gap-2">
												<div
													className={cn(
														"flex items-center gap-1 text-sm font-medium",
														isOverCapacity && "text-red-600"
													)}
												>
													<Users className="h-4 w-4" />
													<span>
														{totalPax}/{event.maxCapacity}
													</span>
												</div>
												{onEditEvent && (
													<Button
														size="sm"
														variant="outline"
														className="h-7 px-2 text-xs"
														onClick={(e) => {
															e.stopPropagation()
															onEditEvent(event.id)
														}}
													>
														<Settings2 className="mr-1 h-3 w-3" />
														Asignar
													</Button>
												)}
											</div>
										</div>

										<div className="text-muted-foreground mt-4 grid grid-cols-2 gap-2 text-xs">
											{event.startTime && (
												<div className="flex items-center gap-1">
													<Clock className="h-3 w-3" />
													<span>
														{event.startTime} - {event.endTime || ""}
													</span>
												</div>
											)}
											{event.guide && (
												<div className="flex items-center gap-1">
													<MapPin className="h-3 w-3" />
													<span className="truncate">{event.guide.fullName}</span>
												</div>
											)}
										</div>

										{event.bookings.length > 0 && (
											<div className="bg-muted/50 rounded-md p-2 text-xs">
												<span className="font-medium">{event.bookings.length}</span>{" "}
												{event.bookings.length === 1 ? "venta asociada" : "ventas asociadas"}
											</div>
										)}
									</div>
								</CardContent>
							</Card>
						)
					})}
				</div>
			</ScrollArea>
		</div>
	)
}
