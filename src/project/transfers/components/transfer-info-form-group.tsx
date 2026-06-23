"use client"

import { Loader2, CalendarIcon, Check, ChevronsUpDown, Search } from "lucide-react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useState, useMemo, useRef, useEffect } from "react"
import { es } from "date-fns/locale"
import { format } from "date-fns"
import { formatCalendarDay } from "@/shared/utils/calendar-day"

import { AgencySearchSelect } from "@/shared/components/agency-search-select"
import { withFieldGroup } from "@/shared/components/ui/tanstack-form"
import { TRANSFER_PAYMENT_STATUS } from "@/generated/prisma/enums"
import { cn } from "@/lib/utils"

import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover"
import { Textarea } from "@/shared/components/ui/textarea"
import { Calendar } from "@/shared/components/ui/calendar"
import { Button } from "@/shared/components/ui/button"
import { Switch } from "@/shared/components/ui/switch"
import { Label } from "@/shared/components/ui/label"
import { Badge } from "@/shared/components/ui/badge"
import {
	Select,
	SelectItem,
	SelectValue,
	SelectTrigger,
	SelectContent,
} from "@/shared/components/ui/select"
import {
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	CardDescription,
} from "@/shared/components/ui/card"

import type { EventForTransfer } from "../actions/transfer.actions"

interface TransferInfoFormGroupProps {
	isLoadingEvents: boolean
	events: EventForTransfer[]
	selectedEvent: EventForTransfer | null
	transferFullEvent: boolean
	onEventChange: (eventId: string) => void
	onTransferModeChange: (fullEvent: boolean) => void
	onVoucherChange: (voucherId: string) => void
	selectedVoucherId: string
}

export const TransferInfoFormGroup = withFieldGroup({
	defaultValues: {
		saleRecordId: "",
		date: new Date(),
		agencyId: "",
		paymentStatus: "PENDING" as const,
		comments: "",
	},
	props: {} as TransferInfoFormGroupProps,
	render: function TransferInfoRender({
		group,
		isLoadingEvents,
		events,
		selectedEvent,
		transferFullEvent,
		onEventChange,
		onTransferModeChange,
		onVoucherChange,
		selectedVoucherId,
	}) {
		const [eventSearchOpen, setEventSearchOpen] = useState(false)
		const [eventSearchQuery, setEventSearchQuery] = useState("")
		const [activeEventIndex, setActiveEventIndex] = useState(-1)
		const eventScrollRef = useRef<HTMLDivElement>(null)

		const [voucherSearchOpen, setVoucherSearchOpen] = useState(false)
		const [voucherSearchQuery, setVoucherSearchQuery] = useState("")
		const [activeVoucherIndex, setActiveVoucherIndex] = useState(-1)
		const voucherScrollRef = useRef<HTMLDivElement>(null)

		const filteredEvents = useMemo(() => {
			if (!eventSearchQuery.trim()) return events

			const query = eventSearchQuery.toLowerCase()
			return events.filter((event) => {
				const tourName = event.tour.name.toLowerCase()
				const dateStr = formatCalendarDay(event.date, "dd/MM/yyyy")
				const voucherNumbers = event.saleRecords.map((s) => `v-${s.voucher}`).join(" ")
				const passengerNames = event.saleRecords
					.flatMap((s) => s.passengers)
					.map((p) => p.name?.toLowerCase() || "")
					.join(" ")

				return (
					tourName.includes(query) ||
					dateStr.includes(query) ||
					voucherNumbers.includes(query) ||
					passengerNames.includes(query)
				)
			})
		}, [events, eventSearchQuery])

		const filteredVouchers = useMemo(() => {
			if (!selectedEvent) return []
			if (!voucherSearchQuery.trim()) return selectedEvent.saleRecords

			const query = voucherSearchQuery.toLowerCase()
			return selectedEvent.saleRecords.filter((sale) => {
				const voucherNum = `v-${sale.voucher}`
				const passengerNames = sale.passengers
					.map((p) => p.name?.toLowerCase() || "")
					.join(" ")

				return voucherNum.includes(query) || passengerNames.includes(query)
			})
		}, [selectedEvent, voucherSearchQuery])

		const eventVirtualizer = useVirtualizer({
			count: filteredEvents.length,
			getScrollElement: () => eventScrollRef.current,
			estimateSize: () => 64,
			overscan: 10,
			enabled: eventSearchOpen,
		})

		const voucherVirtualizer = useVirtualizer({
			count: filteredVouchers.length,
			getScrollElement: () => voucherScrollRef.current,
			estimateSize: () => 64,
			overscan: 10,
			enabled: voucherSearchOpen,
		})

		useEffect(() => {
			if (eventSearchOpen) {
				requestAnimationFrame(() => eventVirtualizer.measure())
			}
		// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [eventSearchOpen])

		useEffect(() => {
			if (voucherSearchOpen) {
				requestAnimationFrame(() => voucherVirtualizer.measure())
			}
		// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [voucherSearchOpen])

		useEffect(() => {
			setActiveEventIndex(-1)
		}, [filteredEvents.length, eventSearchQuery])

		useEffect(() => {
			setActiveVoucherIndex(-1)
		}, [filteredVouchers.length, voucherSearchQuery])

		const handleEventKeyDown = (e: React.KeyboardEvent) => {
			if (e.key === "ArrowDown") {
				e.preventDefault()
				setActiveEventIndex((i) => {
					const next = Math.min(i + 1, filteredEvents.length - 1)
					eventVirtualizer.scrollToIndex(next, { align: "auto" })
					return next
				})
			} else if (e.key === "ArrowUp") {
				e.preventDefault()
				setActiveEventIndex((i) => {
					const next = Math.max(i - 1, 0)
					eventVirtualizer.scrollToIndex(next, { align: "auto" })
					return next
				})
			} else if (e.key === "Enter" && activeEventIndex >= 0) {
				e.preventDefault()
				const event = filteredEvents[activeEventIndex]
				if (event && event.totalAvailablePassengers > 0) {
					onEventChange(event.id)
					setEventSearchOpen(false)
					setEventSearchQuery("")
				}
			}
		}

		const handleVoucherKeyDown = (e: React.KeyboardEvent) => {
			if (e.key === "ArrowDown") {
				e.preventDefault()
				setActiveVoucherIndex((i) => {
					const next = Math.min(i + 1, filteredVouchers.length - 1)
					voucherVirtualizer.scrollToIndex(next, { align: "auto" })
					return next
				})
			} else if (e.key === "ArrowUp") {
				e.preventDefault()
				setActiveVoucherIndex((i) => {
					const next = Math.max(i - 1, 0)
					voucherVirtualizer.scrollToIndex(next, { align: "auto" })
					return next
				})
			} else if (e.key === "Enter" && activeVoucherIndex >= 0) {
				e.preventDefault()
				const sale = filteredVouchers[activeVoucherIndex]
				if (sale && !sale.isFullyTransferred) {
					onVoucherChange(sale.id)
					setVoucherSearchOpen(false)
					setVoucherSearchQuery("")
				}
			}
		}

		return (
			<Card>
				<CardHeader>
					<CardTitle>Información del Traspaso</CardTitle>
					<CardDescription>Complete los datos del traspaso a otra agencia</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Selección de Evento */}
					<div className="space-y-4">
						<div className="space-y-2">
							<Label className="text-sm font-medium">
								Evento a Traspasar <span className="text-primary">*</span>
							</Label>
							<Popover open={eventSearchOpen} onOpenChange={setEventSearchOpen}>
								<PopoverTrigger asChild>
									<Button
										variant="outline"
										role="combobox"
										aria-expanded={eventSearchOpen}
										className="w-full justify-between"
										disabled={isLoadingEvents}
									>
										{selectedEvent ? (
											<span className="flex items-center gap-2 truncate">
												<span className="font-medium">{selectedEvent.tour.name}</span>
												<span className="text-muted-foreground">-</span>
												<span>{formatCalendarDay(selectedEvent.date, "dd/MM/yyyy")}</span>
												<Badge variant="default" className="ml-1">
													{selectedEvent.totalAvailablePassengers} disponibles
												</Badge>
											</span>
										) : (
											<span className="text-muted-foreground">Buscar evento...</span>
										)}
										{isLoadingEvents ? (
											<Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
										) : (
											<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
										)}
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
									<div className="flex flex-col">
										<div className="flex items-center gap-2 border-b px-3 py-2">
											<Search className="h-4 w-4 shrink-0 opacity-50" />
											<input
												autoFocus
												placeholder="Buscar por tour, fecha, voucher o pasajero..."
												value={eventSearchQuery}
												onChange={(e) => setEventSearchQuery(e.target.value)}
												onKeyDown={handleEventKeyDown}
												className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
											/>
										</div>
										{filteredEvents.length === 0 ? (
											<p className="text-muted-foreground py-6 text-center text-sm">
												No se encontraron eventos.
											</p>
										) : (
											<div
												ref={eventScrollRef}
												role="listbox"
												className="max-h-[300px] overflow-y-auto p-1"
											>
												<div
													style={{
														height: `${eventVirtualizer.getTotalSize()}px`,
														position: "relative",
														width: "100%",
													}}
												>
													{eventVirtualizer.getVirtualItems().map((virtualItem) => {
														const event = filteredEvents[virtualItem.index]
														const isDisabled = event.totalAvailablePassengers <= 0
														const isActive = activeEventIndex === virtualItem.index
														const isSelected = selectedEvent?.id === event.id

														return (
															<div
																key={event.id}
																role="option"
																aria-selected={isSelected}
																aria-disabled={isDisabled}
																data-index={virtualItem.index}
																ref={eventVirtualizer.measureElement}
																onClick={() => {
																	if (isDisabled) return
																	onEventChange(event.id)
																	setEventSearchOpen(false)
																	setEventSearchQuery("")
																}}
																onMouseEnter={() => setActiveEventIndex(virtualItem.index)}
																className={cn(
																	"flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-sm select-none",
																	isActive && "bg-accent text-accent-foreground",
																	isDisabled && "pointer-events-none opacity-50"
																)}
																style={{
																	position: "absolute",
																	top: 0,
																	left: 0,
																	width: "100%",
																	transform: `translateY(${virtualItem.start}px)`,
																}}
															>
																<div className="flex flex-col gap-1">
																	<div className="flex items-center gap-2">
																		<span className="font-medium">{event.tour.name}</span>
																		<span className="text-muted-foreground">-</span>
																		<span>
																			{formatCalendarDay(event.date, "dd/MM/yyyy")}
																		</span>
																	</div>
																	<div className="flex flex-wrap items-center gap-1">
																		<Badge variant="outline">
																			{event.totalPassengers} pax
																		</Badge>
																		<Badge variant="default">
																			Disponibles: {event.totalAvailablePassengers}
																		</Badge>
																		{event.totalTransferredPassengers > 0 && (
																			<Badge variant="secondary">
																				Traspasados: {event.totalTransferredPassengers}
																			</Badge>
																		)}
																		<Badge variant="secondary">
																			{event.saleRecords.length} voucher
																			{event.saleRecords.length !== 1 ? "s" : ""}
																		</Badge>
																	</div>
																</div>
																<Check
																	className={cn(
																		"ml-2 h-4 w-4 shrink-0",
																		isSelected ? "opacity-100" : "opacity-0"
																	)}
																/>
															</div>
														)
													})}
												</div>
											</div>
										)}
									</div>
								</PopoverContent>
							</Popover>
							{isLoadingEvents && (
								<p className="text-muted-foreground flex items-center gap-2 text-sm">
									<Loader2 className="h-4 w-4 animate-spin" />
									Cargando eventos disponibles...
								</p>
							)}
						</div>

						{/* Switch para modo de traspaso */}
						{selectedEvent && selectedEvent.saleRecords.length > 1 && (
							<div className="flex items-center justify-between rounded-lg border p-4">
								<div className="space-y-0.5">
									<Label htmlFor="transfer-mode" className="text-base font-medium">
										Traspasar evento completo
									</Label>
									<p className="text-muted-foreground text-sm">
										{transferFullEvent
											? `Se traspasarán pasajeros disponibles de ${selectedEvent.saleRecords.length} vouchers (${selectedEvent.totalAvailablePassengers} disponibles)`
											: "Solo se traspasará el voucher seleccionado"}
									</p>
								</div>
								<Switch
									id="transfer-mode"
									checked={transferFullEvent}
									onCheckedChange={onTransferModeChange}
								/>
							</div>
						)}

						{/* Selección de Voucher específico (si no es evento completo) */}
						{selectedEvent && !transferFullEvent && (
							<div className="space-y-2">
								<Label className="text-sm font-medium">
									Voucher a Traspasar <span className="text-primary">*</span>
								</Label>
								<Popover open={voucherSearchOpen} onOpenChange={setVoucherSearchOpen}>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											role="combobox"
											aria-expanded={voucherSearchOpen}
											className="w-full justify-between"
										>
											{selectedVoucherId ? (
												(() => {
													const sale = selectedEvent.saleRecords.find((s) => s.id === selectedVoucherId)
													if (!sale) return <span className="text-muted-foreground">Buscar voucher...</span>
													return (
														<span className="flex items-center gap-2 truncate">
															<span className="font-medium">V-{sale.voucher}</span>
															<Badge variant="default">
																{sale.availablePassengerCount} disponibles
															</Badge>
															{sale.passengers[0]?.name && (
																<span className="text-muted-foreground text-sm">
																	- {sale.passengers[0].name}
																	{sale.passengers.length > 1 && ` +${sale.passengers.length - 1}`}
																</span>
															)}
														</span>
													)
												})()
											) : (
												<span className="text-muted-foreground">Buscar voucher...</span>
											)}
											<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
									<div className="flex flex-col">
										<div className="flex items-center gap-2 border-b px-3 py-2">
											<Search className="h-4 w-4 shrink-0 opacity-50" />
											<input
												autoFocus
												placeholder="Buscar por número de voucher o pasajero..."
												value={voucherSearchQuery}
												onChange={(e) => setVoucherSearchQuery(e.target.value)}
												onKeyDown={handleVoucherKeyDown}
												className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
											/>
										</div>
										{filteredVouchers.length === 0 ? (
											<p className="text-muted-foreground py-6 text-center text-sm">
												No se encontraron vouchers.
											</p>
										) : (
											<div
												ref={voucherScrollRef}
												role="listbox"
												className="max-h-[300px] overflow-y-auto p-1"
											>
												<div
													style={{
														height: `${voucherVirtualizer.getTotalSize()}px`,
														position: "relative",
														width: "100%",
													}}
												>
													{voucherVirtualizer.getVirtualItems().map((virtualItem) => {
														const sale = filteredVouchers[virtualItem.index]
														const isDisabled = sale.isFullyTransferred
														const isActive = activeVoucherIndex === virtualItem.index
														const isSelected = selectedVoucherId === sale.id

														return (
															<div
																key={sale.id}
																role="option"
																aria-selected={isSelected}
																aria-disabled={isDisabled}
																data-index={virtualItem.index}
																ref={voucherVirtualizer.measureElement}
																onClick={() => {
																	if (isDisabled) return
																	onVoucherChange(sale.id)
																	setVoucherSearchOpen(false)
																	setVoucherSearchQuery("")
																}}
																onMouseEnter={() => setActiveVoucherIndex(virtualItem.index)}
																className={cn(
																	"flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-sm select-none",
																	isActive && "bg-accent text-accent-foreground",
																	isDisabled && "pointer-events-none opacity-50"
																)}
																style={{
																	position: "absolute",
																	top: 0,
																	left: 0,
																	width: "100%",
																	transform: `translateY(${virtualItem.start}px)`,
																}}
															>
																<div className="flex flex-col gap-1">
																	<div className="flex items-center gap-2">
																		<span className="font-medium">V-{sale.voucher}</span>
																		<Badge variant="outline">
																			{sale.passengerCount} pax
																		</Badge>
																		<Badge variant="default">
																			Disponibles: {sale.availablePassengerCount}
																		</Badge>
																		{sale.transferredPassengerCount > 0 && (
																			<Badge variant="secondary">
																				Traspasados: {sale.transferredPassengerCount}
																			</Badge>
																		)}
																		{sale.isFullyTransferred && (
																			<Badge
																				variant="outline"
																				className="border-amber-500 text-amber-700"
																			>
																				Ya traspasado
																			</Badge>
																		)}
																	</div>
																	{sale.passengers.length > 0 && (
																		<span className="text-muted-foreground text-sm">
																			{sale.passengers
																				.slice(0, 2)
																				.map((p) => p.name || "Sin nombre")
																				.join(", ")}
																			{sale.passengers.length > 2 &&
																				` +${sale.passengers.length - 2} más`}
																		</span>
																	)}
																</div>
																<Check
																	className={cn(
																		"ml-2 h-4 w-4 shrink-0",
																		isSelected ? "opacity-100" : "opacity-0"
																	)}
																/>
															</div>
														)
													})}
												</div>
											</div>
										)}
									</div>
								</PopoverContent>
								</Popover>
							</div>
						)}
					</div>

					{/* Resto del formulario */}
					<div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
						<group.AppField name="date">
							{(field) => (
								<field.FieldSet>
									<field.Field>
										<field.FieldLabel>
											Fecha del Traspaso <span className="text-primary">*</span>
										</field.FieldLabel>
										<Popover>
											<PopoverTrigger asChild>
												<Button
													variant="outline"
													className={cn(
														"w-full justify-start text-left font-normal",
														!field.state.value && "text-muted-foreground"
													)}
												>
													<CalendarIcon className="h-4 w-4" />
													{field.state.value ? (
														format(field.state.value, "PPP", { locale: es })
													) : (
														<span>Seleccione una fecha</span>
													)}
												</Button>
											</PopoverTrigger>
											<PopoverContent className="w-auto p-0" align="start">
												<Calendar
													required
													mode="single"
													selected={field.state.value}
													onSelect={(date) => date && field.handleChange(date)}
													initialFocus
													locale={es}
												/>
											</PopoverContent>
										</Popover>
									</field.Field>
									<field.FieldError />
								</field.FieldSet>
							)}
						</group.AppField>

						<group.AppField name="agencyId">
							{(field) => (
								<field.FieldSet>
									<field.Field>
										<field.FieldLabel>
											Agencia Destino <span className="text-primary">*</span>
										</field.FieldLabel>
										<AgencySearchSelect
											value={field.state.value}
											onValueChange={field.handleChange}
											agencyCatalog="TRANSFER"
											placeholder="Buscar agencia destino..."
											activeOnly={true}
										/>
									</field.Field>
									<field.FieldError />
								</field.FieldSet>
							)}
						</group.AppField>

						<group.AppField name="paymentStatus">
							{(field) => (
								<field.FieldSet>
									<field.Field>
										<field.FieldLabel>
											Estado del Pago <span className="text-primary">*</span>
										</field.FieldLabel>
										<Select
											value={field.state.value}
											onValueChange={(val) => field.handleChange(val as typeof field.state.value)}
										>
											<SelectTrigger className="w-full">
												<SelectValue placeholder="Seleccione el estado" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value={TRANSFER_PAYMENT_STATUS.PENDING}>Pendiente</SelectItem>
												<SelectItem value={TRANSFER_PAYMENT_STATUS.FULLY_PAID}>
													Pagado Totalmente
												</SelectItem>
												{/*
												 * TODO: Gate ENTRANCE_ONLY when the selected event's tour has no entries.
												 * EventForTransfer.tour.priceCategories does not include an `entries` field,
												 * so hasEntries cannot be derived here without an additional query or
												 * extending the EventForTransfer type to include entries per priceCategory.
												 */}
												<SelectItem value={TRANSFER_PAYMENT_STATUS.ENTRANCE_ONLY}>
													Pago Solo Entrada
												</SelectItem>
												<SelectItem value={TRANSFER_PAYMENT_STATUS.TOUR_ONLY}>
													Pago Solo Tour
												</SelectItem>
											</SelectContent>
										</Select>
									</field.Field>
									<field.FieldError />
								</field.FieldSet>
							)}
						</group.AppField>

						<group.AppField name="comments">
							{(field) => (
								<field.FieldSet className="md:col-span-2">
									<field.Field>
										<field.FieldLabel>Comentarios</field.FieldLabel>
										<Textarea
											id="comments"
											name="comments"
											placeholder="Comentarios adicionales..."
											value={field.state.value || ""}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
										/>
									</field.Field>
									<field.FieldError />
								</field.FieldSet>
							)}
						</group.AppField>
					</div>
				</CardContent>
			</Card>
		)
	},
})
