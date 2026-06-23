"use client"

import { Calendar, Users, CreditCard, Building2, FileText, Info } from "lucide-react"
import { es } from "date-fns/locale"
import { format } from "date-fns"

import {
	calculateSaleTotals,
	getPaymentAmountInClp,
	calculateUsdSuggestion,
	type NegotiatedTourPricing,
} from "../utils/sale-calculations"

import {
	Accordion,
	AccordionItem,
	AccordionTrigger,
	AccordionContent,
} from "@/shared/components/ui/accordion"
import { Separator } from "@/shared/components/ui/separator"
import { Badge } from "@/shared/components/ui/badge"
import {
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	CardDescription,
} from "@/shared/components/ui/card"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/shared/components/ui/tooltip"

import type { ActiveTour } from "@/project/tours/hooks/use-tours"
import type { SaleRecord } from "../schemas/sale-record.schema"
import { CHANNEL_LABELS } from "../constants/enums"
import type { ChannelTypeValue } from "../constants/enums"

interface FormSummaryCardProps {
	formData: Partial<SaleRecord>
	agencyName?: string
	wholesaleAgencyName?: string
	availableTours?: ActiveTour[]
	selectedAgencyTourPricing?: NegotiatedTourPricing[]
	/** Voucher number to display: the real one in edit mode, the projected one in create mode. */
	voucherNumber?: number
	/** When true the number is a create-mode estimate and may change at save time. */
	isProjectedVoucher?: boolean
}

export function SaleSummaryCard({
	formData,
	agencyName,
	wholesaleAgencyName,
	availableTours = [],
	selectedAgencyTourPricing = [],
	voucherNumber,
	isProjectedVoucher = false,
}: FormSummaryCardProps) {
	const numPasajeros = formData.passengerArray?.length || 0
	const numPagos = formData.paymentArray?.length || 0
	const {
		totalPagos,
		totalBaseTours,
		totalEntranceFees,
		wholesaleMarkup,
		wholesaleMarkupAmount,
		subtotalTours,
		totalTours,
		diferencia,
		paymentTolerance,
		isDifferenceWithinTolerance,
		tourPrices,
	} = calculateSaleTotals(formData, availableTours, selectedAgencyTourPricing)

	const descuentoGlobal = formData.discount || 0
	const selectedTourIds = new Set((formData.eventBookings || []).map((event) => event.tourId))
	const hasNegotiatedPricing = selectedAgencyTourPricing.some((pricing) =>
		selectedTourIds.has(pricing.tourId)
	)
	const differenceAbs = Math.abs(diferencia)
	const usdRateForSuggestion =
		[...(formData.paymentArray || [])]
			.reverse()
			.find((payment) => payment.currency === "USD" && Number(payment.exchange_rate || 0) > 0)
			?.exchange_rate || null
	const usdSuggestionForTotal =
		usdRateForSuggestion && totalTours > 0
			? calculateUsdSuggestion(totalTours, Number(usdRateForSuggestion))
			: null
	const usdSuggestionForPending =
		usdRateForSuggestion && diferencia < 0
			? calculateUsdSuggestion(differenceAbs, Number(usdRateForSuggestion))
			: null
	const formatUsdIntegerRange = (minUsd: number, maxUsd: number) =>
		minUsd === maxUsd ? `${minUsd} USD` : `${minUsd} o ${maxUsd} USD`

	const showWholesale = formData.channel === "WHOLESALE"
	const showOnlineWholesale = formData.channel === "ONLINE" && formData.isWholesale

	const allSections = [
		"summary-general",
		...(showWholesale ? ["summary-wholesale"] : []),
		...(showOnlineWholesale ? ["summary-online-wholesale"] : []),
		"summary-events",
		"summary-passengers",
		"summary-payments",
	]

	return (
		<Card className="border-primary/20 sticky top-0 max-h-fit min-w-[400px] gap-2 bg-neutral-100 p-2 dark:bg-neutral-900">
			<CardHeader className="gap-0 p-2 pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="text-lg">Resumen</CardTitle>
					{formData.type && (
						<Badge variant={formData.type === "SALE" ? "default" : "secondary"}>
							{formData.type === "SALE" ? "Venta" : "Cotización"}
						</Badge>
					)}
				</div>
				<CardDescription>Vista detallada de la información</CardDescription>
				{voucherNumber != null && (
					<div className="mt-1.5 flex items-center gap-1.5 text-sm">
						<span className="text-muted-foreground">Voucher:</span>
						<span className="text-foreground font-semibold">N° {voucherNumber}</span>
						{isProjectedVoucher && (
							<>
								<Badge variant="outline" className="px-1.5 py-0 text-[10px] font-medium">
									estimado
								</Badge>
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<button
												type="button"
												aria-label="Por qué el número de voucher puede cambiar"
												className="text-muted-foreground hover:text-foreground transition-colors"
											>
												<Info className="h-3.5 w-3.5" />
											</button>
										</TooltipTrigger>
										<TooltipContent className="max-w-[260px]">
											Número estimado. El definitivo se asigna al guardar y puede variar si se
											registran otras ventas o cotizaciones antes que esta.
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							</>
						)}
					</div>
				)}
			</CardHeader>

			<CardContent className="space-y-2 p-2 text-sm">
				<Accordion type="multiple" defaultValue={allSections}>
					<AccordionItem value="summary-general">
						<AccordionTrigger>
							<h4 className="text-primary flex items-center gap-2 font-semibold">
								<FileText className="h-4 w-4" />
								Información General
							</h4>
						</AccordionTrigger>
						<AccordionContent className="h-fit [&_p:not(:last-child)]:mb-1">
							<div className="space-y-1 pl-6">
								{formData.type ? (
									<p className="text-muted-foreground">
										<span className="text-foreground font-medium">Tipo:</span>{" "}
										{formData.type === "SALE" ? "Venta" : "Cotización"}
									</p>
								) : (
									<p className="text-muted-foreground italic">Sin tipo seleccionado</p>
								)}

								{formData.channel ? (
									<p className="text-muted-foreground">
										<span className="text-foreground font-medium">Canal:</span>{" "}
										{CHANNEL_LABELS[formData.channel as ChannelTypeValue] ?? formData.channel}
									</p>
								) : (
									<p className="text-muted-foreground italic">Sin canal seleccionado</p>
								)}
							</div>
						</AccordionContent>
					</AccordionItem>

					{showWholesale && (
						<AccordionItem value="summary-wholesale">
							<AccordionTrigger>
								<h4 className="text-foreground flex items-center gap-2 text-sm font-semibold">
									<Building2 className="h-4 w-4" />
									Mayorista
								</h4>
							</AccordionTrigger>
							<AccordionContent className="h-fit [&_p:not(:last-child)]:mb-1">
								<div className="space-y-1 pl-6">
									{agencyName ? (
										<p className="text-muted-foreground">
											<span className="text-foreground font-medium">{agencyName}</span>
										</p>
									) : (
										<p className="text-muted-foreground italic">Sin mayorista seleccionado</p>
									)}
								</div>
							</AccordionContent>
						</AccordionItem>
					)}

					{showOnlineWholesale && (
						<AccordionItem value="summary-online-wholesale">
							<AccordionTrigger>
								<h4 className="text-foreground flex items-center gap-2 text-sm font-semibold">
									<Building2 className="h-4 w-4 text-purple-600" />
									Agencia Mayorista
								</h4>
							</AccordionTrigger>
							<AccordionContent className="h-fit [&_p:not(:last-child)]:mb-1">
								<div className="space-y-1 pl-6">
									{wholesaleAgencyName ? (
										<p className="text-muted-foreground">
											<span className="text-foreground font-medium">{wholesaleAgencyName}</span>
											<Badge variant="outline" className="ml-2 bg-purple-50 text-purple-700">
												{hasNegotiatedPricing
													? "Tarifa negociada"
													: `Recargo ${formData.wholesaleMarkup || 30}%`}
											</Badge>
										</p>
									) : (
										<p className="text-muted-foreground italic">
											Sin agencia mayorista seleccionada
										</p>
									)}
								</div>
							</AccordionContent>
						</AccordionItem>
					)}

					<AccordionItem value="summary-events">
						<AccordionTrigger>
							<h4 className="text-primary flex items-center gap-2 font-semibold">
								<Calendar className="h-4 w-4" />
								Evento/Tour{" "}
								<span className="text-muted-foreground">
									({formData.eventBookings?.length || 0})
								</span>
							</h4>
						</AccordionTrigger>
						<AccordionContent className="h-fit [&_p:not(:last-child)]:mb-1">
							<div className="space-y-1 pl-6">
								{formData.eventBookings &&
								formData.eventBookings.length > 0 &&
								formData.eventBookings[0].mode ? (
									<>
										{formData.eventBookings.map((event, index) => {
											const selectedTour = availableTours.find((t) => t.id === event.tourId)
											const eventPrice = tourPrices[index]

											return (
												<div
													key={event.clientId || index}
													className="text-muted-foreground mt-1 space-y-0.5 text-xs"
												>
													<p className="font-semibold">
														Tour #{index + 1} {selectedTour && `- ${selectedTour.name}`}
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
													{event.flyDate && event.flyTime && (
														<p>
															Fecha vuelo: {format(event.flyDate, "dd MMM yyyy", { locale: es })}
														</p>
													)}
													{event.flyTime && <p>Hora vuelo: {event.flyTime}</p>}
													{event.priceEntries && event.priceEntries.length > 0 && (
														<div className="mt-1 space-y-0.5">
															{event.priceEntries
																.filter((pe) => pe.count > 0)
																.map((pe) => (
																	<p
																		key={pe.priceCategoryId}
																		className="font-medium text-orange-600"
																	>
																		{pe.count > 1
																			? `${pe.categoryName}: ${pe.count} × $${pe.price.toLocaleString("es-CL")}`
																			: `${pe.categoryName}: $${pe.price.toLocaleString("es-CL")}`}
																	</p>
																))}
														</div>
													)}
													{event.entrySnapshots && event.entrySnapshots.length > 0 && (
														<div className="mt-1 space-y-0.5">
															{event.entrySnapshots
																.filter((snap: any) => snap.count > 0)
																.map((snap: any, snapIdx: number) => (
																	<p
																		key={snap.tourEntryId || snapIdx}
																		className="font-medium text-blue-600"
																	>
																		{snap.count > 1
																			? `${snap.entryName} (${snap.variantName}): ${snap.count} × $${snap.price.toLocaleString("es-CL")}`
																			: `${snap.entryName} (${snap.variantName}): $${snap.price.toLocaleString("es-CL")}`}
																	</p>
																))}
														</div>
													)}
												</div>
											)
										})}
										{subtotalTours > 0 && (
											<div className="text-muted-foreground mt-2 space-y-0.5 border-t pt-2 text-xs">
												{totalBaseTours > 0 && totalEntranceFees > 0 && (
													<p>
														Tours: <span className="font-medium text-orange-600">${totalBaseTours.toLocaleString("es-CL")}</span>
													</p>
												)}
												{wholesaleMarkup > 0 && (
													<p>
														Recargo {wholesaleMarkup}%: <span className="font-medium text-purple-600">+${wholesaleMarkupAmount.toLocaleString("es-CL")}</span>
													</p>
												)}
												{totalEntranceFees > 0 && (
													<p>
														Entradas: <span className="font-medium text-blue-600">${totalEntranceFees.toLocaleString("es-CL")}</span>
													</p>
												)}
												{+descuentoGlobal > 0 && (
													<p>
														Descuento: <span className="font-medium text-green-600">-{descuentoGlobal}%</span>
													</p>
												)}
												<p className="pt-1 text-sm">
													Total: <span className="font-bold text-orange-600">${totalTours.toLocaleString("es-CL")}</span>
												</p>
											</div>
										)}
									</>
								) : (
									<p className="text-muted-foreground italic">Sin información de evento</p>
								)}
							</div>
						</AccordionContent>
					</AccordionItem>

					<AccordionItem value="summary-passengers">
						<AccordionTrigger>
							<h4 className="text-primary flex items-center gap-2 font-semibold">
								<Users className="h-4 w-4" />
								Pasajeros <span className="text-muted-foreground">({numPasajeros})</span>
							</h4>
						</AccordionTrigger>
						<AccordionContent className="h-fit [&_p:not(:last-child)]:mb-1">
							<div className="pl-6">
								{numPasajeros > 0 ? (
									<div className="space-y-1">
										<div className="space-y-1">
											{formData.passengerArray?.map((passenger, index) => (
												<div
													key={passenger.clientId || index}
													className="text-muted-foreground space-y-0.5 text-xs"
												>
													<p className="font-medium">
														• {passenger.name || `Pasajero ${index + 1}`}
														{passenger.age !== 0 && !isNaN(passenger.age || NaN) && (
															<span className="text-muted-foreground/70">
																{" "}
																({passenger.age} años)
															</span>
														)}
													</p>
													{passenger.allergies && passenger.allergies.length > 0 && (
														<p className="pl-3 text-[11px] text-amber-600">
															Alergias: {passenger.allergies.join(", ")}
														</p>
													)}
												</div>
											))}
										</div>
									</div>
								) : (
									<p className="text-muted-foreground italic">Sin pasajeros registrados</p>
								)}
							</div>
						</AccordionContent>
					</AccordionItem>

					<AccordionItem value="summary-payments">
						<AccordionTrigger>
							<h4 className="text-primary flex items-center gap-2 font-semibold">
								<CreditCard className="h-4 w-4" />
								Pagos <span className="text-muted-foreground">({numPagos})</span>
							</h4>
						</AccordionTrigger>
						<AccordionContent className="h-fit [&_p:not(:last-child)]:mb-1">
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
											{totalTours > 0 && (
												<>
													<hr className="border-primary/20 my-2" />
													<p
														className={`text-xs ${
															isDifferenceWithinTolerance
																? "text-green-600"
																: diferencia > 0
																	? "text-blue-600"
																	: "text-red-600"
														}`}
													>
														{isDifferenceWithinTolerance
															? differenceAbs === 0
																? "✓ Pagos coinciden con total"
																: `✓ Dentro de rango permitido por redondeo USD (dif: $${differenceAbs.toLocaleString("es-CL")}, tol: $${paymentTolerance.toLocaleString("es-CL")})`
															: diferencia > 0
																? `Excedente: $${diferencia.toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
																: `Faltante: $${Math.abs(diferencia).toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
													</p>
													{usdRateForSuggestion && usdSuggestionForTotal && (
														<div className="mt-2 rounded border border-amber-500/20 bg-amber-500/5 p-2 text-xs">
															<p className="font-medium text-amber-700">
																Referencia USD con TC $
																{Number(usdRateForSuggestion).toLocaleString("es-CL", {
																	minimumFractionDigits: 0,
																	maximumFractionDigits: 2,
																})}
															</p>
															<p className="text-muted-foreground">
																Total venta en USD (exacto):{" "}
																{usdSuggestionForTotal.exactUsd.toLocaleString("en-US", {
																	minimumFractionDigits: 2,
																	maximumFractionDigits: 4,
																})}
															</p>
															<p className="text-muted-foreground">
																Sin decimales:{" "}
																{formatUsdIntegerRange(
																	usdSuggestionForTotal.minUsd,
																	usdSuggestionForTotal.maxUsd
																)}
															</p>
															{usdSuggestionForPending && (
																<p className="text-muted-foreground">
																	Para cubrir faltante actual:{" "}
																	{formatUsdIntegerRange(
																		usdSuggestionForPending.minUsd,
																		usdSuggestionForPending.maxUsd
																	)}
																</p>
															)}
														</div>
													)}
												</>
											)}
										</div>
										<div className="space-y-0.5">
											{formData.paymentArray?.map((payment, index) => {
												const amount = payment.amount || 0
												const amountInClp = getPaymentAmountInClp(payment)
												const methodMap: Record<string, string> = {
													CASH: "Efectivo",
													TRANSFER: "Transferencia",
													CREDIT_CARD: "Tarjeta de Credito",
													DEBIT_CARD: "Tarjeta de Debito",
													PAYMENT_LINK_DEBIT: "Link de pago Debito",
													PAYMENT_LINK_CREDIT: "Link de pago Credito",
													// Compatibilidad historica
													CARD: "Tarjeta",
													PAYMENT_LINK: "Link de pago",
												}
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
														{methodMap[payment.method] || "Sin medio"}:{" "}
														{payment.currency === "USD"
															? `USD ${amount.toLocaleString("es-CL", {
																	minimumFractionDigits: 2,
																	maximumFractionDigits: 2,
																})} (CLP $${amountInClp.toLocaleString("es-CL", {
																	minimumFractionDigits: 0,
																	maximumFractionDigits: 0,
																})})`
															: `$${amount.toLocaleString("es-CL", {
																	minimumFractionDigits: 0,
																	maximumFractionDigits: 0,
																})}`}
													</p>
												)
											})}
										</div>
									</div>
								) : (
									<p className="text-muted-foreground italic">Sin pagos registrados</p>
								)}
							</div>
						</AccordionContent>
					</AccordionItem>
				</Accordion>
			</CardContent>
		</Card>
	)
}
