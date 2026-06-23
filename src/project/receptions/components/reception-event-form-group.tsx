"use client"

import { Plus, Trash2, CalendarIcon, AlertTriangle, TicketIcon, TicketPlusIcon } from "lucide-react"
import { Alert, AlertDescription } from "@/shared/components/ui/alert"
import { es } from "date-fns/locale"
import { format } from "date-fns"
import { useEffect, useMemo } from "react"
import { useField } from "@tanstack/react-form"
import { useQuery } from "@tanstack/react-query"

import {
	useActiveTours,
	type ActiveTour,
} from "@/project/tours/hooks/use-tours"
import {
	buildPriceEntriesFromTour,
	buildEntrySnapshotsFromTour,
	isPriceOutOfBounds,
} from "@/project/tours/utils/tour-form-helpers"
import { getExistingEventsForTour } from "@/project/sales/actions/event-query.actions"
import { getFutureEventsForTour } from "@/project/events/actions/event.actions"
import { calendarDayKey } from "@/shared/utils/calendar-day"
import { ExistingEventSelector } from "@/project/sales/components/sale-quote-form/existing-event-selector"
import { TourSearchSelect } from "@/shared/components/tour-search-select"
import { cn } from "@/lib/utils"

import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover"
import {
	CardContent,
	CardDescription,
	CardTitle,
} from "@/shared/components/ui/card"
import {
	Accordion,
	AccordionItem,
	AccordionTrigger,
	AccordionContent,
} from "@/shared/components/ui/accordion"
import { AgencySearchSelect } from "@/shared/components/agency-search-select"
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
import { withFieldGroup } from "@/shared/components/ui/tanstack-form"
import { createClientId } from "@/shared/lib/create-client-id"
import { useReceptionFormStore } from "../stores/reception-form.store"
import { Separator } from "@/shared/components/ui/separator"

// ---------------------------------------------------------------------------
// PaymentStatusField — extracted so useEffect can safely reset the value when
// hasEntries changes without triggering state updates during render.
// ---------------------------------------------------------------------------

interface PaymentStatusFieldProps {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	group: any
	availableTours: ActiveTour[] | undefined
}

function PaymentStatusField({ group, availableTours }: PaymentStatusFieldProps) {
	const paymentStatusField = useField({ form: group.form, name: "paymentStatus" })

	return (
		<group.Subscribe
			selector={({ values }: any) => values.eventDetails ?? []}
		>
			{(eventDetails: any[]) => {
				const hasEntries = eventDetails.some((ed: any) => {
					const tour = availableTours?.find((t: ActiveTour) => t.id === ed.tourId)
					return tour?.priceCategories.some((pc) => pc.entries?.length > 0)
				})

				return (
					<PaymentStatusSelect
						group={group}
						hasEntries={hasEntries}
						paymentStatusField={paymentStatusField}
					/>
				)
			}}
		</group.Subscribe>
	)
}

interface PaymentStatusSelectProps {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	group: any
	hasEntries: boolean
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	paymentStatusField: any
}

function PaymentStatusSelect({ group, hasEntries, paymentStatusField }: PaymentStatusSelectProps) {
	const currentValue = paymentStatusField.state.value
	useEffect(() => {
		if (currentValue === "ENTRANCE_ONLY" && !hasEntries) {
			paymentStatusField.handleChange("PENDING")
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [hasEntries, currentValue])

	return (
		<group.AppField name="paymentStatus">
			{(field: any) => (
				<field.FieldSet>
					<field.Field>
						<field.FieldLabel className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
							Estado de Pago <span className="text-primary">*</span>
						</field.FieldLabel>
					</field.Field>

					<Select value={field.state.value} onValueChange={field.handleChange}>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Seleccione estado" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="PENDING">Pendiente</SelectItem>
							{hasEntries && (
								<SelectItem value="ENTRANCE_ONLY">Pago Solo Entradas</SelectItem>
							)}
							<SelectItem value="TOUR_ONLY">Pago Solo Tour</SelectItem>
							<SelectItem value="FULLY_PAID">Pagado Totalmente</SelectItem>
						</SelectContent>
					</Select>

					{field.state.value === "ENTRANCE_ONLY" && !hasEntries && (
						<Alert className="border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
							<AlertTriangle className="h-4 w-4 text-amber-600" />
							<AlertDescription className="text-amber-800 dark:text-amber-200">
								Este tour no tiene entradas configuradas. El pago será solo por el tour.
							</AlertDescription>
						</Alert>
					)}

					{field.state.value === "ENTRANCE_ONLY" && hasEntries && (
						<p className="text-muted-foreground text-sm">
							Solo se registrará el pago de las entradas.
						</p>
					)}

					<field.FieldError />
				</field.FieldSet>
			)}
		</group.AppField>
	)
}

// ---------------------------------------------------------------------------
// EventDetailItem — extracted so hooks (useField, useQuery) can be called
// at the top level of a component, not inside a map callback.
// ---------------------------------------------------------------------------

interface EventDetailItemProps {
	index: number
	availableTours: ActiveTour[] | undefined
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	group: any
	canRemove: boolean
	onRemove: () => void
}

function EventDetailItem({
	index,
	availableTours,
	group,
	canRemove,
	onRemove,
}: EventDetailItemProps) {
	const tourIdField = useField({
		form: group.form,
		name: `eventDetails[${index}].tourId`,
	})

	const dateField = useField({
		form: group.form,
		name: `eventDetails[${index}].date`,
	})

	const eventIdField = useField({
		form: group.form,
		name: `eventDetails[${index}].eventId`,
	})

	const tourId = tourIdField.state.value as string

	const selectedTour = availableTours?.find(
		(t: ActiveTour) => t.id === tourId
	)
	const isTransfer = selectedTour?.serviceKind === "TRANSFER"
	const isTour = selectedTour?.serviceKind === "TOUR"
	const tourName = selectedTour?.name

	// Query future events for the selected tour — used to filter the date picker
	const { data: futureEvents } = useQuery({
		queryKey: ["future-events-for-tour", tourId, "with-past-30"],
		queryFn: () => getFutureEventsForTour(tourId, undefined, 30),
		enabled: !!tourId && isTour,
		staleTime: 60_000,
	})

	const availableDateSet = useMemo(() => {
		const set = new Set<string>()
		if (futureEvents) {
			for (const event of futureEvents) {
				// Event.date is @db.Date (UTC midnight) — read UTC components via
				// calendarDayKey so the set key is correct on negative-offset timezones.
				set.add(calendarDayKey(new Date(event.date)))
			}
		}
		return set
	}, [futureEvents])

	const dateValue = dateField.state.value as Date | undefined
	const dateKey = dateValue?.toISOString?.().split("T")[0] ?? null

	const { data: existingEvents, isLoading: loadingEvents } = useQuery({
		queryKey: ["existing-events", tourIdField.state.value, dateKey],
		queryFn: () =>
			getExistingEventsForTour({
				tourId: tourIdField.state.value as string,
				date: dateValue as Date,
				mode: "REGULAR",
			}),
		enabled: !!tourIdField.state.value && !!dateValue && isTour,
		staleTime: 30_000,
	})

	return (
		<AccordionItem value={`tour-${index}`}>
			<AccordionTrigger className="text-base font-medium">
				<span className="flex items-center gap-2 flex-1">
					<span className="text-muted-foreground">Tour {index + 1}.</span>
					{tourName ? tourName : "Sin Tour"}
				</span>
				{canRemove && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={(e) => {
							e.stopPropagation()
							onRemove()
						}}
						className="text-destructive hover:text-destructive h-8 w-8 p-0 mr-2"
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				)}
			</AccordionTrigger>

			<AccordionContent className="h-fit">
				<div className="grid grid-cols-1 gap-x-4 gap-y-5 pb-6 lg:grid-cols-2">
					{/* Tour selector (FIRST) */}
					<group.AppField name={`eventDetails[${index}].tourId`}>
						{(subField: any) => (
							<div>
								<label className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
									Tour/Evento <span className="text-primary">*</span>
								</label>
								<TourSearchSelect
									tours={availableTours}
									value={subField.state.value}
									onValueChange={(value) => {
										subField.handleChange(value)
										;(group as any).setFieldValue(`eventDetails[${index}].eventId`, "")
										;(group as any).setFieldValue(`eventDetails[${index}].date`, undefined)
										const tour = availableTours?.find(
											(t: ActiveTour) => t.id === value
										)
										if (
											tour?.serviceKind === "TOUR" &&
											tour.startTime &&
											tour.endTime
										) {
											group.setFieldValue(
												`eventDetails[${index}].startTime`,
												tour.startTime
											)
											group.setFieldValue(
												`eventDetails[${index}].endTime`,
												tour.endTime
											)
										}
										if (tour) {
											;(group as any).setFieldValue(
												`eventDetails[${index}].priceEntries`,
												buildPriceEntriesFromTour(tour)
											)
											;(group as any).setFieldValue(
												`eventDetails[${index}].entrySnapshots`,
												buildEntrySnapshotsFromTour(tour)
											)
										}
									}}
								/>
								{subField.state.meta.errors ? (
									<p className="text-destructive text-sm">
										{subField.state.meta.errors.join(", ")}
									</p>
								) : null}
							</div>
						)}
					</group.AppField>

					{/* Date — only enabled after tour is selected, filtered to dates with events */}
					<group.AppField name={`eventDetails[${index}].date`}>
						{(subField: any) => {
							const hasTour = !!tourId
							const hasAvailableDates = availableDateSet.size > 0
							return (
								<div>
									<label className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
										Fecha del Evento <span className="text-primary">*</span>
									</label>
									<Popover>
										<PopoverTrigger asChild>
											<Button
												variant="outline"
												disabled={!hasTour}
												className={cn(
													"w-full justify-start text-left font-normal",
													!subField.state.value && "text-muted-foreground"
												)}
											>
												<CalendarIcon className="h-4 w-4" />
												{!hasTour ? (
													<span>Seleccione un tour primero</span>
												) : subField.state.value ? (
													format(subField.state.value, "PPP", { locale: es })
												) : (
													<span>Seleccione fecha</span>
												)}
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0" align="start">
											<Calendar
												mode="single"
												selected={subField.state.value}
												onSelect={subField.handleChange}
												disabled={(date) => {
													if (isTour && hasAvailableDates) {
														const dateStr = date.toISOString().split("T")[0]
														return !availableDateSet.has(dateStr)
													}
													return false
												}}
												initialFocus
												locale={es}
											/>
										</PopoverContent>
									</Popover>
									{isTour && hasTour && !hasAvailableDates && (
										<p className="text-muted-foreground text-xs mt-1">
											No hay eventos futuros para este tour.
										</p>
									)}
									{subField.state.meta.errors ? (
										<p className="text-destructive text-sm">
											{subField.state.meta.errors.join(", ")}
										</p>
									) : null}
								</div>
							)
						}}
					</group.AppField>

					{/* TOUR: ExistingEventSelector (spans 2 cols) */}
					{isTour && (
						<div className="lg:col-span-2">
							{loadingEvents ? (
								<div className="text-muted-foreground text-sm">
									Cargando eventos existentes...
								</div>
							) : existingEvents && existingEvents.length > 0 ? (
								<ExistingEventSelector
									events={existingEvents}
									isLoading={loadingEvents}
									allowNewEvent={false}
									selectedEventId={eventIdField.state.value as string | undefined}
									onSelectEvent={(selectedId, startTime, endTime) => {
										;(group as any).setFieldValue(
											`eventDetails[${index}].eventId`,
											selectedId || ""
										)
										if (startTime) {
											group.setFieldValue(
												`eventDetails[${index}].startTime`,
												startTime
											)
										}
										if (endTime) {
											group.setFieldValue(
												`eventDetails[${index}].endTime`,
												endTime
											)
										}
									}}
								/>
							) : isTour && tourIdField.state.value && dateValue ? (
								<div className="flex items-center gap-1 text-sm text-amber-600">
									<AlertTriangle className="h-4 w-4" />
									No hay eventos disponibles para esta fecha y tour
								</div>
							) : null}
						</div>
					)}

					{/* TRANSFER: fly details (spans 2 cols) */}
					{isTransfer && (
						<div className="lg:col-span-2 space-y-4">
							<div className="grid gap-4 md:grid-cols-2">
								<group.AppField name={`eventDetails[${index}].flyDate`}>
									{(subField: any) => (
										<div>
											<label className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
												Fecha de Vuelo
											</label>
											<Input
												value={subField.state.value}
												onChange={(e) => subField.handleChange(e.target.value)}
												type="date"
												placeholder="2024-01-01"
											/>
											<p className="text-muted-foreground text-sm">Fecha del vuelo</p>
										</div>
									)}
								</group.AppField>
								<group.AppField name={`eventDetails[${index}].flyTime`}>
									{(subField: any) => (
										<div>
											<label className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
												Hora de Vuelo
											</label>
											<Input
												value={subField.state.value}
												onChange={(e) => subField.handleChange(e.target.value)}
												type="time"
												placeholder="14:30"
											/>
											<p className="text-muted-foreground text-sm">Hora del vuelo</p>
										</div>
									)}
								</group.AppField>
							</div>

							<group.AppField name={`eventDetails[${index}].flyName`}>
								{(subField: any) => (
									<div>
										<label className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
											Nombre/Número de Vuelo
										</label>
										<Input
											value={subField.state.value}
											onChange={(e) => subField.handleChange(e.target.value)}
											placeholder="LA123 - LATAM"
										/>
										<p className="text-muted-foreground text-sm">
											Aerolínea y número de vuelo (ej: LA123, JA456)
										</p>
									</div>
								)}
							</group.AppField>
						</div>
					)}
				</div>

				{isTour && selectedTour && existingEvents?.length === 0 && !loadingEvents && (
					<Alert className="border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
						<AlertTriangle className="h-4 w-4 text-amber-600" />
						<AlertDescription className="text-amber-800 dark:text-amber-200">
							No hay eventos disponibles para la fecha seleccionada. Creá un evento primero.
						</AlertDescription>
					</Alert>
				)}

				{selectedTour && !(isTour && existingEvents?.length === 0 && !loadingEvents) && (
					<group.Subscribe
						selector={({ values }: any) => ({
							priceEntries:
								values.eventDetails?.[index]?.priceEntries || [],
							entrySnapshots:
								values.eventDetails?.[index]?.entrySnapshots || [],
							passengers: values.passengers || [],
						})}
					>
						{({
							priceEntries,
							entrySnapshots,
							passengers,
						}: {
							priceEntries: any[]
							entrySnapshots: any[]
							passengers: any[]
						}) => {
							if (priceEntries.length === 0) return null

							return (
								<group.AppField
									name={`eventDetails[${index}].priceEntries` as any}
									mode="array"
								>
									{(priceEntriesField: any) => {
										const totalPax = priceEntries.reduce(
											(sum: number, e: any) => sum + (e.count || 0),
											0
										)
										const hasValidationError =
											totalPax === 0 &&
											priceEntriesField.state.meta.errors?.length > 0

										const selectedEvent = existingEvents?.find(
											(ev) => ev.id === eventIdField.state.value
										)
										const remainingCapacity =
											selectedEvent != null
												? selectedEvent.maxCapacity - selectedEvent.currentBookings
												: undefined

										const hasZeroPriceWithCount = priceEntries.some(
											(e: any) => e.count > 0 && (e.reception === 0 || e.reception === "" || e.reception == null)
										)

										return (
											<div
												className={cn(
													"rounded-md border p-4",
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
														Se requiere al menos 1 pasajero
													</div>
												)}

												{/* Header labels */}
												<div className="mb-1 grid grid-cols-[1fr_80px_140px] items-center gap-3">
													<span className="text-muted-foreground text-xs font-medium">
														Tipo
													</span>
													<span className="text-muted-foreground text-xs font-medium">
														Cantidad
													</span>
													<span className="text-muted-foreground text-xs font-medium">
														Precio Recepción
													</span>
												</div>

												<div className="space-y-1">
													{priceEntries.map(
														(priceEntry: any, peIndex: number) => {
															const priceCategory =
																selectedTour.priceCategories.find(
																	(pc) =>
																		pc.id === priceEntry.priceCategoryId
																)
															const priceWarning = isPriceOutOfBounds(
																priceEntry.reception,
																priceCategory
															)

															const categoryEntryIndices: number[] = []
															entrySnapshots.forEach(
																(snap: any, snapIdx: number) => {
																	if (
																		snap.categoryName ===
																		priceEntry.categoryName
																	) {
																		categoryEntryIndices.push(snapIdx)
																	}
																}
															)

															// Age-based warning: compare selected count vs passengers in age range
															let ageWarning: string | null = null
															if (
																priceCategory &&
																(priceCategory.ageMin !== null ||
																	priceCategory.ageMax !== null) &&
																passengers.length > 0 &&
																priceEntry.count > 0
															) {
																const ageMin = priceCategory.ageMin ?? 0
																const ageMax =
																	priceCategory.ageMax ?? 999
																const matchingPassengers =
																	passengers.filter((p: any) => {
																		const age = p.age
																			? Number(p.age)
																			: null
																		if (
																			age === null ||
																			isNaN(age)
																		)
																			return false
																		return (
																			age >= ageMin && age <= ageMax
																		)
																	}).length
																if (
																	priceEntry.count >
																	matchingPassengers
																) {
																	ageWarning = `${priceEntry.categoryName}: ${priceEntry.count} seleccionados pero solo ${matchingPassengers} pasajero(s) en rango de edad (${ageMin}-${ageMax})`
																}
															}

															return (
																<div
																	key={
																		priceEntry.priceCategoryId ||
																		peIndex
																	}
																>
																	<div className="grid grid-cols-[1fr_80px_140px] items-center gap-3">
																		<div>
																			<span className="text-sm font-medium">
																				{priceEntry.categoryName}
																			</span>
																			{priceCategory &&
																			(priceCategory.minPrice ||
																				priceCategory.maxPrice) ? (
																				<span className="text-muted-foreground ml-2 text-xs">
																					($
																					{priceCategory.minPrice?.toLocaleString(
																						"es-CL"
																					) ?? 0}{" "}
																					- $
																					{priceCategory.maxPrice?.toLocaleString(
																						"es-CL"
																					) ?? 0}
																					)
																				</span>
																			) : null}
																		</div>

																		<group.AppField
																			name={`eventDetails[${index}].priceEntries[${peIndex}].count` as any}
																		>
																			{(countField: any) => (
																				<Input
																					type="number"
																					inputMode="numeric"
																					min={0}
																					max={remainingCapacity}
																					placeholder="0"
																					value={
																						countField.state
																							.value === 0
																							? ""
																							: (countField.state
																									.value ?? "")
																					}
																					onBlur={() => {
																						if (
																							countField.state
																								.value === "" ||
																							countField.state
																								.value == null
																						) {
																							countField.handleChange(
																								0
																							)
																						}
																						countField.handleBlur()
																					}}
																					onChange={(e) => {
																						const val =
																							e.target.value
																						countField.handleChange(
																							val === ""
																								? ""
																								: e.target
																										.valueAsNumber ||
																										0
																						)
																					}}
																				/>
																			)}
																		</group.AppField>

																		<div className="relative">
																			<group.AppField
																				name={`eventDetails[${index}].priceEntries[${peIndex}].reception` as any}
																			>
																				{(receptionField: any) => (
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
																							receptionField.state
																								.value === 0
																								? ""
																								: (receptionField
																										.state
																										.value ?? "")
																						}
																						onBlur={() => {
																							if (
																								receptionField
																									.state
																									.value ===
																									"" ||
																								receptionField
																									.state
																									.value == null
																							) {
																								receptionField.handleChange(
																									0
																								)
																							}
																							receptionField.handleBlur()
																						}}
																						onChange={(e) => {
																							const val =
																								e.target.value
																							receptionField.handleChange(
																								val === ""
																									? ""
																									: e.target
																											.valueAsNumber ||
																											0
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

																	{ageWarning && (
																		<div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
																			<AlertTriangle className="h-3 w-3" />
																			{ageWarning}
																		</div>
																	)}

																	{categoryEntryIndices.length > 0 && (
																		<div className="border-muted ml-4 mt-1 mb-2 space-y-1 border-l-2 pl-3">
																			{categoryEntryIndices.map(
																				(snapIdx) => {
																					const snap =
																						entrySnapshots[snapIdx]
																					return (
																						<div
																							key={snapIdx}
																							className="grid grid-cols-[1fr_80px_140px] items-center gap-3"
																						>
																							<div className="flex items-center gap-1">
																								<TicketPlusIcon className="text-muted-foreground size-3 shrink-0" />
																								<span className="text-muted-foreground text-xs">
																									{snap.entryName}
																									{snap.variantName
																										? ` (${snap.variantName})`
																										: ""}
																								</span>
																							</div>

																							<group.AppField
																								name={`eventDetails[${index}].entrySnapshots[${snapIdx}].count` as any}
																							>
																								{(
																									snapCountField: any
																								) => (
																									<Input
																										type="number"
																										inputMode="numeric"
																										min={0}
																										placeholder="0"
																										className="h-8 text-xs"
																										value={
																											snapCountField
																												.state
																												.value ===
																											0
																												? ""
																												: (snapCountField
																														.state
																														.value ??
																													"")
																										}
																										onBlur={() => {
																											if (
																												snapCountField
																													.state
																													.value ===
																													"" ||
																												snapCountField
																													.state
																													.value ==
																													null
																											) {
																												snapCountField.handleChange(
																													0
																												)
																											}
																											snapCountField.handleBlur()
																										}}
																										onChange={(
																											e
																										) => {
																											const val =
																												e.target
																													.value
																											snapCountField.handleChange(
																												val ===
																													""
																													? ""
																													: e
																															.target
																															.valueAsNumber ||
																															0
																											)
																										}}
																									/>
																								)}
																							</group.AppField>

																							<span className="text-muted-foreground text-xs">
																								$
																								{snap.price?.toLocaleString(
																									"es-CL"
																								) ?? 0}
																							</span>
																						</div>
																					)
																				}
																			)}
																		</div>
																	)}
																</div>
															)
														}
													)}
												</div>
												{hasZeroPriceWithCount && (
													<Alert className="mt-3 border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
														<AlertTriangle className="h-4 w-4 text-amber-600" />
														<AlertDescription className="text-amber-800 dark:text-amber-200">
															Uno o más tipos de pasajero tienen precio de recepción $0. Verificá antes de confirmar.
														</AlertDescription>
													</Alert>
												)}
											</div>
										)
									}}
								</group.AppField>
							)
						}}
					</group.Subscribe>
				)}

				{/* Comments */}
				<group.AppField name={`eventDetails[${index}].comments`}>
					{(subField: any) => (
						<div className="mt-5">
							<label className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
								Comentarios
							</label>
							<Textarea
								value={subField.state.value}
								onChange={(e) => subField.handleChange(e.target.value)}
								placeholder="Comentarios adicionales sobre este tour (opcional)"
								rows={3}
								className="resize-none"
							/>
						</div>
					)}
				</group.AppField>
			</AccordionContent>
		</AccordionItem>
	)
}

// ---------------------------------------------------------------------------
// Default event detail object — single source of truth
// ---------------------------------------------------------------------------
function createEventDetail() {
	return {
		clientId: createClientId(),
		date: new Date(),
		mode: "REGULAR",
		tourId: "",
		eventId: "",
		comments: "",
		startTime: "",
		endTime: "",
		flyTime: "",
		flyDate: "",
		flyName: "",
		priceEntries: [],
		entrySnapshots: [],
	}
}

// ---------------------------------------------------------------------------
// ReceptionEventFormGroup
// ---------------------------------------------------------------------------
export const ReceptionEventFormGroup = withFieldGroup({
	defaultValues: {
		date: new Date(),
		type: "",
		paymentStatus: "PENDING",
		eventDetails: [createEventDetail()],
		agencyId: "",
		comments: "",
	},
	render: function Step1Render({ group }) {
		const { data: availableTours } = useActiveTours()
		const { setAgencyName } = useReceptionFormStore()

		return (
			<CardContent className="space-y-4">
				<div className="gap-0">
					<CardTitle className="text-2xl font-bold">Información del Evento</CardTitle>
					<CardDescription>Información maestra del evento</CardDescription>
				</div>

				<div className="grid gap-4">
					<group.AppField name="agencyId">
						{(field) => (
							<field.FieldSet>
								<field.Field>
									<field.FieldLabel className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
										Agencia <span className="text-primary">*</span>
									</field.FieldLabel>
								</field.Field>

								<AgencySearchSelect
									activeOnly
									agencyCatalog="TRANSFER"
									value={field.state.value}
									onValueChange={(value) => {
										field.handleChange(value)
										setAgencyName(value)
									}}
									placeholder="Seleccione una agencia"
								/>

								<field.FieldDescription className="text-muted-foreground text-sm">
									Selecciona la agencia asociada a este traslado
								</field.FieldDescription>

								<field.FieldError />
							</field.FieldSet>
						)}
					</group.AppField>

					<PaymentStatusField group={group} availableTours={availableTours} />
				</div>

				<Separator />

				<group.AppField name="eventDetails" mode="array">
					{(field) => {
						return (
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<div>
										<h3 className="text-lg font-semibold">Tours del Evento</h3>
										<p className="text-muted-foreground text-sm">
											Agrega uno o más tours para esta venta/cotización
										</p>
									</div>

									<div className="flex items-center gap-2">
										<Button
											size="sm"
											type="button"
											variant="outline"
											onClick={() => field.pushValue(createEventDetail())}
										>
											<Plus className="h-4 w-4" />
											Agregar Tour
										</Button>

										<Button
											variant="outline"
											type="button"
											onClick={() => field.removeValue(field.state.value.length - 1)}
											disabled={field.state.value.length <= 1}
										>
											<Trash2 className="h-4 w-4" /> Eliminar
										</Button>
									</div>
								</div>

								{field.state.value.length === 0 && (
									<div className="rounded-lg border-2 border-dashed py-8 text-center">
										<p className="text-muted-foreground mb-4">No hay tours agregados</p>
										<Button
											type="button"
											onClick={() => field.pushValue(createEventDetail())}
											variant="outline"
										>
											<Plus className="h-4 w-4" />
											Agregar Primer Tour
										</Button>
									</div>
								)}

								<Accordion
									type="multiple"
									defaultValue={field.state.value.map((_: any, i: number) => `tour-${i}`)}
								>
									{field.state.value.map((eventDetail: any, index: number) => (
										<EventDetailItem
											key={eventDetail.clientId || index}
											index={index}
											availableTours={availableTours}
											group={group}
											canRemove={field.state.value.length > 1}
											onRemove={() => field.removeValue(index)}
										/>
									))}
								</Accordion>
							</div>
						)
					}}
				</group.AppField>
			</CardContent>
		)
	},
})
