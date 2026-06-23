"use client"

import { useEffect, useRef, useState } from "react"

import { withFieldGroup } from "@/shared/components/ui/tanstack-form"
import {
	CalendarIcon,
	Plus,
	Trash2,
	AlertTriangle,
	MountainIcon,
	TicketPlusIcon,
	TicketIcon,
} from "lucide-react"
import { useField } from "@tanstack/react-form"
import { useQuery } from "@tanstack/react-query"
import { es } from "date-fns/locale"
import { format } from "date-fns"

import { ActiveTour, useActiveTours } from "@/project/tours/hooks/use-tours"
import {
	buildPriceEntriesFromTour,
	buildEntrySnapshotsFromTour,
	isPriceOutOfBounds,
	tourHasQuotableCategories,
} from "@/project/tours/utils/tour-form-helpers"
import { getExistingEventsForTour } from "@/project/sales/actions/event-query.actions"
import { ExistingEventSelector } from "./existing-event-selector"
import { createEventBooking } from "@/project/sales/utils/create-event-booking"
import { toHHmm } from "@/project/sales/utils/normalize-time"
import { TourSearchSelect } from "@/shared/components/tour-search-select"
import { cn } from "@/lib/utils"
import { useSaleFormStore } from "@/project/sales/stores/sale-form.store"
import { isPastEventDate } from "@/shared/utils/calendar-day"

import { CardTitle, CardHeader, CardContent, CardDescription } from "@/shared/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover"
import {
	Accordion,
	AccordionItem,
	AccordionTrigger,
	AccordionContent,
} from "@/shared/components/ui/accordion"
import { Textarea } from "@/shared/components/ui/textarea"
import { Calendar } from "@/shared/components/ui/calendar"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import {
	Select,
	SelectItem,
	SelectValue,
	SelectTrigger,
	SelectContent,
} from "@/shared/components/ui/select"

interface EventBookingItemProps {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	form: any
	index: number
	/** Stable accordion item value (derived from the booking's clientId). */
	accordionValue: string
	availableTours: ActiveTour[] | undefined
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	arrayField: any
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	group: any
	/** Removes THIS booking by its real index. Undefined when removal is disabled. */
	onRemove?: () => void
}

function EventBookingItem({
	form,
	index,
	accordionValue,
	availableTours,
	arrayField,
	group,
	onRemove,
}: EventBookingItemProps) {
	const startTimeField = useField({
		form,
		name: `eventBookings[${index}].startTime`,
	})

	const tourIdField = useField({
		form,
		name: `eventBookings[${index}].tourId`,
	})
	const selectedTour = availableTours?.find((t: { id: string }) => t.id === tourIdField.state.value)
	const isTransfer = selectedTour?.serviceKind === "TRANSFER"
	const isTour = selectedTour?.serviceKind === "TOUR"
	// A selected tour with no quotable categories yields zero passenger entries,
	// so the step can never validate. Detect it to explain why instead of leaving
	// a silently dead "Siguiente" button.
	const selectedTourHasNoCategories = !!selectedTour && !tourHasQuotableCategories(selectedTour)

	const endTimeField = useField({
		form,
		name: `eventBookings[${index}].endTime`,
	})

	const eventIdField = useField({
		form,
		name: `eventBookings[${index}].eventId`,
	})

	const dateField = useField({
		form,
		name: `eventBookings[${index}].date`,
	})

	const modeField = useField({
		form,
		name: `eventBookings[${index}].mode`,
	})

	const { editMode } = useSaleFormStore()

	const dateValue = dateField.state.value as Date | undefined
	const dateKey = dateValue?.toISOString?.().split("T")[0] ?? null

	const { data: existingEvents, isLoading: loadingEvents } = useQuery({
		queryKey: ["existing-events", tourIdField.state.value, dateKey, modeField.state.value],
		queryFn: () =>
			getExistingEventsForTour({
				tourId: tourIdField.state.value as string,
				date: dateValue as Date,
				mode: modeField.state.value as "REGULAR" | "PRIVATE",
			}),
		enabled: !!tourIdField.state.value && !!dateValue && !!modeField.state.value && isTour,
		staleTime: 30_000,
	})

	const tourName = selectedTour?.name

	return (
		<AccordionItem value={accordionValue}>
			<AccordionTrigger className="text-base font-medium">
				<span className="text-muted-foreground">Tour {index + 1}.</span>
				{tourName ? `${tourName}` : "Sin Tour"}
			</AccordionTrigger>

			<AccordionContent className="h-fit">
				<div className="grid grid-cols-1 gap-x-4 gap-y-5 pb-6 lg:grid-cols-2">
					<group.AppField name={`eventBookings[${index}].mode`}>
						{(field: any) => {
							const options = [
								{ label: "Regular", value: "REGULAR" },
								{ label: "Privado", value: "PRIVATE" },
							]
							return (
								<field.FieldSet className="w-full">
									<field.Field>
										<field.FieldLabel htmlFor={`eventBookings[${index}].mode`}>
											Modo de Venta <span className="text-primary">*</span>
										</field.FieldLabel>
									</field.Field>
									<Select
										name={`eventBookings[${index}].mode`}
										value={(field.state.value as string | undefined) ?? ""}
										onValueChange={(value) => {
											field.handleChange(value)
											if (value === "PRIVATE") {
												form.setFieldValue(`eventBookings[${index}].eventId`, "")
											}
										}}
										defaultValue={String(field?.state.value ?? "")}
										disabled={false}
										aria-invalid={!!field.state.meta.errors.length && field.state.meta.isTouched}
									>
										<field.Field>
											<SelectTrigger className="w-full">
												<SelectValue placeholder="Selecciona un modo de venta" />
											</SelectTrigger>
										</field.Field>
										<SelectContent>
											{options.map(({ label, value }) => (
												<SelectItem key={value} value={value}>
													{label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>

									<field.FieldError />
								</field.FieldSet>
							)
						}}
					</group.AppField>

					<group.AppField name={`eventBookings[${index}].date`}>
						{(field: any) => {
							const date = field.state.value
							return (
								<field.FieldSet className="flex w-full flex-col">
									<field.Field className="gap-1">
										<field.FieldLabel htmlFor={`eventBookings[${index}].date`}>
											Fecha del Evento <span className="text-primary">*</span>
										</field.FieldLabel>

										<Popover>
											<PopoverTrigger
												asChild
												disabled={false}
												aria-invalid={
													!!field.state.meta.errors.length && field.state.meta.isTouched
												}
											>
												<Button
													variant={"outline"}
													className={cn(
														"w-full justify-start text-start font-normal",
														!date && "text-muted-foreground"
													)}
												>
													<CalendarIcon className="size-4" />
													{date ? (
														format(date, "PPP", { locale: es })
													) : (
														<span>Seleccione fecha</span>
													)}
												</Button>
											</PopoverTrigger>
											<PopoverContent className="w-auto p-0" align="start">
												<Calendar
													mode="single"
													selected={field.state.value as Date | undefined}
													defaultMonth={field.state.value as Date | undefined}
													onSelect={(newDate: Date) => {
														field.handleChange(newDate)
													}}
													locale={es}
													required
													disabled={{ before: new Date() }}
													aria-invalid={
														!!field.state.meta.errors.length && field.state.meta.isTouched
													}
												/>
											</PopoverContent>
										</Popover>

										<field.FieldError />
										{editMode && isPastEventDate(date as Date | undefined) && (
											<div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
												<AlertTriangle className="h-3 w-3" />
												Este evento ya pasó — estás editando una venta con fecha anterior a hoy.
											</div>
										)}
									</field.Field>
								</field.FieldSet>
							)
						}}
					</group.AppField>

					<group.AppField name={`eventBookings[${index}].tourId`}>
						{(tourField: any) => {
							return (
								<arrayField.FieldSet className="w-full lg:col-span-2">
									<arrayField.Field>
										<arrayField.FieldLabel htmlFor={`eventBookings[${index}].tour`}>
											Tour/Evento <span className="text-primary">*</span>
										</arrayField.FieldLabel>
									</arrayField.Field>

									<TourSearchSelect
										tours={availableTours}
										value={(tourField.state.value as string | undefined) ?? ""}
										onValueChange={(value) => {
											tourField.handleChange(value)
											eventIdField.handleChange("")

											const tour = availableTours?.find((t: ActiveTour) => t.id === value)

											if (tour?.serviceKind === "TOUR" && tour.startTime && tour.endTime) {
												startTimeField.setValue(toHHmm(tour.startTime))
												endTimeField.setValue(toHHmm(tour.endTime))
											}

											if (tour) {
												form.setFieldValue(
													`eventBookings[${index}].priceEntries`,
													buildPriceEntriesFromTour(tour)
												)
												form.setFieldValue(
													`eventBookings[${index}].entrySnapshots`,
													buildEntrySnapshotsFromTour(tour)
												)
											}
										}}
									/>

									<arrayField.FieldError />
								</arrayField.FieldSet>
							)
						}}
					</group.AppField>

					{isTour && (
						<div className="grid gap-2 rounded-md border p-4 lg:col-span-2 lg:grid-cols-2">
							<div className="mb-2 flex items-center gap-2">
								<div className="bg-muted rounded-md p-2">
									<MountainIcon className="size-4" />
								</div>

								<div>
									<h4 className="col-span-full text-sm font-semibold">Detalles del Tour</h4>
									<span className="text-muted-foreground col-span-full text-sm">
										Seleccione un evento existente o defina un horario personalizado
									</span>
								</div>
							</div>

							<group.Subscribe
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								selector={({ values }: any) => ({
									eventId: (values.eventBookings?.[index]?.eventId ?? "") as string,
									mode: (values.eventBookings?.[index]?.mode ?? "") as string,
								})}
							>
								{({ eventId, mode }: { eventId: string; mode: string }) => {
									const isPrivate = mode === "PRIVATE"
									const hasExistingEvent = !!eventId && !isPrivate

									return (
										<>
											{!isPrivate && (
												<div className="lg:col-span-2">
													<ExistingEventSelector
														events={existingEvents}
														isLoading={loadingEvents}
														selectedEventId={eventId || undefined}
														onSelectEvent={(selectedId, startTime, endTime) => {
															form.setFieldValue(
																`eventBookings[${index}].eventId`,
																selectedId || ""
															)
															if (selectedId) {
																form.setFieldValue(
																	`eventBookings[${index}].startTime`,
																	toHHmm(startTime)
																)
																form.setFieldValue(
																	`eventBookings[${index}].endTime`,
																	toHHmm(endTime)
																)
															} else {
																form.setFieldValue(
																	`eventBookings[${index}].startTime`,
																	toHHmm(selectedTour?.startTime)
																)
																form.setFieldValue(
																	`eventBookings[${index}].endTime`,
																	toHHmm(selectedTour?.endTime)
																)
															}
														}}
													/>
												</div>
											)}

											<div className="grid gap-4 lg:col-span-2 lg:grid-cols-2">
												<group.AppField name={`eventBookings[${index}].startTime`}>
													{(field: any) => (
														<field.FieldSet>
															<field.Field>
																<field.FieldLabel htmlFor={`eventBookings[${index}].startTime`}>
																	Hora de Inicio{" "}
																	<span className="text-muted-foreground text-xs font-normal">
																		(ej: 09:00)
																	</span>
																</field.FieldLabel>

																<Input
																	type="time"
																	required={false}
																	disabled={hasExistingEvent}
																	name={`eventBookings[${index}].startTime`}
																	placeholder="09:00"
																	onBlur={field.handleBlur}
																	onChange={(e) => field.handleChange(e.target.value)}
																	value={(field.state.value as string | undefined) ?? ""}
																	aria-invalid={
																		!!field.state.meta.errors.length && field.state.meta.isTouched
																	}
																/>
															</field.Field>
															<field.FieldError />
														</field.FieldSet>
													)}
												</group.AppField>

												<group.AppField name={`eventBookings[${index}].endTime`}>
													{(field: any) => (
														<field.FieldSet>
															<field.Field>
																<field.FieldLabel htmlFor={`eventBookings[${index}].endTime`}>
																	Hora de Fin{" "}
																	<span className="text-muted-foreground text-xs font-normal">
																		(ej: 14:30)
																	</span>
																</field.FieldLabel>

																<Input
																	type="time"
																	required={false}
																	disabled={hasExistingEvent}
																	name={`eventBookings[${index}].endTime`}
																	placeholder="14:30"
																	onBlur={field.handleBlur}
																	onChange={(e) => field.handleChange(e.target.value)}
																	value={(field.state.value as string | undefined) ?? ""}
																	aria-invalid={
																		!!field.state.meta.errors.length && field.state.meta.isTouched
																	}
																/>
															</field.Field>
															<field.FieldError />
														</field.FieldSet>
													)}
												</group.AppField>
											</div>
										</>
									)
								}}
							</group.Subscribe>
						</div>
					)}

					{isTransfer && (
						<div className="grid gap-4 rounded-md border p-4 lg:col-span-2 lg:grid-cols-2">
							<h4 className="col-span-full text-sm font-semibold">Detalles del Vuelo / Transfer</h4>

							<group.AppField name={`eventBookings[${index}].flyTime`}>
								{(field: any) => (
									<field.FieldSet>
										<field.Field>
											<field.FieldLabel htmlFor={`eventBookings[${index}].flyTime`}>
												Hora de Vuelo{" "}
												<span className="text-muted-foreground text-xs font-normal">
													(ej: 14:30)
												</span>
											</field.FieldLabel>

											<Input
												required={false}
												name={"flyTime"}
												placeholder="14:30"
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												value={(field.state.value as string | undefined) ?? ""}
												aria-invalid={
													!!field.state.meta.errors.length && field.state.meta.isTouched
												}
											/>
										</field.Field>
										<field.FieldError />
									</field.FieldSet>
								)}
							</group.AppField>

							<group.AppField name={`eventBookings[${index}].flyName`}>
								{(field: any) => (
									<field.FieldSet>
										<field.Field>
											<field.FieldLabel htmlFor={`eventBookings[${index}].flyName`}>
												Nombre/Número de Vuelo
											</field.FieldLabel>

											<Input
												required={false}
												name={"flyName"}
												onBlur={field.handleBlur}
												placeholder="LA123 - LATAM"
												onChange={(e) => field.handleChange(e.target.value)}
												value={(field.state.value as string | undefined) ?? ""}
												aria-invalid={
													!!field.state.meta.errors.length && field.state.meta.isTouched
												}
											/>
										</field.Field>
										<field.FieldError />
									</field.FieldSet>
								)}
							</group.AppField>
						</div>
					)}

					{selectedTour && (
						<group.Subscribe
							selector={({ values }: any) => ({
								priceEntries: values.eventBookings?.[index]?.priceEntries || [],
								entrySnapshots: values.eventBookings?.[index]?.entrySnapshots || [],
							})}
						>
							{({
								priceEntries,
								entrySnapshots,
							}: {
								priceEntries: any[]
								entrySnapshots: any[]
							}) => {
								if (priceEntries.length === 0) {
									// Don't leave the entries section blank. Explain why this tour
									// can't be quoted so the user understands the blocked step
									// instead of assuming the form is broken.
									if (selectedTourHasNoCategories) {
										return (
											<div className="border-destructive/50 bg-destructive/5 rounded-md border p-4 lg:col-span-2">
												<div className="flex items-center gap-2">
													<AlertTriangle className="text-destructive h-4 w-4 shrink-0" />
													<h4 className="text-destructive text-sm font-semibold">
														Este tour no tiene categorías de entrada configuradas
													</h4>
												</div>
												<p className="text-muted-foreground mt-1 text-xs">
													No se puede cotizar sin categorías de precio. Elige otro tour o configura
													sus categorías antes de continuar.
												</p>
											</div>
										)
									}
									return null
								}

								return (
									<group.AppField name={`eventBookings[${index}].priceEntries`} mode="array">
										{(priceEntriesField: any) => {
											const totalPax = priceEntries.reduce(
												(sum: number, e: any) => sum + (e.count || 0),
												0
											)
											const hasValidationError =
												totalPax === 0 && priceEntriesField.state.meta.errors?.length > 0

											return (
												<div
													className={cn(
														"rounded-md border p-4 lg:col-span-2",
														hasValidationError && "border-destructive"
													)}
												>
													<div className="mb-2 flex items-center gap-2">
														<div className="bg-muted rounded-md p-2">
															<TicketIcon className="size-4" />
														</div>
														<div>
															<h4 className="text-sm font-semibold">
																Cantidad de Pasajeros por Tipo
															</h4>
														</div>
													</div>
													{totalPax === 0 && (
														<div
															className={cn(
																"mb-2 flex items-center gap-1 text-xs",
																hasValidationError
																	? "text-destructive font-medium"
																	: "text-amber-600"
															)}
														>
															<AlertTriangle className="h-3 w-3" />
															{(() => {
																const err = priceEntriesField.state.meta.errors?.[0]
																if (typeof err === "string" && err.length > 0) return err
																if (err !== null && typeof err === "object" && "message" in err) {
																	const msg = (err as { message?: unknown }).message
																	if (typeof msg === "string" && msg.length > 0) return msg
																}
																return "Se requiere al menos 1 pasajero"
															})()}
														</div>
													)}

													{/* Header labels */}
													<div className="mb-1 grid grid-cols-[1fr_80px_140px] items-center gap-3">
														<span className="text-muted-foreground text-xs font-medium">Tipo</span>
														<span className="text-muted-foreground text-xs font-medium">
															Cantidad
														</span>
														<span className="text-muted-foreground text-xs font-medium">
															Precio Tour
														</span>
													</div>

													<div className="space-y-1">
														{priceEntries.map((priceEntry: any, peIndex: number) => {
															const priceCategory = selectedTour.priceCategories.find(
																(pc) => pc.id === priceEntry.priceCategoryId
															)
															const priceWarning = isPriceOutOfBounds(
																priceEntry.price,
																priceCategory
															)

															const categoryEntryIndices: number[] = []
															entrySnapshots.forEach((snap: any, snapIdx: number) => {
																if (snap.categoryName === priceEntry.categoryName) {
																	categoryEntryIndices.push(snapIdx)
																}
															})

															return (
																<div key={priceEntry.priceCategoryId || peIndex}>
																	<div className="grid grid-cols-[1fr_80px_140px] items-center gap-3">
																		<div>
																			<span className="text-sm font-medium">
																				{priceEntry.categoryName}
																			</span>
																			{priceCategory &&
																			(priceCategory.minPrice || priceCategory.maxPrice) ? (
																				<span className="text-muted-foreground ml-2 text-xs">
																					(${priceCategory.minPrice?.toLocaleString("es-CL") ?? 0} -
																					${priceCategory.maxPrice?.toLocaleString("es-CL") ?? 0})
																				</span>
																			) : null}
																		</div>

																		<group.AppField
																			name={`eventBookings[${index}].priceEntries[${peIndex}].count`}
																		>
																			{(countField: any) => (
																				<Input
																					type="number"
																					inputMode="numeric"
																					min={0}
																					placeholder="0"
																					data-testid={
																						index === 0 && peIndex === 0
																							? "sales-input-event-passenger-count"
																							: undefined
																					}
																					value={
																						countField.state.value === 0
																							? ""
																							: (countField.state.value ?? "")
																					}
																					onBlur={() => {
																						if (
																							countField.state.value === "" ||
																							countField.state.value == null
																						) {
																							countField.handleChange(0)
																						}
																						countField.handleBlur()
																					}}
																					onChange={(e) => {
																						const val = e.target.value
																						countField.handleChange(
																							val === "" ? "" : e.target.valueAsNumber || 0
																						)
																					}}
																				/>
																			)}
																		</group.AppField>

																		<div className="relative">
																			<group.AppField
																				name={`eventBookings[${index}].priceEntries[${peIndex}].price`}
																			>
																				{(priceField: any) => (
																					<Input
																						type="number"
																						inputMode="decimal"
																						min={0}
																						placeholder="0"
																						className={cn(
																							priceWarning &&
																								"border-amber-500 focus-visible:ring-amber-500"
																						)}
																						value={
																							priceField.state.value === 0
																								? ""
																								: (priceField.state.value ?? "")
																						}
																						onBlur={() => {
																							if (
																								priceField.state.value === "" ||
																								priceField.state.value == null
																							) {
																								priceField.handleChange(0)
																							}
																							priceField.handleBlur()
																						}}
																						onChange={(e) => {
																							const val = e.target.value
																							priceField.handleChange(
																								val === "" ? "" : e.target.valueAsNumber || 0
																							)
																						}}
																					/>
																				)}
																			</group.AppField>
																			{priceWarning && (
																				<div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
																					<AlertTriangle className="h-3 w-3" />
																					Precio fuera de rango
																				</div>
																			)}
																		</div>
																	</div>

																	{categoryEntryIndices.length > 0 && (
																		<div className="border-muted-foreground/30 mt-1 mb-2 ml-6 space-y-1 border-l-2 pl-4">
																			{categoryEntryIndices.map((snapIdx) => {
																				const snap = entrySnapshots[snapIdx]
																				return (
																					<div
																						key={snapIdx}
																						className="grid grid-cols-[1fr_80px_140px] items-center gap-3"
																					>
																						<div className="flex items-center gap-1">
																							<TicketPlusIcon className="text-muted-foreground size-3 shrink-0" />
																							<span className="text-muted-foreground text-xs">
																								{snap.entryName}
																								{snap.variantName ? ` (${snap.variantName})` : ""}
																							</span>
																						</div>

																						<group.AppField
																							name={`eventBookings[${index}].entrySnapshots[${snapIdx}].count`}
																						>
																							{(snapCountField: any) => (
																								<Input
																									type="number"
																									inputMode="numeric"
																									min={0}
																									placeholder="0"
																									className="h-8 text-xs"
																									value={
																										snapCountField.state.value === 0
																											? ""
																											: (snapCountField.state.value ?? "")
																									}
																									onBlur={() => {
																										if (
																											snapCountField.state.value === "" ||
																											snapCountField.state.value == null
																										) {
																											snapCountField.handleChange(0)
																										}
																										snapCountField.handleBlur()
																									}}
																									onChange={(e) => {
																										const val = e.target.value
																										snapCountField.handleChange(
																											val === "" ? "" : e.target.valueAsNumber || 0
																										)
																									}}
																								/>
																							)}
																						</group.AppField>

																						<group.AppField
																							name={`eventBookings[${index}].entrySnapshots[${snapIdx}].price`}
																						>
																							{(snapPriceField: any) => (
																								<Input
																									type="number"
																									inputMode="decimal"
																									min={0}
																									placeholder="0"
																									className="h-8 text-xs"
																									value={
																										snapPriceField.state.value === 0
																											? ""
																											: (snapPriceField.state.value ?? "")
																									}
																									onBlur={() => {
																										if (
																											snapPriceField.state.value === "" ||
																											snapPriceField.state.value == null
																										) {
																											snapPriceField.handleChange(0)
																										}
																										snapPriceField.handleBlur()
																									}}
																									onChange={(e) => {
																										const val = e.target.value
																										snapPriceField.handleChange(
																											val === "" ? "" : e.target.valueAsNumber || 0
																										)
																									}}
																								/>
																							)}
																						</group.AppField>
																					</div>
																				)
																			})}
																		</div>
																	)}
																</div>
															)
														})}
													</div>
												</div>
											)
										}}
									</group.AppField>
								)
							}}
						</group.Subscribe>
					)}

					<group.AppField name={`eventBookings[${index}].comments`}>
						{(field: any) => (
							<field.FieldSet className="w-full lg:col-span-2">
								<field.Field>
									<field.FieldLabel htmlFor={`eventBookings[${index}].comments`}>
										Comentarios
									</field.FieldLabel>
									<Textarea
										required={false}
										disabled={false}
										className="h-24"
										onBlur={field.handleBlur}
										name={`eventBookings[${index}].comments`}
										onChange={(e) => field.handleChange(e.target.value)}
										value={(field.state.value as string | undefined) ?? ""}
										placeholder="Comentarios adicionales sobre este tour (opcional)"
										aria-invalid={!!field.state.meta.errors.length && field.state.meta.isTouched}
									/>
								</field.Field>
								<field.FieldError />
							</field.FieldSet>
						)}
					</group.AppField>

					{onRemove && (
						<div className="flex justify-end lg:col-span-2">
							<Button
								type="button"
								variant="destructive"
								size="sm"
								className="gap-1"
								onClick={onRemove}
							>
								<Trash2 className="h-4 w-4" />
								Eliminar{tourName ? ` ${tourName}` : ""}
							</Button>
						</div>
					)}
				</div>
			</AccordionContent>
		</AccordionItem>
	)
}

interface EventBookingsArrayProps {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	field: any
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	group: any
	availableTours: ActiveTour[] | undefined
}

/**
 * Renders the eventBookings accordion with a controlled open state so every
 * event item appears expanded by default. The accordion was previously
 * uncontrolled (`defaultValue`), which only opens items present at the first
 * render — appended events came collapsed, and the very first item could also
 * render collapsed because its value identity changes after mount (the
 * field-group default clientId is replaced by the parent form's, and drafts
 * are restored via setFieldValue post-mount).
 *
 * An effect auto-expands each item exactly once (tracked in `autoOpenedRef` by
 * `tour-${clientId}`), so new/late-arriving items open while items the user
 * manually collapsed stay collapsed.
 */
function EventBookingsArray({ field, group, availableTours }: EventBookingsArrayProps) {
	const bookings = field.state.value as Array<{
		clientId?: string
		date?: Date
		flyDate?: Date
	}>
	const accordionValueFor = (booking: { clientId?: string }, index: number) =>
		`tour-${booking.clientId ?? index}`

	const [openItems, setOpenItems] = useState<string[]>(() => bookings.map(accordionValueFor))
	const autoOpenedRef = useRef<Set<string>>(new Set(openItems))
	// Derived signature so the effect reacts to clientId/length changes even if
	// the array-mode field reuses the same array reference.
	const bookingsSignature = bookings.map((b, i) => b.clientId ?? i).join("|")

	useEffect(() => {
		const fresh = bookings
			.map((booking, index) => `tour-${booking.clientId ?? index}`)
			.filter((value) => !autoOpenedRef.current.has(value))
		if (fresh.length === 0) return
		fresh.forEach((value) => autoOpenedRef.current.add(value))
		setOpenItems((prev) => [...prev, ...fresh])
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [bookingsSignature])

	// Removes a booking by its real index (not always the last one), then prunes
	// that item's accordion open-state so the remaining items keep their state.
	const removeBookingAt = (index: number) => {
		const removedValue = accordionValueFor(bookings[index], index)
		field.removeValue(index)
		setOpenItems((prev) => prev.filter((value) => value !== removedValue))
		autoOpenedRef.current.delete(removedValue)
	}

	return (
		<div className="w-full space-y-4">
			<Accordion type="multiple" value={openItems} onValueChange={setOpenItems}>
				{bookings.map((eventBooking, index: number) => (
					<EventBookingItem
						key={eventBooking.clientId || index}
						form={field.form}
						index={index}
						accordionValue={accordionValueFor(eventBooking, index)}
						availableTours={availableTours}
						arrayField={field}
						group={group}
						onRemove={bookings.length > 1 ? () => removeBookingAt(index) : undefined}
					/>
				))}
			</Accordion>

			<div className="flex justify-start pt-2">
				<Button
					variant="outline"
					type="button"
					onClick={() => {
						const previous = bookings[bookings.length - 1]
						const newBooking = createEventBooking({
							date: previous?.date,
							flyDate: previous?.flyDate,
						})
						field.pushValue(newBooking, { dontValidate: true })
						// The effect above auto-expands the newly added item.
					}}
				>
					<Plus className="h-4 w-4" /> Agregar Tour/Evento
				</Button>
			</div>
		</div>
	)
}

export const EventsFormGroup = withFieldGroup({
	defaultValues: {
		eventBookings: [createEventBooking()],
	},
	render: function Step2Render({ group }) {
		const { data: availableTours } = useActiveTours()

		return (
			<div className="space-y-4">
				<CardHeader className="gap-0">
					<CardTitle className="text-2xl font-bold">Detalle de Evento/Tour</CardTitle>
					<CardDescription>Agregar uno o más tours para esta venta/cotización</CardDescription>
				</CardHeader>

				<CardContent>
					<group.AppField name="eventBookings" mode="array">
						{(field) => (
							<EventBookingsArray field={field} group={group} availableTours={availableTours} />
						)}
					</group.AppField>
				</CardContent>
			</div>
		)
	},
})
