import {
	FileText,
	ChevronDown,
	CheckCircle2,
	AlertTriangle,
	Loader2,
	ArrowRightLeft,
	CheckSquare,
	Building2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { channelTypeLabels } from "@/project/sales/utils/channel-type-labels"
import { ScrollArea } from "@/shared/components/ui/scroll-area"
import { Switch } from "@/shared/components/ui/switch"
import { Badge } from "@/shared/components/ui/badge"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { Button } from "@/shared/components/ui/button"
import { Checkbox } from "@/shared/components/ui/checkbox"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/shared/components/ui/collapsible"

import { isPassengerComplete } from "./event-detail-utils"
import { formatHotelsSummary } from "@/project/sales/utils/resolve-hotel"
import type { UpdatePassengerData } from "./event-detail-types"

interface EventVouchersSectionProps {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	event: any
	openVouchers: string[]
	setOpenVouchers: React.Dispatch<React.SetStateAction<string[]>>
	passengerEdits: Record<string, UpdatePassengerData>
	savingPassengers: Record<string, boolean>
	handleContactedChange: (saleRecordId: string, contacted: boolean) => void
	handlePassengerChange: (
		passengerId: string,
		field: keyof UpdatePassengerData,
		value: string | number | null
	) => void
	/**
	 * When true, all passenger inputs and the contacted switch are rendered
	 * as disabled/read-only. Use this in contexts where editing is not
	 * supported (e.g. GroupAssignmentPanel). Default: false.
	 */
	readOnly?: boolean
	// Reassignment props (optional for backward compat)
	isMultiSelectMode?: boolean
	selectedBookingIds?: Set<string>
	onToggleMultiSelectMode?: () => void
	onToggleBookingSelection?: (bookingId: string) => void
	onSelectAllBookings?: (bookingIds: string[]) => void
	onOpenReassignDialog?: (bookingId: string) => void
	onOpenBulkReassignDialog?: () => void
}

export function EventVouchersSection({
	event,
	openVouchers,
	setOpenVouchers,
	passengerEdits,
	savingPassengers,
	handleContactedChange,
	handlePassengerChange,
	readOnly = false,
	isMultiSelectMode = false,
	selectedBookingIds,
	onToggleMultiSelectMode,
	onToggleBookingSelection,
	onSelectAllBookings,
	onOpenReassignDialog,
	onOpenBulkReassignDialog,
}: EventVouchersSectionProps) {
	const bookingCount = event.bookings?.length || 0
	const selectedCount = selectedBookingIds?.size ?? 0
	const hasReassignment = !!onOpenReassignDialog
	const allSelected = bookingCount > 0 && selectedCount === bookingCount

	return (
		<ScrollArea className="col-span-2 h-[60vh]">
			<div className="space-y-3 p-4">
				{/* Section header */}
				<div className="flex items-center justify-between">
					<h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
						<FileText className="h-4 w-4" />
						Vouchers ({bookingCount})
					</h3>

					{hasReassignment && bookingCount > 1 && (
						<Button
							variant={isMultiSelectMode ? "default" : "outline"}
							size="xs"
							onClick={onToggleMultiSelectMode}
						>
							<CheckSquare className="h-3 w-3" />
							{isMultiSelectMode ? "Cancelar selección" : "Selección múltiple"}
						</Button>
					)}
				</div>

				{/* Bulk action bar */}
				{isMultiSelectMode && (
					<div className="flex items-center justify-between rounded-md border border-blue-300 bg-blue-50 p-2 dark:border-blue-500/40 dark:bg-blue-500/10">
						<div className="flex items-center gap-2">
							<span className="text-xs font-medium text-blue-800 dark:text-blue-200">
								{selectedCount > 0
									? `${selectedCount} voucher${selectedCount > 1 ? "s" : ""} seleccionado${selectedCount > 1 ? "s" : ""}`
									: "Ningún voucher seleccionado"}
							</span>
							{allSelected ? (
								<Button
									variant="ghost"
									size="xs"
									className="text-blue-700 dark:text-blue-300"
									onClick={() => onSelectAllBookings?.([])}
								>
									Deseleccionar todos
								</Button>
							) : (
								<Button
									variant="ghost"
									size="xs"
									className="text-blue-700 dark:text-blue-300"
									onClick={() => {
										const allIds = event.bookings?.map((b: { id: string }) => b.id) ?? []
										onSelectAllBookings?.(allIds)
									}}
								>
									Seleccionar todos
								</Button>
							)}
						</div>
						{selectedCount > 0 && (
							<Button size="xs" onClick={onOpenBulkReassignDialog}>
								<ArrowRightLeft className="h-3 w-3" />
								Reasignar seleccionados
							</Button>
						)}
					</div>
				)}

				{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
				{event.bookings?.map((booking: any) => {
					const saleRecord = booking.saleRecord
					// Use bookingPassengers (filtered by non-excluded) if available, fall back to saleRecord.passengers
					const passengers = booking.bookingPassengers?.length
						? booking.bookingPassengers
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								.filter((bp: any) => !bp.excluded)
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								.map((bp: any) => bp.passenger)
						: saleRecord?.passengers || []
					const excludedCount = booking.bookingPassengers?.length
						? // eslint-disable-next-line @typescript-eslint/no-explicit-any
							booking.bookingPassengers.filter((bp: any) => bp.excluded).length
						: 0
					const hasIncomplete = passengers.some(
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						(p: any) => !isPassengerComplete(p)
					)
					const isOpen = openVouchers.includes(booking.id)
					const isSelected = selectedBookingIds?.has(booking.id) ?? false

					return (
						<Collapsible
							key={booking.id}
							open={isOpen}
							onOpenChange={(open) => {
								setOpenVouchers((prev) =>
									open ? [...prev, booking.id] : prev.filter((id) => id !== booking.id)
								)
							}}
						>
							<div
								className={cn(
									"rounded-lg border",
									isSelected &&
										"border-blue-400 bg-blue-50/30 dark:border-blue-500/50 dark:bg-blue-500/5"
								)}
							>
								<div className="flex items-center">
									{/* Multi-select checkbox */}
									{isMultiSelectMode && (
										<div
											className="flex shrink-0 items-center pl-3"
											onClick={(e) => e.stopPropagation()}
										>
											<Checkbox
												checked={isSelected}
												onCheckedChange={() => onToggleBookingSelection?.(booking.id)}
											/>
										</div>
									)}

									<CollapsibleTrigger className="hover:bg-muted/50 flex min-w-0 flex-1 items-center justify-between p-3 text-left">
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-2">
												<span className="font-semibold">V-{saleRecord?.voucher}</span>
												<Badge variant="outline" className="text-xs">
													{passengers.length} pax
													{excludedCount > 0 && (
														<span className="text-muted-foreground ml-1">(-{excludedCount})</span>
													)}
												</Badge>
												{saleRecord?.isWholesale && (
													<Badge
														variant="outline"
														className="gap-1 border-purple-200 bg-purple-50 text-xs text-purple-700 dark:border-purple-500/40 dark:bg-purple-500/10 dark:text-purple-300"
													>
														<Building2 className="h-3 w-3" />
														Mayorista
													</Badge>
												)}
												{saleRecord?.contacted && (
													<Badge variant="default" className="gap-1 bg-green-600 text-xs">
														<CheckCircle2 className="h-3 w-3" />
														Contactado
													</Badge>
												)}
												{hasIncomplete && !isOpen && (
													<Badge variant="destructive" className="gap-1 text-xs">
														<AlertTriangle className="h-3 w-3" />
														Datos incompletos
													</Badge>
												)}
											</div>
											<div className="text-muted-foreground mt-0.5 text-xs">
												{passengers[0]?.name || "Sin nombre"} •{" "}
												{passengers[0]?.hotels?.length
													? formatHotelsSummary(passengers[0].hotels)
													: "Sin hotel"}
											</div>
										</div>
										<ChevronDown
											className={cn(
												"h-4 w-4 shrink-0 transition-transform",
												isOpen && "rotate-180"
											)}
										/>
									</CollapsibleTrigger>

									{/* Single reassign button */}
									{hasReassignment && !isMultiSelectMode && (
										<div className="shrink-0 pr-2 pl-2">
											<Button
												variant="ghost"
												size="icon-xs"
												title="Reasignar voucher"
												onClick={(e) => {
													e.stopPropagation()
													onOpenReassignDialog?.(booking.id)
												}}
											>
												<ArrowRightLeft className="h-3.5 w-3.5" />
											</Button>
										</div>
									)}
								</div>

								<CollapsibleContent>
									<div className="space-y-4 border-t p-3">
										{/* Sale info — channel, seller, agency, file, and wholesale */}
										<div className="bg-muted/30 space-y-1.5 rounded-md p-3 text-sm">
											<div className="flex items-center justify-between">
												<span className="text-muted-foreground">Tipo</span>
												<Badge variant={saleRecord?.type === "QUOTE" ? "secondary" : "default"}>
													{saleRecord?.type === "QUOTE" ? "Cotización" : "Venta"}
												</Badge>
											</div>
											<div className="flex items-center justify-between">
												<span className="text-muted-foreground">Canal</span>
												<span className="font-medium">
													{channelTypeLabels[
														saleRecord?.channel as keyof typeof channelTypeLabels
													] ?? "—"}
												</span>
											</div>
											<div className="flex items-center justify-between">
												<span className="text-muted-foreground">Vendedor</span>
												<span className="font-medium">{saleRecord?.seller?.name ?? "—"}</span>
											</div>
											{saleRecord?.agency?.name && (
												<div className="flex items-center justify-between">
													<span className="text-muted-foreground">Agencia</span>
													<span className="font-medium">{saleRecord.agency.name}</span>
												</div>
											)}
											<div className="flex items-center justify-between">
												<span className="text-muted-foreground">N° File</span>
												<span className="font-medium">{saleRecord?.fileNumber || "PENDIENTE"}</span>
											</div>
											{saleRecord?.discount > 0 && (
												<div className="flex items-center justify-between">
													<span className="text-muted-foreground">Descuento</span>
													<span className="font-medium text-red-600">
														-{saleRecord.discount.toLocaleString("es-CL")}
													</span>
												</div>
											)}

											{/* Wholesale sub-block */}
											{saleRecord?.isWholesale && (
												<div className="mt-1.5 space-y-1.5 border-t pt-2">
													<div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300">
														<Building2 className="h-3 w-3" />
														Información Mayorista
													</div>
													{saleRecord?.wholesaleAgency?.name && (
														<div className="flex items-center justify-between">
															<span className="text-muted-foreground">Agencia Mayorista</span>
															<span className="font-medium">{saleRecord.wholesaleAgency.name}</span>
														</div>
													)}
													<div className="flex items-center justify-between">
														<span className="text-muted-foreground">Término de Pago</span>
														<span className="font-medium">
															{saleRecord?.wholesalePaymentTerm === "IMMEDIATE"
																? "Inmediato"
																: "Postpago"}
														</span>
													</div>
													{saleRecord?.wholesaleMarkup > 0 && (
														<div className="flex items-center justify-between">
															<span className="text-muted-foreground">Markup</span>
															<span className="font-medium">{saleRecord.wholesaleMarkup}%</span>
														</div>
													)}
												</div>
											)}
										</div>

										{/* Contacted Switch — disabled in readOnly mode */}
										<div className="bg-muted/30 flex items-center justify-between rounded-md p-2">
											<Label className="text-sm font-medium">Cliente contactado</Label>
											<Switch
												checked={saleRecord?.contacted || false}
												onCheckedChange={
													readOnly
														? undefined
														: (checked) => handleContactedChange(saleRecord?.id, checked)
												}
												disabled={readOnly}
											/>
										</div>

										{/* Special Request */}
										{booking.specialRequest && (
											<div className="rounded-md bg-amber-50 p-2 text-xs text-amber-700">
												<strong>Solicitud especial:</strong> {booking.specialRequest}
											</div>
										)}

										{/* Passengers — inputs disabled in readOnly mode */}
										<div className="space-y-3">
											<Label className="text-muted-foreground text-xs font-semibold uppercase">
												Pasajeros
											</Label>
											{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
											{passengers.map((passenger: any, idx: number) => {
												const pComplete = isPassengerComplete(passenger)
												const editData = passengerEdits[passenger.id] || {}
												const isSaving = savingPassengers[passenger.id]

												return (
													<div
														key={passenger.id}
														className={cn(
															"space-y-2 rounded-md border p-3",
															!pComplete && "border-amber-500/50"
														)}
													>
														<div className="flex items-center justify-between">
															<span className="text-xs font-medium">
																Pasajero {idx + 1}
																{!pComplete && (
																	<span className="ml-2 text-amber-600">(incompleto)</span>
																)}
															</span>
															{isSaving && (
																<Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
															)}
														</div>
														<div className="grid grid-cols-2 gap-2">
															<div>
																<Label className="text-xs">Nombre</Label>
																<Input
																	className="h-8 text-xs"
																	value={editData.name ?? passenger.name ?? ""}
																	onChange={
																		readOnly
																			? undefined
																			: (e) => handlePassengerChange(passenger.id, "name", e.target.value)
																	}
																	readOnly={readOnly}
																	disabled={readOnly}
																	placeholder="Nombre completo"
																/>
															</div>
															<div>
																<Label className="text-xs">Documento</Label>
																<Input
																	className="h-8 text-xs"
																	value={editData.document ?? passenger.document ?? ""}
																	onChange={
																		readOnly
																			? undefined
																			: (e) => handlePassengerChange(passenger.id, "document", e.target.value)
																	}
																	readOnly={readOnly}
																	disabled={readOnly}
																	placeholder="RUT/Pasaporte"
																/>
															</div>
															<div>
																<Label className="text-xs">Edad</Label>
																<Input
																	className="h-8 text-xs"
																	type="number"
																	min={0}
																	inputMode="numeric"
																	value={editData.age ?? passenger.age ?? ""}
																	onChange={
																		readOnly
																			? undefined
																			: (e) =>
																					handlePassengerChange(
																						passenger.id,
																						"age",
																						e.target.value === "" ? null : Number(e.target.value)
																					)
																	}
																	readOnly={readOnly}
																	disabled={readOnly}
																	placeholder="Edad"
																/>
															</div>
															<div>
																<Label className="text-xs">Nacionalidad</Label>
																<Input
																	className="h-8 text-xs"
																	value={editData.nationality ?? passenger.nationality ?? ""}
																	onChange={
																		readOnly
																			? undefined
																			: (e) =>
																					handlePassengerChange(
																						passenger.id,
																						"nationality",
																						e.target.value
																					)
																	}
																	readOnly={readOnly}
																	disabled={readOnly}
																	placeholder="País"
																/>
															</div>
															<div>
																<Label className="text-xs">Teléfono</Label>
																<Input
																	className="h-8 text-xs"
																	value={editData.phone ?? passenger.phone ?? ""}
																	onChange={
																		readOnly
																			? undefined
																			: (e) => handlePassengerChange(passenger.id, "phone", e.target.value)
																	}
																	readOnly={readOnly}
																	disabled={readOnly}
																	placeholder="+56 9..."
																/>
															</div>
															<div className="col-span-2">
																<Label className="text-xs">Hotel</Label>
																<Input
																	className="h-8 text-xs"
																	value={
																		editData.hotel ??
																		(passenger.hotels?.length
																			? formatHotelsSummary(passenger.hotels)
																			: "")
																	}
																	onChange={
																		readOnly
																			? undefined
																			: (e) => handlePassengerChange(passenger.id, "hotel", e.target.value)
																	}
																	readOnly={readOnly}
																	disabled={readOnly}
																	placeholder="Nombre del hotel"
																/>
															</div>
														</div>
													</div>
												)
											})}
										</div>
									</div>
								</CollapsibleContent>
							</div>
						</Collapsible>
					)
				})}

				{(!event.bookings || event.bookings.length === 0) && (
					<p className="text-muted-foreground py-8 text-center text-sm">
						No hay vouchers asociados
					</p>
				)}
			</div>
		</ScrollArea>
	)
}
