"use client"

import { useState } from "react"
import {
	Calendar,
	Building2,
	Users,
	DollarSign,
	FileText,
	Package,
	CreditCard,
	AlertCircle,
	User,
	DownloadIcon,
	ChevronDownIcon,
	CircleDollarSignIcon,
	CircleSlashIcon,
} from "lucide-react"
import { es } from "date-fns/locale"
import { format } from "date-fns"
import { formatCalendarDay } from "@/shared/utils/calendar-day"

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Separator } from "@/shared/components/ui/separator"
import { Badge } from "@/shared/components/ui/badge"
import { Button } from "@/shared/components/ui/button"
import {
	Sheet,
	SheetTitle,
	SheetHeader,
	SheetContent,
	SheetDescription,
} from "@/shared/components/ui/sheet"
import {
	DropdownMenu,
	DropdownMenuSub,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuSubTrigger,
	DropdownMenuSubContent,
} from "@/shared/components/ui/dropdown-menu"

import { formatCurrency } from "@/shared/lib/format-currency"
import { getPaymentMethodLabel } from "@/shared/lib/payment-method-labels"
import { getEventDisplayName } from "@/project/events/utils/event-display"

import type { TransferWithDetails } from "../actions/transfer.actions"
import type { ReceptionWithDetails } from "@/project/receptions/actions/reception.actions"

type AgencyTransferData = TransferWithDetails | ReceptionWithDetails

interface AgencyTransferDetailSheetProps {
	data: AgencyTransferData
	variant: "transfer" | "reception"
	open: boolean
	onOpenChange: (open: boolean) => void
}

function isReception(data: AgencyTransferData): data is ReceptionWithDetails {
	return data.type === "INCOMING"
}

function calculateFinancials(data: AgencyTransferData) {
	const totalTourPrice = data.priceDetails.reduce((sum, p) => sum + p.tourPrice, 0)
	const totalEntrancePrice = data.priceDetails.reduce((sum, p) => sum + p.entrancePrice, 0)
	const totalPrice = totalTourPrice + totalEntrancePrice

	const totalPaid = data.payments.reduce((sum, payment) => {
		return payment.refund ? sum - payment.amount : sum + payment.amount
	}, 0)

	const pendingAmount = Math.max(0, totalPrice - totalPaid)

	return {
		totalTourPrice,
		totalEntrancePrice,
		totalPrice,
		totalPaid,
		pendingAmount,
	}
}

export function AgencyTransferDetailSheet({
	data,
	variant,
	open,
	onOpenChange,
}: AgencyTransferDetailSheetProps) {
	const financials = calculateFinancials(data)
	const isIncoming = variant === "reception"
	const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)

	const handleGeneratePDF = async (
		language: "es" | "en" | "pt" = "es",
		includePrice: boolean = true
	) => {
		setIsGeneratingPDF(true)
		try {
			const priceParam = includePrice ? "true" : "false"
			const response = await fetch(
				`/api/receptions/${data.id}/voucher?lang=${language}&includePrice=${priceParam}`,
				{ method: "GET" }
			)

			if (!response.ok) throw new Error("Error al generar el PDF")

			const blob = await response.blob()
			const url = window.URL.createObjectURL(blob)
			const a = document.createElement("a")
			a.href = url
			const languageSuffix = language !== "es" ? `-${language}` : ""
			const priceSuffix = !includePrice ? "-sin-precio" : ""
			a.download = `voucher-recepcion-${data.voucher}${languageSuffix}${priceSuffix}.pdf`
			document.body.appendChild(a)
			a.click()
			window.URL.revokeObjectURL(url)
			document.body.removeChild(a)
		} catch (error) {
			console.error("Error generando PDF:", error)
		} finally {
			setIsGeneratingPDF(false)
		}
	}

	const title = isIncoming ? "Detalles de la Recepcion" : "Detalles del Traspaso"
	const description = isIncoming
		? "Informacion completa de la recepcion"
		: `Informacion completa del traspaso #${data.voucher}`
	const eventsLabel = isIncoming ? "Eventos" : "Eventos Transferidos"
	const dateLabel = isIncoming ? "Fecha de Creacion" : "Fecha"
	const dateValue = isIncoming ? data.createdAt : data.date

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
				<SheetHeader className="shadow">
					<div className="flex items-start justify-between gap-2 pr-8">
						<div>
							<SheetTitle>{title}</SheetTitle>
							<SheetDescription>{description}</SheetDescription>
						</div>

						{isIncoming && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="outline" size="sm" disabled={isGeneratingPDF}>
										<DownloadIcon className="h-4 w-4" />
										{isGeneratingPDF ? "Generando..." : "Descargar PDF"}
										<ChevronDownIcon className="ml-1 h-3 w-3" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-56">
									<DropdownMenuSub>
										<DropdownMenuSubTrigger>
											<span className="flex items-center gap-2">
												<CircleDollarSignIcon />
												Con Precio
											</span>
										</DropdownMenuSubTrigger>
										<DropdownMenuSubContent>
											<DropdownMenuItem onClick={() => handleGeneratePDF("es", true)}>
												Español
											</DropdownMenuItem>
											<DropdownMenuItem onClick={() => handleGeneratePDF("en", true)}>
												English
											</DropdownMenuItem>
											<DropdownMenuItem onClick={() => handleGeneratePDF("pt", true)}>
												Portugues
											</DropdownMenuItem>
										</DropdownMenuSubContent>
									</DropdownMenuSub>

									<DropdownMenuSub>
										<DropdownMenuSubTrigger>
											<span className="flex items-center gap-2">
												<CircleSlashIcon /> Sin Precio
											</span>
										</DropdownMenuSubTrigger>
										<DropdownMenuSubContent>
											<DropdownMenuItem onClick={() => handleGeneratePDF("es", false)}>
												Español
											</DropdownMenuItem>
											<DropdownMenuItem onClick={() => handleGeneratePDF("en", false)}>
												English
											</DropdownMenuItem>
											<DropdownMenuItem onClick={() => handleGeneratePDF("pt", false)}>
												Portugues
											</DropdownMenuItem>
										</DropdownMenuSubContent>
									</DropdownMenuSub>
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</div>
				</SheetHeader>

				<div className="space-y-4 px-4 pb-12">
					{/* Informacion General */}
					<Card className="gap-1">
						<CardHeader>
							<CardTitle className="text-base">Informacion General</CardTitle>
						</CardHeader>

						<CardContent className="space-y-3">
							<div className="flex items-center gap-3">
								<Calendar className="text-muted-foreground h-4 w-4" />
								<div>
									<p className="text-sm font-medium">{dateLabel}</p>
									<p className="text-muted-foreground text-sm">
										{format(new Date(dateValue), "EEEE, dd 'de' MMMM 'de' yyyy", {
											locale: es,
										})}
									</p>
								</div>
							</div>

							{!isIncoming && (
								<div className="flex items-center gap-3">
									<Building2 className="text-muted-foreground h-4 w-4" />
									<div>
										<p className="text-sm font-medium">Agencia</p>
										<p className="text-muted-foreground text-sm">{data.agency.name}</p>
									</div>
								</div>
							)}

							{!isIncoming && (
								<div className="flex items-center gap-3">
									<FileText className="text-muted-foreground h-4 w-4" />
									<div>
										<p className="text-sm font-medium">Voucher</p>
										<p className="text-muted-foreground text-sm">#{data.voucher}</p>
									</div>
								</div>
							)}

							<div className="flex items-start gap-3">
								<DollarSign className="text-muted-foreground mt-0.5 h-4 w-4" />
								<div className="flex-1 space-y-2">
									<p className="text-sm font-medium">Estado de Pago</p>
									<Badge variant={data.paymentStatus === "FULLY_PAID" ? "default" : "secondary"}>
										{data.paymentStatus === "FULLY_PAID" ? "Completo" : "Pendiente"}
									</Badge>
									{data.paymentStatus !== "FULLY_PAID" && (
										<div className="bg-muted border-border rounded-md border p-2">
											<p className="mb-1 text-xs font-semibold text-yellow-600">
												Detalle de pago pendiente:
											</p>
											<div className="space-y-1 text-xs text-yellow-600">
												{data.paymentStatus === "ENTRANCE_ONLY" && <p>* Pago de tours pendiente</p>}
												{data.paymentStatus === "TOUR_ONLY" && <p>* Pago de entradas pendiente</p>}
												{data.paymentStatus === "PENDING" && (
													<>
														<p>* Pago de tours pendiente</p>
														<p>* Pago de entradas pendiente</p>
													</>
												)}
											</div>
										</div>
									)}
								</div>
							</div>

							{data.comments && (
								<div className="flex items-start gap-3">
									<FileText className="text-muted-foreground mt-0.5 h-4 w-4" />
									<div>
										<p className="text-sm font-medium">Comentarios</p>
										<p className="text-muted-foreground text-sm">{data.comments}</p>
									</div>
								</div>
							)}

							{data.createdByUser && (
								<div className="flex items-center gap-3">
									<User className="text-muted-foreground h-4 w-4" />
									<div>
										<p className="text-sm font-medium">Creado por</p>
										<p className="text-muted-foreground text-sm">{data.createdByUser.name}</p>
									</div>
								</div>
							)}
						</CardContent>
					</Card>

					{/* Eventos */}
					<Card className="gap-1">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-base">
								<Package className="h-4 w-4" />
								{eventsLabel} ({data.eventBookings.length})
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{data.eventBookings.map((event, index) => (
									<div key={event.id} className="bg-muted/50 rounded-lg p-3">
										<div className="mb-2 flex items-center justify-between">
											<p className="font-medium">
												{!isIncoming && `Evento ${index + 1}: `}
												{getEventDisplayName(event.event)}
											</p>
											<Badge variant="outline">
												{event.event.mode === "PRIVATE" ? "Privado" : "Regular"}
											</Badge>
										</div>
										<div className="text-muted-foreground space-y-1 text-sm">
											<div className="flex justify-between">
												<span>Fecha:</span>
												<span>{formatCalendarDay(event.event.date, "dd/MM/yyyy")}</span>
											</div>
											{/* Reception-specific event fields */}
											{isIncoming &&
												isReception(data) &&
												(() => {
													const receptionEvent = data.eventBookings.find((e) => e.id === event.id)
													if (!receptionEvent) return null
													return (
														<>
															{receptionEvent.event.startTime && (
																<div className="flex justify-between">
																	<span>Hora de Inicio:</span>
																	<span>{receptionEvent.event.startTime}</span>
																</div>
															)}
															{receptionEvent.event.endTime && (
																<div className="flex justify-between">
																	<span>Hora de Termino:</span>
																	<span>{receptionEvent.event.endTime}</span>
																</div>
															)}
															{receptionEvent.event.comments && (
																<div className="mt-2">
																	<span className="font-medium">Comentarios:</span>
																	<p className="mt-1">{receptionEvent.event.comments}</p>
																</div>
															)}
														</>
													)
												})()}
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>

					{/* Pasajeros */}
					<Card className="gap-1">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-base">
								<Users className="h-4 w-4" />
								Pasajeros ({data.passengers.length})
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-2">
								{data.passengers.map((passenger) => (
									<div
										key={passenger.id}
										className={`rounded-lg p-3 ${isIncoming ? "bg-muted/50" : "border"}`}
									>
										<div className="mb-1 flex items-center justify-between">
											<p className="font-medium">{passenger.name || "Sin nombre"}</p>
											{passenger.age && <Badge variant="outline">{passenger.age} años</Badge>}
										</div>
										<div
											className={`text-muted-foreground space-y-1 ${isIncoming ? "text-xs" : "grid grid-cols-2 gap-2 text-sm"}`}
										>
											{passenger.document && (
												<div className={isIncoming ? "flex justify-between" : ""}>
													<span className={isIncoming ? "" : "font-medium"}>
														{isIncoming ? "Documento:" : "Doc:"}
													</span>{" "}
													<span>{passenger.document}</span>
												</div>
											)}
											{passenger.nationality && (
												<div className={isIncoming ? "flex justify-between" : ""}>
													<span className={isIncoming ? "" : "font-medium"}>
														{isIncoming ? "Nacionalidad:" : "Pais:"}
													</span>{" "}
													<span>{passenger.nationality}</span>
												</div>
											)}
											{/* Reception-specific passenger fields */}
											{isIncoming &&
												isReception(data) &&
												(() => {
													const receptionPassenger = data.passengers.find(
														(p) => p.id === passenger.id
													)
													if (!receptionPassenger) return null
													return (
														<>
															{receptionPassenger.hotel && (
																<div className="flex justify-between">
																	<span>Hotel:</span>
																	<span>{receptionPassenger.hotel}</span>
																</div>
															)}
															{receptionPassenger.phone && (
																<div className="flex justify-between">
																	<span>Telefono:</span>
																	<span>{receptionPassenger.phone}</span>
																</div>
															)}
														</>
													)
												})()}
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>

					{/* Precios por Pasajero */}
					{data.priceDetails.length > 0 && (
						<Card className="gap-1">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-base">
									<DollarSign className="h-4 w-4" />
									Precios por Pasajero
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-3">
									{data.priceDetails.map((price) => (
										<div key={price.id} className="bg-muted/50 rounded-lg p-3">
											<div className="mb-2 flex items-center justify-between">
												<p className="font-medium">{price.passengerName}</p>
												<Badge variant="outline">
													{price.ageCategory === "adult"
														? "Adulto"
														: price.ageCategory === "child"
															? "Nino"
															: "Senior"}
												</Badge>
											</div>
											<div className="text-muted-foreground space-y-1 text-sm">
												<div className="flex justify-between">
													<span>Precio Tour:</span>
													<span className="font-medium">{formatCurrency(price.tourPrice)}</span>
												</div>
												{price.entrancePrice > 0 && (
													<div className="flex justify-between">
														<span>Precio Entrada:</span>
														<span className="font-medium">
															{formatCurrency(price.entrancePrice)}
														</span>
													</div>
												)}
												<Separator className="my-1" />
												<div className="flex justify-between font-medium">
													<span>Total:</span>
													<span>{formatCurrency(price.totalPrice)}</span>
												</div>
											</div>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}

					{/* Registros de Pago */}
					{data.payments.length > 0 && (
						<Card className="gap-1">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-base">
									<CreditCard className="h-4 w-4" />
									Registros de Pago ({data.payments.length})
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-3">
									{data.payments.map((payment) => (
										<div key={payment.id} className="bg-muted/50 rounded-lg p-3">
											<div className="mb-2 flex items-center justify-between">
												<div className="flex items-center gap-2">
													<p className="font-medium">{getPaymentMethodLabel(payment.method)}</p>
													{payment.refund && (
														<Badge variant="destructive" className="text-xs">
															Reembolso
														</Badge>
													)}
												</div>
												<span className="text-lg font-bold">
													{payment.refund ? "-" : ""}
													{formatCurrency(payment.amount)}
												</span>
											</div>
											<div className="text-muted-foreground space-y-1 text-sm">
												<div className="flex justify-between">
													<span>Fecha:</span>
													<span>
														{format(new Date(payment.date), "dd/MM/yyyy", { locale: es })}
													</span>
												</div>
												{payment.documentNumber && (
													<div className="flex justify-between">
														<span>N Documento:</span>
														<span>{payment.documentNumber}</span>
													</div>
												)}
												{payment.comments && (
													<div className="mt-2">
														<span className="font-medium">Comentarios:</span>
														<p className="mt-1">{payment.comments}</p>
													</div>
												)}
											</div>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}

					{/* Resumen Financiero */}
					<Card className="gap-1">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-base">
								<DollarSign className="h-4 w-4" />
								Resumen Financiero
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								<div className="space-y-2">
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Total Tours:</span>
										<span className="font-medium">{formatCurrency(financials.totalTourPrice)}</span>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Total Entradas:</span>
										<span className="font-medium">
											{formatCurrency(financials.totalEntrancePrice)}
										</span>
									</div>
									<Separator />
									<div className="flex justify-between">
										<span className="font-medium">Monto Total:</span>
										<span className="text-lg font-bold">
											{formatCurrency(financials.totalPrice)}
										</span>
									</div>
								</div>

								<Separator />

								<div className="space-y-2">
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Total Pagado:</span>
										<span className="font-medium text-green-600">
											{formatCurrency(financials.totalPaid)}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="font-medium">Monto Pendiente:</span>
										<span
											className={`text-lg font-bold ${financials.pendingAmount > 0 ? "text-yellow-600" : "text-green-600"}`}
										>
											{formatCurrency(financials.pendingAmount)}
										</span>
									</div>
								</div>

								{financials.pendingAmount > 0 && (
									<div className="border-border bg-muted mt-3 rounded-md border p-3">
										<div className="flex items-start gap-2">
											<AlertCircle className="mt-0.5 h-4 w-4 text-yellow-600" />
											<div className="text-sm text-yellow-600">
												<p className="font-medium">Pago pendiente</p>
												<p className="mt-1">
													{data.paymentStatus === "TOUR_ONLY"
														? "Falta pagar las entradas"
														: data.paymentStatus === "ENTRANCE_ONLY"
															? "Falta pagar los tours"
															: data.paymentStatus === "PENDING"
																? "Falta pagar tours y entradas"
																: null}
												</p>
											</div>
										</div>
									</div>
								)}
							</div>
						</CardContent>
					</Card>

					{/* Resumen General */}
					<Card className="gap-1">
						<CardHeader>
							<CardTitle className="text-base">Resumen General</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-3 gap-4 text-center">
								<div>
									<p className="text-2xl font-bold">{data.passengers.length}</p>
									<p className="text-muted-foreground text-xs">Pasajeros</p>
								</div>
								<div>
									<p className="text-2xl font-bold">{data.eventBookings.length}</p>
									<p className="text-muted-foreground text-xs">Eventos</p>
								</div>
								<div>
									<p className="text-2xl font-bold">{data.payments.length}</p>
									<p className="text-muted-foreground text-xs">Pagos</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</SheetContent>
		</Sheet>
	)
}
