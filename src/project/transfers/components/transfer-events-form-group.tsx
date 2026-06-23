"use client"

import { CheckCircle2, AlertTriangle } from "lucide-react"
import { formatCalendarDay } from "@/shared/utils/calendar-day"

import { passengerCategoryLabels } from "../../sales/utils/passenger-category-labels"
import { withFieldGroup } from "@/shared/components/ui/tanstack-form"
import type { SaleRecordWithDetails } from "@/project/sales/actions/sale-record.actions"
import type { PassengerPrice } from "../schemas/transfer.schema"

import { Alert, AlertDescription } from "@/shared/components/ui/alert"
import { Badge } from "@/shared/components/ui/badge"
import { Checkbox } from "@/shared/components/ui/checkbox"
import { Switch } from "@/shared/components/ui/switch"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import {
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	CardDescription,
} from "@/shared/components/ui/card"

interface EventTransferData {
	clientId?: string
	eventId: string
	transferEvent: boolean
	passengerPrices: PassengerPrice[]
}

interface TransferEventsFormGroupProps {
	selectedSale: SaleRecordWithDetails | null
	selectedVoucher: string
}

export const TransferEventsFormGroup = withFieldGroup({
	defaultValues: {
		eventTransfers: [] as EventTransferData[],
	},
	props: {} as TransferEventsFormGroupProps,
	render: function TransferEventsRender({ group, selectedSale, selectedVoucher }) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Tours</CardTitle>
					<CardDescription>Lista de tours relacionados con el voucher</CardDescription>
				</CardHeader>
				<CardContent>
					<group.AppField name="eventTransfers" mode="array">
						{(field) => {
							const eventTransfers = field.state.value || []

							if (!selectedVoucher || eventTransfers.length === 0) {
								return (
									<div className="text-muted-foreground py-8 text-center text-sm">
										Seleccione un voucher para ver los tours disponibles
									</div>
								)
							}

							return (
								<div className="space-y-4">
									{eventTransfers.map((eventTransfer, eventIndex) => {
										const event =
											selectedSale?.eventBookings.find(
												(eventBooking) => eventBooking.event.id === eventTransfer.eventId
											) || selectedSale?.eventBookings[eventIndex]
										const tour = event?.event.tour
										const passengerPrices = eventTransfer.passengerPrices || []
										const hasEntranceFee = passengerPrices.some(
											(passenger) => passenger.entrancePrice > 0
										)
										const hasZeroTransferPrice =
											eventTransfer.transferEvent &&
											passengerPrices.some(
												(passenger) => passenger.isSelected && passenger.tourPrice === 0
											)
										const transferredPassengers = passengerPrices.filter(
											(passenger) => passenger.isAlreadyTransferred
										).length
										const selectedPassengers = passengerPrices.filter(
											(passenger) => passenger.isSelected && !passenger.isAlreadyTransferred
										).length
										const availablePassengers = passengerPrices.length - transferredPassengers
										const isFullyTransferred =
											passengerPrices.length > 0 && availablePassengers === 0

										return (
											<Card
												key={eventTransfer.clientId || eventTransfer.eventId || eventIndex}
												className={isFullyTransferred ? "border-amber-300 bg-amber-50/30" : ""}
											>
												<CardHeader>
													<div className="flex items-center justify-between">
														<div className="flex-1">
															<div className="flex items-center gap-2">
																<CardTitle className="text-lg">
																	{tour?.name || "Sin nombre"} -{" "}
																	{event?.event.date ? formatCalendarDay(event.event.date, "dd/MM/yyyy") : ""}
																</CardTitle>
																{isFullyTransferred && (
																	<Badge
																		variant="outline"
																		className="border-amber-500 bg-amber-100 text-amber-700"
																	>
																		<CheckCircle2 className="mr-1 h-3 w-3" />
																		Ya Traspasado
																	</Badge>
																)}
															</div>
															<CardDescription>
																{selectedPassengers} seleccionados de {availablePassengers}{" "}
																disponibles
																{transferredPassengers > 0 &&
																	` (${transferredPassengers} ya traspasados)`}
															</CardDescription>
														</div>
													</div>
													{isFullyTransferred && (
														<p className="mt-2 text-xs text-amber-700">
															Este evento no tiene pasajeros disponibles para traspasar.
														</p>
													)}
												</CardHeader>

												{/* T-B2: Amber alert for $0 transfer price */}
												{hasZeroTransferPrice && (
													<Alert className="mt-0 mb-0 w-full border-amber-500 text-amber-500">
														<AlertTriangle className="h-4 w-4 text-amber-500" />
														<AlertDescription>
															Uno o más pasajeros tienen precio de transferencia en $0. Verifica la
															configuración de precios del tour.
														</AlertDescription>
													</Alert>
												)}

												{eventTransfer.transferEvent && (
													<CardContent className="space-y-4">
														<div className="text-muted-foreground mb-2 text-sm font-medium">
															Selección y precios por pasajero
														</div>
														{eventTransfer.passengerPrices?.map((passenger, passengerIndex) => {
															const isAlreadyTransferredPassenger = Boolean(
																passenger.isAlreadyTransferred
															)
															const isSelectedPassenger =
																Boolean(passenger.isSelected) && !isAlreadyTransferredPassenger

															return (
																<div
																	key={
																		passenger.clientId ||
																		`${passenger.sourceSaleRecordId}-${passenger.passengerId}`
																	}
																	className={`grid grid-cols-1 gap-4 rounded-lg border p-4 ${hasEntranceFee ? "md:grid-cols-7" : "md:grid-cols-5"}`}
																>
																	<group.AppField
																		name={`eventTransfers[${eventIndex}].passengerPrices[${passengerIndex}].isSelected`}
																	>
																		{(subField) => (
																			<subField.FieldSet>
																				<subField.Field>
																					<subField.FieldLabel>Transferir</subField.FieldLabel>
																					<div className="flex items-center gap-2 pt-2">
																						<Checkbox
																							checked={
																								Boolean(subField.state.value) &&
																								!isAlreadyTransferredPassenger
																							}
																							onCheckedChange={(checked) =>
																								subField.handleChange(Boolean(checked))
																							}
																							disabled={isAlreadyTransferredPassenger}
																						/>
																						{isAlreadyTransferredPassenger ? (
																							<Badge
																								variant="outline"
																								className="border-amber-500 text-amber-700"
																							>
																								Ya traspasado
																							</Badge>
																						) : (
																							<Badge variant="secondary">Disponible</Badge>
																						)}
																					</div>
																				</subField.Field>
																			</subField.FieldSet>
																		)}
																	</group.AppField>

																	<group.AppField
																		name={`eventTransfers[${eventIndex}].passengerPrices[${passengerIndex}].passengerName`}
																	>
																		{(subField) => (
																			<subField.FieldSet>
																				<subField.Field>
																					<subField.FieldLabel>Nombre</subField.FieldLabel>
																					<Input
																						value={subField.state.value}
																						readOnly
																						className="bg-muted"
																					/>
																				</subField.Field>
																			</subField.FieldSet>
																		)}
																	</group.AppField>

																	<group.AppField
																		name={`eventTransfers[${eventIndex}].passengerPrices[${passengerIndex}].sourceVoucher`}
																	>
																		{(subField) => (
																			<subField.FieldSet>
																				<subField.Field>
																					<subField.FieldLabel>Voucher</subField.FieldLabel>
																					<Input
																						readOnly
																						className="bg-muted"
																						value={
																							subField.state.value
																								? `V-${subField.state.value}`
																								: "-"
																						}
																					/>
																				</subField.Field>
																			</subField.FieldSet>
																		)}
																	</group.AppField>

																	<group.AppField
																		name={`eventTransfers[${eventIndex}].passengerPrices[${passengerIndex}].ageCategory`}
																	>
																		{(subField) => (
																			<subField.FieldSet>
																				<subField.Field>
																					<subField.FieldLabel>Categoría</subField.FieldLabel>
																					<Input
																						readOnly
																						className="bg-muted"
																						value={
																							passengerCategoryLabels[
																								subField.state
																									.value as keyof typeof passengerCategoryLabels
																							] || subField.state.value
																						}
																					/>
																				</subField.Field>
																			</subField.FieldSet>
																		)}
																	</group.AppField>

																	<group.AppField
																		name={`eventTransfers[${eventIndex}].passengerPrices[${passengerIndex}].tourPrice`}
																	>
																		{(subField) => (
																			<subField.FieldSet>
																				<subField.Field>
																					<subField.FieldLabel>Precio Tour</subField.FieldLabel>
																					<Input
																						type="number"
																						step="0.01"
																						placeholder="0"
																						value={subField.state.value === 0 ? "" : subField.state.value}
																						disabled={!isSelectedPassenger}
																						onBlur={(e) => {
																							if (e.target.value === "") {
																								subField.handleChange(0)
																							}
																							subField.handleBlur()
																						}}
																						onChange={(e) => {
																							const raw = e.target.value
																							const newTourPrice = raw === "" ? 0 : (parseFloat(raw) || 0)
																							subField.handleChange(newTourPrice)

																							// Actualizar totalPrice
																							const entrancePrice =
																								group.getFieldValue(
																									`eventTransfers[${eventIndex}].passengerPrices[${passengerIndex}].entrancePrice`
																								) || 0
																							group.setFieldValue(
																								`eventTransfers[${eventIndex}].passengerPrices[${passengerIndex}].totalPrice`,
																								newTourPrice + entrancePrice
																							)
																						}}
																					/>
																				</subField.Field>
																				<subField.FieldError />
																			</subField.FieldSet>
																		)}
																	</group.AppField>

																	{hasEntranceFee && (
																		<group.AppField
																			name={`eventTransfers[${eventIndex}].passengerPrices[${passengerIndex}].entrancePrice`}
																		>
																			{(subField) => (
																				<subField.FieldSet>
																					<subField.Field>
																						<subField.FieldLabel>
																							Precio Entrada
																						</subField.FieldLabel>
																						<Input
																							type="number"
																							step="0.01"
																							placeholder="0"
																							value={subField.state.value === 0 ? "" : subField.state.value}
																							disabled={!isSelectedPassenger}
																							onBlur={(e) => {
																								if (e.target.value === "") {
																									subField.handleChange(0)
																								}
																								subField.handleBlur()
																							}}
																							onChange={(e) => {
																								const raw = e.target.value
																								const newEntrancePrice = raw === "" ? 0 : (parseFloat(raw) || 0)
																								subField.handleChange(newEntrancePrice)

																								// Actualizar totalPrice
																								const tourPrice =
																									group.getFieldValue(
																										`eventTransfers[${eventIndex}].passengerPrices[${passengerIndex}].tourPrice`
																									) || 0
																								group.setFieldValue(
																									`eventTransfers[${eventIndex}].passengerPrices[${passengerIndex}].totalPrice`,
																									tourPrice + newEntrancePrice
																								)
																							}}
																						/>
																					</subField.Field>
																					<subField.FieldError />
																				</subField.FieldSet>
																			)}
																		</group.AppField>
																	)}

																	{hasEntranceFee && (
																		<group.AppField
																			name={`eventTransfers[${eventIndex}].passengerPrices[${passengerIndex}].totalPrice`}
																		>
																			{(subField) => (
																				<subField.FieldSet>
																					<subField.Field>
																						<subField.FieldLabel>Total</subField.FieldLabel>
																						<Input
																							type="number"
																							value={subField.state.value}
																							readOnly
																							className="bg-muted font-semibold"
																						/>
																					</subField.Field>
																				</subField.FieldSet>
																			)}
																		</group.AppField>
																	)}
																</div>
															)
														})}
													</CardContent>
												)}
											</Card>
										)
									})}
								</div>
							)
						}}
					</group.AppField>
				</CardContent>
			</Card>
		)
	},
})
