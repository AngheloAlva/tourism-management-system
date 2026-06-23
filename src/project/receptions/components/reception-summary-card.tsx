"use client"

import { useMemo } from "react"
import { Calendar, Users, CreditCard, Package, DollarSign } from "lucide-react"
import { es } from "date-fns/locale"
import { format } from "date-fns"

import { getPaymentMethodLabel } from "@/shared/lib/payment-method-labels"
import { Separator } from "@/shared/components/ui/separator"
import { Badge } from "@/shared/components/ui/badge"
import {
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	CardDescription,
} from "@/shared/components/ui/card"

import type { ReceptionFormData } from "../schemas/reception.schema"
import type { ActiveTour } from "@/project/tours/hooks/use-tours"

interface ReceptionSummaryCardProps {
	formData: Partial<ReceptionFormData>
	availableTours?: ActiveTour[]
}

export function ReceptionSummaryCard({ formData, availableTours = [] }: ReceptionSummaryCardProps) {
	const totalPagos =
		formData.payments?.reduce((sum, payment) => {
			const amount = Number(payment.amount) || 0
			return payment.refund ? sum - amount : sum + amount
		}, 0) || 0

	const numPagos = formData.payments?.length || 0
	const numEventos = formData.eventDetails?.length || 0

	const toursMap = useMemo(() => {
		const map = new Map<string, ActiveTour>()
		for (const tour of availableTours) {
			map.set(tour.id, tour)
		}
		return map
	}, [availableTours])

	const calcularMontoEsperado = () => {
		if (!formData.eventDetails?.length) {
			return { tour: 0, entradas: 0, total: 0, totalPax: 0 }
		}

		let totalTour = 0
		let totalEntradas = 0
		let totalPax = 0

		for (const eventDetail of formData.eventDetails) {
			const priceEntries = eventDetail.priceEntries ?? []
			const entrySnapshots = eventDetail.entrySnapshots ?? []

			for (const pe of priceEntries) {
				totalTour += (pe.count || 0) * (pe.reception || 0)
				totalPax += pe.count || 0
			}

			for (const snap of entrySnapshots) {
				totalEntradas += (snap.count || 0) * (snap.price || 0)
			}
		}

		return { tour: totalTour, entradas: totalEntradas, total: totalTour + totalEntradas, totalPax }
	}

	const montoEsperado = calcularMontoEsperado()
	const numPasajeros = montoEsperado.totalPax || formData.passengers?.length || 0
	const montoPendiente = montoEsperado.total - totalPagos

	return (
		<Card className="border-primary/20 sticky top-0 max-h-fit min-w-[400px] gap-2 bg-neutral-100 p-2 dark:bg-neutral-900">
			<CardHeader className="gap-0 p-2 pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="text-lg">Resumen</CardTitle>
					<Badge variant="default">Recepción</Badge>
				</div>
				<CardDescription>Vista detallada de la información</CardDescription>
			</CardHeader>

			<CardContent className="space-y-4 p-2 text-sm">
				{/* Eventos/Tours */}
				<div className="space-y-2">
					<h4 className="text-primary flex items-center gap-2 font-semibold">
						<Calendar className="h-4 w-4" />
						Eventos/Tours <span className="text-muted-foreground">({numEventos})</span>
					</h4>
					<div className="space-y-1 pl-6">
						{formData.eventDetails && formData.eventDetails.length > 0 ? (
							<>
								{formData.eventDetails.map((event, index) => {
									const selectedTour = toursMap.get(event.tourId)

									return (
										<div
											key={event.clientId || index}
											className="text-muted-foreground mt-1 space-y-0.5 text-xs"
										>
											<p className="font-semibold">
												Evento #{index + 1} {selectedTour && `- ${selectedTour.name}`}
											</p>
											<p>Modo: {event.mode === "REGULAR" ? "Regular" : "Privado"}</p>
											{event.date && (
												<p>
														Fecha:{" "}
														{format(
															new Date(
																(event.date as Date).getUTCFullYear(),
																(event.date as Date).getUTCMonth(),
																(event.date as Date).getUTCDate()
															),
															"dd MMM yyyy",
															{ locale: es }
														)}
													</p>
											)}
											{event.startTime && event.endTime && (
												<p>
													Horas: {event.startTime} - {event.endTime}
												</p>
											)}
											{event.flyDate && (
												<p>
													Fecha vuelo:{" "}
													{format(new Date(event.flyDate), "dd MMM yyyy", { locale: es })}
												</p>
											)}
											{event.flyTime && <p>Hora vuelo: {event.flyTime}</p>}
											{event.flyName && <p>Vuelo: {event.flyName}</p>}
											{event.comments && (
												<p className="text-muted-foreground/70 italic">
													Comentarios: {event.comments}
												</p>
											)}
										</div>
									)
								})}
							</>
						) : (
							<p className="text-muted-foreground italic">Sin eventos registrados</p>
						)}
					</div>
				</div>

				<Separator />

				{/* Pasajeros */}
				<div className="space-y-2">
					<h4 className="text-primary flex items-center gap-2 font-semibold">
						<Users className="h-4 w-4" />
						Pasajeros <span className="text-muted-foreground">({numPasajeros})</span>
					</h4>
					<div className="pl-6">
						{numPasajeros > 0 ? (
							<div className="space-y-1">
								{formData.passengers?.map((passenger, index) => (
									<div
										key={passenger.clientId || index}
										className="text-muted-foreground space-y-0.5 text-xs"
									>
										<p className="font-medium">
											• {passenger.name || `Pasajero ${index + 1}`}
											{passenger.age && (
												<span className="text-muted-foreground/70"> ({passenger.age} años)</span>
											)}
										</p>
										{passenger.rut && (
											<p className="pl-3 text-[11px]">
												<span className="text-orange-600">RUT:</span> {passenger.rut}
											</p>
										)}
										{passenger.hotels?.some((h) => h.hotelName) && (
											<p className="pl-3 text-[11px]">
												<span className="text-orange-600">Hotel:</span>{" "}
												{passenger.hotels.map((h) => h.hotelName).filter(Boolean).join(", ")}
											</p>
										)}
										{passenger.nacionality && (
											<p className="pl-3 text-[11px]">
												<span className="text-orange-600">Nacionalidad:</span>{" "}
												{passenger.nacionality}
											</p>
										)}
										{passenger.diet_type && (
											<p className="pl-3 text-[11px]">
												<span className="text-orange-600">Dieta:</span> {passenger.diet_type}
											</p>
										)}
										{passenger.allergies && passenger.allergies.length > 0 && (
											<div className="mt-0.5 flex flex-wrap gap-1 pl-3">
												<span className="text-[11px] text-orange-600">Alergias:</span>
												{passenger.allergies.map((allergy, i) => (
													<Badge key={i} variant="secondary" className="h-4 px-1 text-[10px]">
														{allergy}
													</Badge>
												))}
											</div>
										)}
									</div>
								))}
							</div>
						) : (
							<p className="text-muted-foreground italic">Sin pasajeros registrados</p>
						)}
					</div>
				</div>

				<Separator />

				{/* Pagos */}
				<div className="space-y-2">
					<h4 className="text-primary flex items-center gap-2 font-semibold">
						<CreditCard className="h-4 w-4" />
						Pagos <span className="text-muted-foreground">({numPagos})</span>
					</h4>
					<div className="pl-6">
						{numPagos > 0 ? (
							<div className="space-y-2">
								<div className="border-primary/20 bg-primary/10 rounded-md border p-3">
									<p className="text-muted-foreground mb-1 text-xs">Total pagos:</p>
									<p className="text-primary text-2xl font-bold">
										$
										{totalPagos.toLocaleString("es-CL", {
											minimumFractionDigits: 0,
											maximumFractionDigits: 0,
										})}
									</p>
								</div>
								<div className="space-y-0.5">
									{formData.payments?.map((payment, index) => {
										const amount = Number(payment.amount) || 0
										return (
											<p
												key={payment.clientId || index}
												className="text-muted-foreground flex items-center gap-1 text-xs"
											>
												{payment.refund ? (
													<span className="text-destructive">↓</span>
												) : (
													<span className="text-green-500">↑</span>
												)}
												{getPaymentMethodLabel(payment.method)}: $
												{amount.toLocaleString("es-CL", {
													minimumFractionDigits: 0,
													maximumFractionDigits: 0,
												})}
												{payment.refund && (
													<Badge variant="destructive" className="ml-1 text-[10px]">
														Reembolso
													</Badge>
												)}
											</p>
										)
									})}
								</div>
							</div>
						) : (
							<p className="text-muted-foreground italic">Sin pagos registrados</p>
						)}
					</div>
				</div>

				{/* Monto Esperado */}
				{montoEsperado.total > 0 && (
					<>
						<Separator />
						<div className="space-y-2">
							<h4 className="text-primary flex items-center gap-2 font-semibold">
								<DollarSign className="h-4 w-4" />
								Cálculo de Precios
							</h4>
							<div className="space-y-1 pl-6 text-xs">
								<div className="flex justify-between">
									<span className="text-muted-foreground">Precio Tours:</span>
									<span className="font-medium">${montoEsperado.tour.toLocaleString("es-CL")}</span>
								</div>
								{montoEsperado.entradas > 0 && (
									<div className="flex justify-between">
										<span className="text-muted-foreground">Entradas:</span>
										<span className="font-medium">
											${montoEsperado.entradas.toLocaleString("es-CL")}
										</span>
									</div>
								)}
								<Separator className="my-1" />
								<div className="flex justify-between font-semibold">
									<span>Monto Esperado:</span>
									<span className="text-orange-600">
										${montoEsperado.total.toLocaleString("es-CL")}
									</span>
								</div>
								{totalPagos > 0 && (
									<div className="flex justify-between">
										<span className="text-muted-foreground">Pagado:</span>
										<span className="font-medium text-green-600">
											${totalPagos.toLocaleString("es-CL")}
										</span>
									</div>
								)}
								{montoPendiente > 0 && (
									<div className="flex justify-between font-semibold">
										<span>Pendiente:</span>
										<span className="text-yellow-600">
											${montoPendiente.toLocaleString("es-CL")}
										</span>
									</div>
								)}
							</div>
						</div>
					</>
				)}

				{/* Resumen Final */}
				{(numEventos > 0 || numPasajeros > 0) && (
					<>
						<Separator />
						<div className="space-y-2">
							<h4 className="text-primary flex items-center gap-2 font-semibold">
								<Package className="h-4 w-4" />
								Resumen
							</h4>
							<div className="space-y-1 pl-6 text-xs">
								<div className="flex justify-between">
									<span className="text-muted-foreground">Eventos:</span>
									<span className="font-medium">{numEventos}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Pasajeros:</span>
									<span className="font-medium">{numPasajeros}</span>
								</div>
								{numPagos > 0 && (
									<div className="flex justify-between">
										<span className="text-muted-foreground">Pagos registrados:</span>
										<span className="font-medium">{numPagos}</span>
									</div>
								)}
							</div>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	)
}
