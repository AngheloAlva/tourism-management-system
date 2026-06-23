"use client"

import { CalendarIcon, CreditCardIcon, PackageIcon, TicketIcon } from "lucide-react"
import { formatCalendarDay } from "@/shared/utils/calendar-day"

import { Separator } from "@/shared/components/ui/separator"
import { Badge } from "@/shared/components/ui/badge"
import {
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	CardDescription,
} from "@/shared/components/ui/card"

import type { SaleRecordWithDetails } from "@/project/sales/actions/sale-record.actions"
import type { TransferFormData } from "../schemas/transfer.schema"
import { getEventDisplayName } from "@/project/events/utils/event-display"

interface TransferSummaryCardProps {
	formData: TransferFormData
	selectedSale: SaleRecordWithDetails | null
}

export function TransferSummaryCard({ formData, selectedSale }: TransferSummaryCardProps) {
	// Calculate totals based on selected events to transfer
	const selectedEvents = formData.eventTransfers?.filter((et) => et.transferEvent) || []
	const numEventsToTransfer = selectedEvents.length
	const getSelectedPassengers = (event: TransferFormData["eventTransfers"][number]) =>
		(event.passengerPrices || []).filter(
			(passenger) => passenger.isSelected && !passenger.isAlreadyTransferred
		)
	const totalSelectedPassengers = selectedEvents.reduce(
		(sum, event) => sum + getSelectedPassengers(event).length,
		0
	)

	// Full total (sum of all selected events)
	const totalEventsAmount = selectedEvents.reduce((sum, event) => {
		const eventTotal = getSelectedPassengers(event).reduce(
			(pSum, pp) => pSum + (pp.totalPrice || 0),
			0
		)
		return sum + eventTotal
	}, 0)

	// Calculate payable amount based on VALID payment status
	let payableAmount = 0
	if (formData.paymentStatus === "FULLY_PAID") {
		payableAmount = totalEventsAmount
	} else if (formData.paymentStatus === "TOUR_ONLY") {
		payableAmount = selectedEvents.reduce((sum, event) => {
			return sum + getSelectedPassengers(event).reduce((pSum, pp) => pSum + (pp.tourPrice || 0), 0)
		}, 0)
	} else if (formData.paymentStatus === "ENTRANCE_ONLY") {
		payableAmount = selectedEvents.reduce((sum, event) => {
			return (
				sum + getSelectedPassengers(event).reduce((pSum, pp) => pSum + (pp.entrancePrice || 0), 0)
			)
		}, 0)
	}
	// PENDING stays 0

	const totalPayments =
		formData.payments?.reduce((sum, payment) => {
			const amount = Number(payment.amount) || 0
			return payment.refund ? sum - amount : sum + amount
		}, 0) || 0

	const numPayments = formData.payments?.length || 0

	// Derive makePayment from paymentStatus (it's not part of the schema type directly if implied)
	// Checking against "PENDING"
	const makePayment = formData.paymentStatus !== "PENDING"

	return (
		<Card className="border-primary/20 sticky top-0 max-h-fit min-w-[300px] gap-2 bg-neutral-100 p-2 dark:bg-neutral-900">
			<CardHeader className="gap-0 p-2 pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="text-lg">Resumen de Traspaso</CardTitle>
					<div className="flex items-center gap-2">
						<Badge variant="default">Traspaso</Badge>
					</div>
				</div>
				<CardDescription>Vista detallada de la información</CardDescription>
			</CardHeader>

			<CardContent className="space-y-4 p-2 text-sm">
				{/* Voucher Info */}
				{selectedSale && (
					<div className="space-y-2">
						<h4 className="text-primary flex items-center gap-2 font-semibold">
							<TicketIcon className="h-4 w-4" />
							Voucher
						</h4>
						<div className="text-muted-foreground pl-6 text-xs">
							<p>
								<span className="font-medium">Código:</span> {selectedSale.voucher || "N/A"}
							</p>
							<p>
								<span className="font-medium">Agencia Origen:</span>{" "}
								{selectedSale.agency?.name || "Directa"}
							</p>
							<p>
								<span className="font-medium">Pasajeros seleccionados:</span>{" "}
								{totalSelectedPassengers}
							</p>
						</div>
					</div>
				)}

				<Separator />

				{/* Events to Transfer */}
				<div className="space-y-2">
					<h4 className="text-primary flex items-center gap-2 font-semibold">
						<CalendarIcon className="h-4 w-4" />
						Eventos a Transferir{" "}
						<span className="text-muted-foreground">({numEventsToTransfer})</span>
					</h4>
					<div className="space-y-1 pl-6">
						{numEventsToTransfer > 0 ? (
							<>
								{selectedEvents.map((et, index) => {
									const originalEvent = selectedSale?.eventBookings.find(
										(eb) => eb.event.id === et.eventId
									)
									const eventName = originalEvent ? getEventDisplayName(originalEvent.event) : "Evento desconocido"
									const eventDate = originalEvent?.event.date
										? formatCalendarDay(originalEvent.event.date, "dd/MM")
										: ""

									const selectedPassengers = getSelectedPassengers(et)
									const eventTotal = selectedPassengers.reduce(
										(sum, pp) => sum + (pp.totalPrice || 0),
										0
									)

									return (
										<div
											key={et.clientId || et.eventId || index}
											className="text-muted-foreground flex justify-between text-xs"
										>
											<span className="max-w-[180px] truncate" title={eventName}>
												{eventDate} - {eventName}
											</span>
											<span className="font-medium">${eventTotal.toLocaleString("es-CL")}</span>
										</div>
									)
								})}
								<div className="mt-2 text-right">
									<p className="text-xs font-semibold">
										Total Eventos: ${totalEventsAmount.toLocaleString("es-CL")}
									</p>
								</div>
							</>
						) : (
							<p className="text-muted-foreground text-xs italic">Ningún evento seleccionado</p>
						)}
					</div>
				</div>

				<Separator />

				{/* Payments */}
				{makePayment && (
					<>
						<div className="space-y-2">
							<h4 className="text-primary flex items-center gap-2 font-semibold">
								<CreditCardIcon className="h-4 w-4" />
								Pagos Registrados <span className="text-muted-foreground">({numPayments})</span>
							</h4>
							<div className="pl-6">
								{numPayments > 0 ? (
									<div className="space-y-1">
										{formData.payments?.map((payment, index) => (
											<div
												key={payment.clientId || index}
												className="text-muted-foreground flex justify-between text-xs"
											>
												<span>
													{`${payment.method === "CASH" ? "Efectivo" : payment.method}${
														payment.refund ? " (Reembolso)" : ""
													}`}
												</span>
												<span className={payment.refund ? "text-destructive" : ""}>
													{payment.refund ? "-" : ""}$
													{Number(payment.amount).toLocaleString("es-CL")}
												</span>
											</div>
										))}
									</div>
								) : (
									<p className="text-muted-foreground text-xs italic">Sin pagos</p>
								)}
							</div>
						</div>
						<Separator />
					</>
				)}

				{/* Final Summary */}
				<div className="space-y-2">
					<h4 className="text-primary flex items-center gap-2 font-semibold">
						<PackageIcon className="h-4 w-4" />
						Totales
					</h4>
					<div className="space-y-1 pl-6 text-xs">
						{/* If making payment, show what needs to be paid. If pending, show full value or 0? */}
						<div className="text-muted-foreground flex justify-between">
							<span>Valor Total Eventos:</span>
							<span className="font-medium">${totalEventsAmount.toLocaleString("es-CL")}</span>
						</div>

						{makePayment && (
							<div className="flex justify-between font-semibold">
								<span>
									Monto a Pagar (
									{formData.paymentStatus === "ENTRANCE_ONLY"
										? "Solo Entradas"
										: formData.paymentStatus === "TOUR_ONLY"
											? "Solo Tour"
											: "Total"}
									):
								</span>
								<span className="text-primary">${payableAmount.toLocaleString("es-CL")}</span>
							</div>
						)}

						{makePayment && (
							<div className="flex justify-between">
								<span>Pagado:</span>
								<span className="font-medium">${totalPayments.toLocaleString("es-CL")}</span>
							</div>
						)}
						{makePayment && (
							<div className="text-primary flex justify-between border-t pt-1 font-bold">
								<span>Diferencia:</span>
								<span
									className={
										totalPayments - payableAmount < 0 ? "text-destructive" : "text-green-600"
									}
								>
									${(totalPayments - payableAmount).toLocaleString("es-CL")}
								</span>
							</div>
						)}

						{!makePayment && (
							<div className="flex justify-between border-t pt-1 font-bold">
								<span>Total a Dejar Pendiente:</span>
								<span>${totalEventsAmount.toLocaleString("es-CL")}</span>
							</div>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
