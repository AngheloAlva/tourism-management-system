"use client"

import { es } from "date-fns/locale"
import { format } from "date-fns"
import { formatCalendarDay } from "@/shared/utils/calendar-day"
import { useState, useTransition, useEffect } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
	DownloadIcon,
	ArrowRightIcon,
	DollarSignIcon,
	CircleSlashIcon,
	ChevronDownIcon,
	CircleDollarSignIcon,
	InfoIcon,
	CalendarIcon,
	UsersIcon,
	CreditCardIcon,
	MessageSquareIcon,
	BuildingIcon,
	PencilIcon,
	HistoryIcon,
	Trash2Icon,
	BanIcon,
	PhoneIcon,
	MailIcon,
	HotelIcon,
	UtensilsIcon,
	AlertTriangleIcon,
	UserXIcon,
	CalendarClockIcon,
	UserIcon,
	UserCheckIcon,
} from "lucide-react"

import { formatCurrency } from "@/shared/lib/format-currency"
import { getPaymentMethodLabel } from "@/shared/lib/payment-method-labels"
import { channelTypeLabels } from "../utils/channel-type-labels"
import { calculateBookingRevenue } from "../utils/booking-revenue"
import type { VoucherPassengerFilter } from "../utils/voucher-passengers"
import { getEventDisplayName } from "@/project/events/utils/event-display"

import { Card, CardContent } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import { ScrollArea } from "@/shared/components/ui/scroll-area"
import { Separator } from "@/shared/components/ui/separator"
import { Switch } from "@/shared/components/ui/switch"
import { Input } from "@/shared/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert"
import {
	Accordion,
	AccordionItem,
	AccordionTrigger,
	AccordionContent,
} from "@/shared/components/ui/accordion"

import {
	updateBookingPassengerExclusions,
	type SaleRecordWithDetails,
} from "../actions/sale-record.actions"
import {
	updateSaleFileInfo,
	updateSaleAgency,
	updateSaleComments,
	updateSaleFlags,
} from "../actions/inline-edit"
import { getActiveAgencies } from "@/project/agency/actions/get-active-agencies"
import { InlineEditableText, InlineEditableSwitch, InlineEditableAgency } from "./inline-edit"
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
	DropdownMenuLabel,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuSeparator,
	DropdownMenuSubTrigger,
	DropdownMenuSubContent,
} from "@/shared/components/ui/dropdown-menu"

const DIET_LABELS: Record<string, string> = {
	NORMAL: "Normal",
	VEGETARIAN: "Vegetariano",
	VEGAN: "Vegano",
	CELIAC: "Celiaco",
	OTHER: "Otro",
}

interface SaleDetailSheetProps {
	sale: SaleRecordWithDetails | null
	open: boolean
	onOpenChange: (open: boolean) => void
	onViewAudit?: (sale: SaleRecordWithDetails) => void
	onDelete?: (sale: SaleRecordWithDetails) => void
	onCancel?: (sale: SaleRecordWithDetails) => void
	onRefresh?: () => void
}

interface ExclusionState {
	excluded: boolean
	excludeReason: string
}

export function SaleDetailSheet({
	sale,
	open,
	onOpenChange,
	onViewAudit,
	onDelete,
	onCancel,
	onRefresh,
}: SaleDetailSheetProps) {
	const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
	const [isPending, startTransition] = useTransition()
	const [exclusionEdits, setExclusionEdits] = useState<Record<string, ExclusionState>>({})
	// Agencies for the inline agency combobox — fetched lazily when sheet opens
	const [agencies, setAgencies] = useState<Array<{ id: string; name: string }>>([])

	useEffect(() => {
		if (!open) return
		getActiveAgencies()
			.then((result) => setAgencies(result.map((a) => ({ id: a.id, name: a.name }))))
			.catch(() => {
				// Non-critical: combobox will show empty list; user can still view the sheet
			})
	}, [open])

	if (!sale) return null

	const hasExclusionUI = sale.passengers.length >= 2 && sale.eventBookings.length >= 2

	const getExclusionKey = (eventBookingId: string, passengerId: string) =>
		`${eventBookingId}::${passengerId}`

	const getExclusionState = (
		eventBookingId: string,
		passengerId: string,
		bookingPassengers: SaleRecordWithDetails["eventBookings"][number]["bookingPassengers"]
	): ExclusionState => {
		const key = getExclusionKey(eventBookingId, passengerId)
		if (exclusionEdits[key]) return exclusionEdits[key]
		const bp = bookingPassengers.find((b) => b.passengerId === passengerId)
		return {
			excluded: bp?.excluded ?? false,
			excludeReason: bp?.excludeReason ?? "",
		}
	}

	const handleExclusionToggle = (
		eventBookingId: string,
		passengerId: string,
		excluded: boolean,
		bookingPassengers: SaleRecordWithDetails["eventBookings"][number]["bookingPassengers"]
	) => {
		const key = getExclusionKey(eventBookingId, passengerId)
		const current = getExclusionState(eventBookingId, passengerId, bookingPassengers)
		setExclusionEdits((prev) => ({
			...prev,
			[key]: { ...current, excluded },
		}))

		startTransition(async () => {
			const result = await updateBookingPassengerExclusions({
				saleRecordId: sale.id,
				exclusions: [
					{
						eventBookingId,
						passengerId,
						excluded,
						excludeReason: excluded ? current.excludeReason || undefined : undefined,
					},
				],
			})

			if (result.success) {
				toast.success(excluded ? "Pasajero excluido" : "Pasajero incluido")
				onRefresh?.()
			} else {
				setExclusionEdits((prev) => {
					const next = { ...prev }
					delete next[key]
					return next
				})
				toast.error(result.error ?? "Error al actualizar exclusion")
			}
		})
	}

	const handleExclusionReasonSave = (
		eventBookingId: string,
		passengerId: string,
		reason: string
	) => {
		const key = getExclusionKey(eventBookingId, passengerId)
		setExclusionEdits((prev) => ({
			...prev,
			[key]: { excluded: true, excludeReason: reason },
		}))

		startTransition(async () => {
			const result = await updateBookingPassengerExclusions({
				saleRecordId: sale.id,
				exclusions: [
					{
						eventBookingId,
						passengerId,
						excluded: true,
						excludeReason: reason || undefined,
					},
				],
			})

			if (result.success) {
				toast.success("Razon de exclusion guardada")
				onRefresh?.()
			} else {
				toast.error(result.error ?? "Error al guardar razon")
			}
		})
	}

	// ─── Inline-edit handlers ────────────────────────────────────────────────

	const handleFileNumberSave = async (next: string | null) => {
		const result = await updateSaleFileInfo({ saleRecordId: sale.id, fileNumber: next })
		if (result.success) {
			toast.success("N° de file actualizado")
			onRefresh?.()
		} else {
			toast.error(result.error ?? "Error al actualizar el número de file")
		}
		return result
	}

	const handleAgencySave = async (agencyId: string | null, expectedUpdatedAt: Date) => {
		const result = await updateSaleAgency({
			saleRecordId: sale.id,
			agencyId,
			expectedUpdatedAt,
		})
		if (result.success) {
			toast.success("Agencia actualizada")
			onRefresh?.()
		} else {
			if (result.code === "STALE") {
				toast.error("La venta fue modificada por otra persona, recargá la vista")
			} else {
				toast.error(result.error ?? "Error al actualizar la agencia")
			}
		}
		return result
	}

	const handleCommentsSave = async (next: string | null) => {
		const result = await updateSaleComments({ saleRecordId: sale.id, comments: next })
		if (result.success) {
			toast.success("Comentarios actualizados")
			onRefresh?.()
		} else {
			toast.error(result.error ?? "Error al actualizar los comentarios")
		}
		return result
	}

	const handleContactedSave = async (next: boolean) => {
		const result = await updateSaleFlags({ saleRecordId: sale.id, contacted: next })
		if (result.success) {
			toast.success(next ? "Marcado como contactado" : "Marcado como no contactado")
			onRefresh?.()
		} else {
			toast.error(result.error ?? "Error al actualizar el estado de contacto")
		}
		return result
	}

	const isEditDisabled = sale.status === "CANCELLED"

	// ─────────────────────────────────────────────────────────────────────────

	const getActivePassengerCount = (booking: SaleRecordWithDetails["eventBookings"][number]) => {
		let count = 0
		for (const passenger of sale.passengers) {
			const state = getExclusionState(booking.id, passenger.id, booking.bookingPassengers)
			if (!state.excluded) count++
		}
		return count
	}

	const getExcludedToursForPassenger = (passengerId: string) => {
		const excludedTours: Array<{ tourName: string; reason: string | null }> = []
		for (const booking of sale.eventBookings) {
			const state = getExclusionState(booking.id, passengerId, booking.bookingPassengers)
			if (state.excluded) {
				excludedTours.push({
					tourName: getEventDisplayName(booking.event),
					reason: state.excludeReason || null,
				})
			}
		}
		return excludedTours
	}

	const handleGeneratePDF = async (
		language: "es" | "en" | "pt" = "es",
		includePrice: boolean = true,
		passengerFilter: VoucherPassengerFilter = "all"
	) => {
		setIsGeneratingPDF(true)

		try {
			const params = new URLSearchParams({
				lang: language,
				includePrice: includePrice ? "true" : "false",
				passengers: passengerFilter,
			})
			const response = await fetch(`/api/sales/${sale.id}/voucher?${params}`, {
				method: "GET",
			})

			if (!response.ok) throw new Error("Error al generar el PDF")

			const blob = await response.blob()
			const url = window.URL.createObjectURL(blob)
			const a = document.createElement("a")
			a.href = url
			const languageSuffix = language !== "es" ? `-${language}` : ""
			const priceSuffix = !includePrice ? "-sin-precio" : ""
			const passengerSuffix =
				passengerFilter === "with-data"
					? "-con-datos"
					: passengerFilter === "first"
						? "-encargado"
						: ""
			a.download = `voucher-${sale.voucher}${languageSuffix}${priceSuffix}${passengerSuffix}.pdf`
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

	const paymentTotal = sale.paymentRecords.reduce((acc, payment) => {
		return payment.refund ? acc - payment.amount : acc + payment.amount
	}, 0)

	const saleTotal = sale.eventBookings.reduce((acc, booking) => {
		const revenue = calculateBookingRevenue(
			booking.priceEntries || [],
			booking.entrySnapshots || []
		)
		return acc + revenue.grandTotal
	}, 0)

	const saleTotalWithDiscount = saleTotal - sale.discount

	const isQuote = sale.type === "QUOTE"

	const editHref =
		sale.type === "SALE"
			? `/dashboard/registro-de-ventas/${sale.id}`
			: `/dashboard/navegacion-cotizacion/${sale.id}`

	const passengerFilterOptions: Array<{
		value: VoucherPassengerFilter
		label: string
		icon: typeof UsersIcon
	}> = [
		{ value: "first", label: "Solo encargado", icon: UserIcon },
		{ value: "with-data", label: "Solo con datos", icon: UserCheckIcon },
	]

	// One submenu level (passenger filter → language) reused for both price modes.
	const renderVoucherSubmenu = (includePrice: boolean) =>
		passengerFilterOptions.map(({ value, label, icon: Icon }) => (
			<DropdownMenuSub key={value}>
				<DropdownMenuSubTrigger>
					<span className="flex items-center gap-2">
						<Icon />
						{label}
					</span>
				</DropdownMenuSubTrigger>
				<DropdownMenuSubContent>
					<DropdownMenuItem onClick={() => handleGeneratePDF("es", includePrice, value)}>
						Español
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => handleGeneratePDF("en", includePrice, value)}>
						English
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => handleGeneratePDF("pt", includePrice, value)}>
						Portugues
					</DropdownMenuItem>
				</DropdownMenuSubContent>
			</DropdownMenuSub>
		))

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full gap-2 sm:max-w-xl">
				<SheetHeader className="pr-12">
					<div className="flex items-start justify-between">
						<div>
							<SheetTitle className="text-2xl">
								{isQuote ? "Cotizacion" : "Venta"} #{sale.voucher}
							</SheetTitle>
							<SheetDescription>
								Creado el{" "}
								{format(new Date(sale.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: es })}
							</SheetDescription>
						</div>

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="sm" disabled={isGeneratingPDF}>
									<DownloadIcon className="h-4 w-4" />
									{isGeneratingPDF ? "Generando..." : "Descargar PDF"}
									<ChevronDownIcon className="ml-1 h-3 w-3" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-56">
								<DropdownMenuLabel className="text-muted-foreground flex items-center gap-2">
									<CircleDollarSignIcon className="h-4 w-4" />
									Con Precio
								</DropdownMenuLabel>
								{renderVoucherSubmenu(true)}

								<DropdownMenuSeparator />

								<DropdownMenuLabel className="text-muted-foreground flex items-center gap-2">
									<CircleSlashIcon className="h-4 w-4" />
									Sin Precio
								</DropdownMenuLabel>
								{renderVoucherSubmenu(false)}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					{/* Action buttons */}
					<div className="flex flex-wrap gap-2 pt-2">
						<Button variant="outline" size="sm" asChild>
							<Link href={editHref}>
								<PencilIcon className="h-4 w-4" />
								Editar
							</Link>
						</Button>

						{isQuote && !sale.convertedToSale && (
							<Button size="sm" asChild>
								<Link href={`/dashboard/convertir-cotizacion/${sale.id}`}>
									<ArrowRightIcon className="h-4 w-4" />
									Convertir a Venta
								</Link>
							</Button>
						)}

						{onViewAudit && (
							<Button variant="outline" size="sm" onClick={() => onViewAudit(sale)}>
								<HistoryIcon className="h-4 w-4" />
								Ver Historial
							</Button>
						)}

						{onCancel && sale.status !== "CANCELLED" && (
							<Button
								variant="outline"
								size="sm"
								className="border-amber-300 text-amber-700 hover:bg-amber-50"
								onClick={() => onCancel(sale)}
							>
								<BanIcon className="h-4 w-4" />
								Anular
							</Button>
						)}

						{onDelete && sale.status !== "CANCELLED" && (
							<Button variant="destructive" size="sm" onClick={() => onDelete(sale)}>
								<Trash2Icon className="h-4 w-4" />
								Eliminar
							</Button>
						)}
					</div>
				</SheetHeader>

				<ScrollArea className="h-[calc(100vh-8rem)]">
					<div className="space-y-4 px-4 pb-12">
						{/* Voucher desactualizado banner */}
						{sale.voucherOutdatedAt != null && (
							<Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
								<CalendarClockIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
								<AlertTitle>Voucher desactualizado</AlertTitle>
								<AlertDescription>
									{`Voucher desactualizado — horario cambió el ${format(sale.voucherOutdatedAt, "dd/MM/yyyy HH:mm", { locale: es })}`}
								</AlertDescription>
							</Alert>
						)}

						<Accordion
							type="multiple"
							defaultValue={["info-general", "passengers"]}
							className="w-full space-y-2"
						>
							{/* Informacion General */}
							<AccordionItem value="info-general" className="rounded-lg border px-3">
								<AccordionTrigger className="hover:no-underline">
									<span className="flex items-center gap-2 text-base font-semibold">
										<InfoIcon className="h-4 w-4" />
										Información General
									</span>
								</AccordionTrigger>
								<AccordionContent className="space-y-2 pb-3">
									<div className="flex justify-between">
										<span className="text-muted-foreground">Tipo:</span>
										<Badge variant={isQuote ? "secondary" : "default"}>
											{isQuote ? "Cotizacion" : "Venta"}
										</Badge>
									</div>
									<div className="flex justify-between">
										<span className="text-muted-foreground">Canal:</span>
										<span className="font-medium">{channelTypeLabels[sale.channel]}</span>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-muted-foreground shrink-0">N° File:</span>
										<div className="ml-2 min-w-0 flex-1 text-right">
											<InlineEditableText
												value={sale.fileNumber}
												onSave={handleFileNumberSave}
												placeholder="PENDIENTE"
												label="N° de file"
												disabled={isEditDisabled}
												className="justify-end text-right font-medium"
											/>
										</div>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-muted-foreground shrink-0">Agencia:</span>
										<div className="ml-2 min-w-0 flex-1 text-right">
											<InlineEditableAgency
												sale={{
													channel: sale.channel,
													isWholesale: sale.isWholesale,
													agency: sale.agency
														? { id: sale.agency.id, name: sale.agency.name }
														: null,
													wholesaleAgency: sale.wholesaleAgency
														? { id: sale.wholesaleAgency.id, name: sale.wholesaleAgency.name }
														: null,
													updatedAt: sale.updatedAt,
												}}
												agencies={agencies}
												onSave={handleAgencySave}
												disabled={isEditDisabled}
												className="justify-end"
											/>
										</div>
									</div>
									<div className="flex justify-between">
										<span className="text-muted-foreground">Vendedor:</span>
										<span className="font-medium">{sale.seller.name}</span>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-muted-foreground">Contactado:</span>
										<InlineEditableSwitch
											value={sale.contacted}
											onSave={handleContactedSave}
											label="Contactado"
											disabled={isEditDisabled}
										/>
									</div>
									{sale.discount > 0 && (
										<div className="flex justify-between">
											<span className="text-muted-foreground">Descuento:</span>
											<span className="font-medium text-red-600">
												-{formatCurrency(sale.discount)}
											</span>
										</div>
									)}
									{sale.convertedFromQuote && (
										<div className="mt-2 flex items-center justify-between border-t pt-2">
											<span className="text-muted-foreground">Convertida desde:</span>
											<Badge
												variant="outline"
												className="border-orange-200 bg-orange-50 text-orange-600"
											>
												COT-{sale.convertedFromQuote.voucher}
											</Badge>
										</div>
									)}
									{sale.convertedToSale && (
										<div className="mt-2 flex items-center justify-between border-t pt-2">
											<span className="text-muted-foreground">Convertida a:</span>
											<Badge
												variant="outline"
												className="border-green-200 bg-green-50 text-green-600"
											>
												V-{sale.convertedToSale.voucher}
											</Badge>
										</div>
									)}
								</AccordionContent>
							</AccordionItem>

							{/* Wholesale Information */}
							{sale.isWholesale && (
								<AccordionItem value="wholesale" className="rounded-lg border px-3">
									<AccordionTrigger className="hover:no-underline">
										<span className="flex items-center gap-2 text-base font-semibold">
											<BuildingIcon className="h-4 w-4" />
											Informacion Mayorista
										</span>
									</AccordionTrigger>
									<AccordionContent className="space-y-2 pb-3">
										<div className="flex justify-between">
											<span className="text-muted-foreground">Tipo:</span>
											<Badge
												variant="outline"
												className="border-purple-200 bg-purple-50 text-purple-700"
											>
												Mayorista
											</Badge>
										</div>
										{sale.wholesaleAgency && (
											<div className="flex justify-between">
												<span className="text-muted-foreground">Agencia Mayorista:</span>
												<span className="font-medium">{sale.wholesaleAgency.name}</span>
											</div>
										)}
										<div className="flex justify-between">
											<span className="text-muted-foreground">Termino de Pago:</span>
											<span className="font-medium">
												{sale.wholesalePaymentTerm === "IMMEDIATE" ? "Inmediato" : "Postpago"}
											</span>
										</div>
										{sale.wholesaleMarkup > 0 && (
											<div className="flex justify-between">
												<span className="text-muted-foreground">Markup:</span>
												<span className="font-medium">{sale.wholesaleMarkup}%</span>
											</div>
										)}
									</AccordionContent>
								</AccordionItem>
							)}

							{/* Pasajeros */}
							<AccordionItem value="passengers" className="rounded-lg border px-3">
								<AccordionTrigger className="hover:no-underline">
									<span className="flex items-center gap-2 text-base font-semibold">
										<UsersIcon className="h-4 w-4" />
										Pasajeros ({sale.passengers.length})
									</span>
								</AccordionTrigger>
								<AccordionContent className="pb-3">
									<div className="space-y-2">
										{sale.passengers.map((passenger, index) => {
											const excludedTours = hasExclusionUI
												? getExcludedToursForPassenger(passenger.id)
												: []

											return (
												<div key={passenger.id} className="rounded-lg border p-3">
													<div className="mb-2 flex items-center justify-between">
														<span className="font-medium">
															Pasajero {index + 1}: {passenger.name || "Sin nombre"}
														</span>
														{passenger.age && <Badge variant="outline">{passenger.age} años</Badge>}
													</div>

													<div className="text-muted-foreground grid grid-cols-2 gap-2 text-sm">
														{passenger.document && (
															<div>
																<span className="font-medium">Doc:</span> {passenger.document}
															</div>
														)}
														{passenger.nationality && (
															<div>
																<span className="font-medium">Pais:</span> {passenger.nationality}
															</div>
														)}
														{passenger.phone && (
															<div className="flex items-center gap-1">
																<PhoneIcon className="h-3 w-3" />
																<span>{passenger.phone}</span>
															</div>
														)}
														{passenger.email && (
															<div className="flex items-center gap-1">
																<MailIcon className="h-3 w-3" />
																<span>{passenger.email}</span>
															</div>
														)}
													</div>

													{/* Diet */}
													{passenger.diet && (
														<div className="mt-2 flex items-center gap-2">
															<UtensilsIcon className="text-muted-foreground h-3 w-3" />
															<Badge variant="secondary">
																{DIET_LABELS[passenger.diet] || passenger.diet}
															</Badge>
															{passenger.diet === "OTHER" && passenger.dietOther && (
																<span className="text-muted-foreground text-xs">
																	({passenger.dietOther})
																</span>
															)}
														</div>
													)}

													{/* Allergies */}
													{passenger.allergies.length > 0 && (
														<div className="mt-2 flex flex-wrap items-center gap-1">
															<AlertTriangleIcon className="text-muted-foreground h-3 w-3" />
															{passenger.allergies.map((allergy) => (
																<Badge
																	key={allergy}
																	variant="outline"
																	className="border-red-200 bg-red-50 text-red-700"
																>
																	{allergy}
																</Badge>
															))}
														</div>
													)}

													{/* Hotels */}
													{passenger.hotels.length > 0 && (
														<div className="mt-2 space-y-1">
															<div className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
																<HotelIcon className="h-3 w-3" />
																Hoteles
															</div>
															{passenger.hotels
																.sort((a, b) => a.order - b.order)
																.map((hotel) => (
																	<div
																		key={hotel.id}
																		className="bg-muted/30 flex items-center justify-between rounded px-2 py-1 text-xs"
																	>
																		<span className="font-medium">{hotel.hotelName}</span>
																		{(hotel.checkIn || hotel.checkOut) && (
																			<span className="text-muted-foreground">
																				{hotel.checkIn && formatCalendarDay(hotel.checkIn, "dd/MM")}
																				{hotel.checkIn && hotel.checkOut && " → "}
																				{hotel.checkOut &&
																					formatCalendarDay(hotel.checkOut, "dd/MM")}
																			</span>
																		)}
																	</div>
																))}
														</div>
													)}

													{/* Excluded tours */}
													{excludedTours.length > 0 && (
														<div className="mt-2 space-y-1">
															<div className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
																<UserXIcon className="h-3 w-3" />
																Excluido de
															</div>
															{excludedTours.map((tour) => (
																<div
																	key={tour.tourName}
																	className="flex items-center gap-1.5 rounded bg-red-50 px-2 py-1 text-xs text-red-700"
																>
																	<span className="font-medium">{tour.tourName}</span>
																	{tour.reason && (
																		<span className="text-red-500">— {tour.reason}</span>
																	)}
																</div>
															))}
														</div>
													)}
												</div>
											)
										})}
									</div>
								</AccordionContent>
							</AccordionItem>

							{/* Eventos/Tours */}
							<AccordionItem value="events" className="rounded-lg border px-3">
								<AccordionTrigger className="hover:no-underline">
									<span className="flex items-center gap-2 text-base font-semibold">
										<CalendarIcon className="h-4 w-4" />
										Eventos/Tours ({sale.eventBookings.length})
									</span>
								</AccordionTrigger>
								<AccordionContent className="pb-3">
									<div className="space-y-3">
										{sale.eventBookings.map((booking) => {
											const revenue = calculateBookingRevenue(
												booking.priceEntries || [],
												booking.entrySnapshots || []
											)
											const activeCount = getActivePassengerCount(booking)
											const totalCount = sale.passengers.length
											const hasExcluded = activeCount < totalCount
											const allExcluded = activeCount === 0

											return (
												<div key={booking.id} className="rounded-lg border p-3">
													<div className="mb-2 flex items-center justify-between">
														<div>
															<div className="flex items-center gap-2 font-medium">
																{getEventDisplayName(booking.event)}
																{hasExclusionUI && (
																	<Badge
																		variant={hasExcluded ? "destructive" : "secondary"}
																		className="text-xs"
																	>
																		{activeCount}/{totalCount} pax
																	</Badge>
																)}
															</div>
															<div className="text-muted-foreground text-xs">
																{formatCalendarDay(booking.event.date, "dd/MM/yyyy")} &middot;{" "}
																{booking.event.mode === "PRIVATE" ? "Privado" : "Regular"}
															</div>
														</div>
														<div className="text-right">
															{booking.isFullyTransferred ? (
																<Badge
																	variant="outline"
																	className="border-amber-500 bg-amber-50 text-amber-700"
																>
																	Traspasado ({booking.transferredPassengerCount}/
																	{booking.passengerCount})
																</Badge>
															) : booking.isPartiallyTransferred ? (
																<Badge
																	variant="outline"
																	className="border-blue-500 bg-blue-50 text-blue-700"
																>
																	Parcial ({booking.transferredPassengerCount}/
																	{booking.passengerCount})
																</Badge>
															) : (
																<Badge variant="outline">Pendiente</Badge>
															)}
														</div>
													</div>

													{/* Schedule */}
													<div className="text-muted-foreground mb-2 space-y-0.5 text-sm">
														{booking.event.startTime && booking.event.endTime && (
															<div>
																Horario: {booking.event.startTime} - {booking.event.endTime}
															</div>
														)}
														{booking.event.serviceKind === "TRANSFER" && booking.flyName && (
															<div>Vuelo: {booking.flyName}</div>
														)}
														{booking.event.serviceKind === "TRANSFER" && booking.flyTime && (
															<div>Hora vuelo: {booking.flyTime}</div>
														)}
													</div>

													{/* Entry breakdown */}
													{(booking.priceEntries.length > 0 ||
														booking.entrySnapshots.length > 0) && (
														<div className="bg-muted/30 space-y-1 rounded-md p-2">
															{booking.priceEntries.map((entry) => (
																<div
																	key={entry.id}
																	className="flex items-center justify-between text-sm"
																>
																	<span>
																		{entry.count} {entry.categoryName}
																	</span>
																	<span className="text-muted-foreground">
																		{entry.count} &times; {formatCurrency(entry.priceSnapshot)} ={" "}
																		{formatCurrency(entry.priceSnapshot * entry.count)}
																	</span>
																</div>
															))}
															{booking.entrySnapshots.length > 0 &&
																booking.priceEntries.length > 0 && <Separator className="my-1" />}
															{booking.entrySnapshots.map((snap) => (
																<div
																	key={snap.id}
																	className="flex items-center justify-between text-sm"
																>
																	<span className="text-muted-foreground">
																		{snap.count} {snap.entryName} ({snap.variantName})
																	</span>
																	<span className="text-muted-foreground">
																		{snap.count} &times; {formatCurrency(snap.priceSnapshot)} ={" "}
																		{formatCurrency(snap.priceSnapshot * snap.count)}
																	</span>
																</div>
															))}
															<Separator className="my-1" />
															<div className="flex items-center justify-between text-sm font-medium">
																<span>Subtotal</span>
																<span>{formatCurrency(revenue.grandTotal)}</span>
															</div>
														</div>
													)}

													{/* Passenger exclusion toggles */}
													{hasExclusionUI && (
														<Accordion type="single" collapsible className="mt-3">
															<AccordionItem value="passengers" className="border-b-0">
																<AccordionTrigger className="text-muted-foreground py-1.5 text-xs font-medium hover:no-underline">
																	<span className="flex items-center gap-1">
																		<UsersIcon className="h-3 w-3" />
																		Pasajeros ({activeCount}/{totalCount} activos)
																	</span>
																</AccordionTrigger>
																<AccordionContent className="pb-1">
																	<div className="space-y-2">
																		{allExcluded && (
																			<div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
																				<AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" />
																				Todos los pasajeros estan excluidos de este tour
																			</div>
																		)}

																		{sale.passengers.map((passenger) => {
																			const state = getExclusionState(
																				booking.id,
																				passenger.id,
																				booking.bookingPassengers
																			)
																			const isExcluded = state.excluded

																			return (
																				<div key={passenger.id} className="rounded-md border p-2">
																					<div className="flex items-center justify-between">
																						<span
																							className={`text-sm ${
																								isExcluded
																									? "text-muted-foreground line-through"
																									: "font-medium"
																							}`}
																						>
																							{passenger.name || "Sin nombre"}
																						</span>
																						<Switch
																							checked={!isExcluded}
																							disabled={isPending}
																							onCheckedChange={(checked) =>
																								handleExclusionToggle(
																									booking.id,
																									passenger.id,
																									!checked,
																									booking.bookingPassengers
																								)
																							}
																						/>
																					</div>
																					{isExcluded && (
																						<div className="mt-1.5 flex items-center gap-1.5">
																							<Input
																								placeholder="Razon de exclusion..."
																								className="h-7 text-xs"
																								defaultValue={state.excludeReason}
																								onBlur={(e) => {
																									const val = e.target.value.trim()
																									if (val !== (state.excludeReason || "")) {
																										handleExclusionReasonSave(
																											booking.id,
																											passenger.id,
																											val
																										)
																									}
																								}}
																							/>
																						</div>
																					)}
																				</div>
																			)
																		})}
																	</div>
																</AccordionContent>
															</AccordionItem>
														</Accordion>
													)}
												</div>
											)
										})}
									</div>
								</AccordionContent>
							</AccordionItem>

							{/* Pagos */}
							{!isQuote && sale.paymentRecords.length > 0 && (
								<AccordionItem value="payments" className="rounded-lg border px-3">
									<AccordionTrigger className="hover:no-underline">
										<span className="flex items-center gap-2 text-base font-semibold">
											<CreditCardIcon className="h-4 w-4" />
											Pagos ({sale.paymentRecords.length})
										</span>
									</AccordionTrigger>
									<AccordionContent className="pb-3">
										<div className="space-y-2">
											{sale.paymentRecords.map((payment) => (
												<div
													key={payment.id}
													className="flex items-center justify-between rounded-lg border p-3"
												>
													<div className="flex gap-4">
														<div>
															<div className="font-medium">
																{payment.refund ? "Devolucion" : "Pago"} -{" "}
																{getPaymentMethodLabel(payment.method)}
															</div>
															<div className="text-muted-foreground text-sm">
																{format(new Date(payment.date), "dd MMM yyyy", { locale: es })}
															</div>
															{payment.currency === "USD" && payment.originalAmount !== null && (
																<div className="text-muted-foreground text-xs">
																	USD{" "}
																	{payment.originalAmount.toLocaleString("en-US", {
																		minimumFractionDigits: 2,
																		maximumFractionDigits: 2,
																	})}
																	{payment.exchangeRate && (
																		<>
																			{" "}
																			(TC: $
																			{payment.exchangeRate.toLocaleString("es-CL", {
																				minimumFractionDigits: 0,
																				maximumFractionDigits: 2,
																			})}
																			)
																		</>
																	)}
																</div>
															)}
														</div>
														{payment.voucherUrl && (
															<Button variant="ghost" size="icon" className="h-8 w-8" asChild>
																<a
																	href={payment.voucherUrl}
																	target="_blank"
																	rel="noopener noreferrer"
																	title="Descargar comprobante"
																>
																	<DownloadIcon className="text-primary h-4 w-4" />
																</a>
															</Button>
														)}
													</div>
													<div
														className={`text-lg font-semibold ${payment.refund ? "text-red-600" : ""}`}
													>
														{payment.refund ? "-" : ""}
														{formatCurrency(payment.amount)}
													</div>
												</div>
											))}
										</div>
									</AccordionContent>
								</AccordionItem>
							)}

							{/* Comentarios */}
							<AccordionItem value="comments" className="rounded-lg border px-3">
								<AccordionTrigger className="hover:no-underline">
									<span className="flex items-center gap-2 text-base font-semibold">
										<MessageSquareIcon className="h-4 w-4" />
										Comentarios
									</span>
								</AccordionTrigger>
								<AccordionContent className="pb-3">
									<InlineEditableText
										value={sale.comments}
										onSave={handleCommentsSave}
										placeholder="Sin comentarios"
										multiline
										label="Comentarios"
										disabled={isEditDisabled}
										className="w-full"
									/>
								</AccordionContent>
							</AccordionItem>
						</Accordion>

						{/* Total */}
						{!isQuote && (
							<Card className="border-primary bg-primary/5 gap-1 border-2">
								<CardContent className="pt-4">
									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<span className="text-muted-foreground text-sm">Monto Venta</span>
											<span className="font-medium">{formatCurrency(saleTotalWithDiscount)}</span>
										</div>
										<div className="flex items-center justify-between">
											<span className="text-muted-foreground text-sm">Total Pagado</span>
											<span className="font-medium">{formatCurrency(paymentTotal)}</span>
										</div>
										{saleTotalWithDiscount - paymentTotal !== 0 && (
											<>
												<Separator />
												<div className="flex items-center justify-between">
													<span className="text-muted-foreground text-sm">Saldo Pendiente</span>
													<span className="font-medium text-red-600">
														{formatCurrency(saleTotalWithDiscount - paymentTotal)}
													</span>
												</div>
											</>
										)}
										<Separator />
										<div className="flex items-center justify-between">
											<span className="text-lg font-semibold">TOTAL</span>
											<span className="text-primary text-2xl font-bold">
												{formatCurrency(paymentTotal)}
											</span>
										</div>
									</div>
								</CardContent>
							</Card>
						)}
					</div>
				</ScrollArea>
			</SheetContent>
		</Sheet>
	)
}
