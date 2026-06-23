"use client"

import { CalendarIcon, Plus, Trash2, Copy } from "lucide-react"
import { es } from "date-fns/locale"
import { format } from "date-fns"
import { toast } from "sonner"

import { NationalitySelect } from "@/project/sales/components/nationality-select"
import { DIET_TYPE, DIET_OPTIONS } from "@/project/sales/constants/enums"

import { withFieldGroup } from "@/shared/components/ui/tanstack-form"
import { createClientId } from "@/shared/lib/create-client-id"
import { cn } from "@/lib/utils"

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/shared/components/ui/accordion"
import { Badge } from "@/shared/components/ui/badge"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select"
import { Textarea } from "@/shared/components/ui/textarea"
import { Calendar } from "@/shared/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover"


const defaultPassenger = {
	clientId: "",
	name: "",
	rut: "",
	age: undefined as number | undefined,
	nacionality: "",
	diet_type: undefined as (typeof DIET_TYPE)[number] | undefined,
	dietOther: "",
	allergies: [] as string[],
	hotels: [] as Array<{
		clientId?: string
		hotelName?: string
		checkIn?: Date
		checkOut?: Date
		order: number
	}>,
	phone: "",
	email: "",
}

export const ReceptionPassengersFormGroup = withFieldGroup({
	defaultValues: {
		passengers: [{ ...defaultPassenger, clientId: createClientId() }],
	},
	render: function PassengersRender({ group }) {
		return (
			<group.AppField name="passengers" mode="array">
				{(field: any) => <PassengersInner group={group} field={field} />}
			</group.AppField>
		)
	},
})

interface PassengersInnerProps {
	group: any
	field: any
}

function PassengersInner({ group, field }: PassengersInnerProps) {
	const passengers = (field.state.value || []) as (typeof defaultPassenger)[]

	const defaultAccordionValues = passengers.map((_: unknown, i: number) => `passenger-${i}`)

	return (
		<div className="space-y-4 p-4">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-lg font-semibold">Detalle de Pasajeros</h3>
					<p className="text-muted-foreground text-sm">
						Agrega uno o más pasajeros para esta recepción. Puedes dejar vacío los campos que no
						apliquen.
					</p>
				</div>
				<Badge variant="secondary" className="text-sm">
					{passengers.length} pasajeros
				</Badge>
			</div>

			<div className="w-full space-y-4">
				<Accordion type="multiple" defaultValue={defaultAccordionValues}>
					{field.state.value.map((passenger: typeof defaultPassenger, index: number) => (
						<AccordionItem key={passenger.clientId || index} value={`passenger-${index}`}>
							<AccordionTrigger className="text-base font-medium">
								<span className="text-muted-foreground">{index + 1}. </span>
								{passenger.name ? passenger.name : "Sin nombre"}
							</AccordionTrigger>

							<AccordionContent className="h-fit">
								<div className="grid grid-cols-1 gap-x-4 gap-y-5 pb-6 lg:grid-cols-2">
									{/* Name */}
									<group.AppField name={`passengers[${index}].name`}>
										{(subField: any) => (
											<subField.FieldSet className="w-full">
												<subField.Field>
													<subField.FieldLabel htmlFor={`passengers[${index}].name`}>
														Nombre Completo <span className="text-primary">*</span>
													</subField.FieldLabel>
													<Input
														name={`passengers[${index}].name`}
														placeholder="Juan Pérez González"
														type="text"
														value={(subField.state.value as string | undefined) ?? ""}
														onBlur={subField.handleBlur}
														onChange={(e) => subField.handleChange(e.target.value)}
														aria-invalid={
															!!subField.state.meta.errors.length && subField.state.meta.isTouched
														}
													/>
												</subField.Field>
												<subField.FieldError />
											</subField.FieldSet>
										)}
									</group.AppField>

									{/* RUT */}
									<group.AppField name={`passengers[${index}].rut`}>
										{(subField: any) => (
											<subField.FieldSet className="w-full">
												<subField.Field>
													<subField.FieldLabel htmlFor={`passengers[${index}].rut`}>
														RUT / Pasaporte
													</subField.FieldLabel>
													<Input
														name={`passengers[${index}].rut`}
														placeholder="12.345.678-9 o AB123456"
														type="text"
														value={(subField.state.value as string | undefined) ?? ""}
														onBlur={subField.handleBlur}
														onChange={(e) => subField.handleChange(e.target.value)}
														aria-invalid={
															!!subField.state.meta.errors.length && subField.state.meta.isTouched
														}
													/>
												</subField.Field>
												<subField.FieldError />
											</subField.FieldSet>
										)}
									</group.AppField>

									{/* Age */}
									<group.AppField name={`passengers[${index}].age`}>
										{(subField: any) => (
											<subField.FieldSet className="w-full">
												<subField.Field>
													<subField.FieldLabel htmlFor={`passengers[${index}].age`}>
														Edad
													</subField.FieldLabel>
													<Input
														name={`passengers[${index}].age`}
														placeholder="25"
														type="number"
														inputMode="numeric"
														min={0}
														value={(subField.state.value as number | undefined) ?? ""}
														onBlur={subField.handleBlur}
														onChange={(e) => subField.handleChange(e.target.valueAsNumber)}
														aria-invalid={
															!!subField.state.meta.errors.length && subField.state.meta.isTouched
														}
													/>
												</subField.Field>
												<subField.FieldError />
											</subField.FieldSet>
										)}
									</group.AppField>

									{/* Nationality */}
									<group.AppField name={`passengers[${index}].nacionality`}>
										{(subField: any) => (
											<subField.FieldSet className="w-full">
												<subField.Field>
													<div className="flex items-center justify-between">
														<subField.FieldLabel htmlFor={`passengers[${index}].nacionality`}>
															Nacionalidad
														</subField.FieldLabel>
														{index === 0 && field.state.value.length > 1 && (
															<Button
																type="button"
																variant="ghost"
																size="sm"
																className="h-auto px-2 py-0.5 text-xs"
																onClick={() => {
																	const val = subField.state.value as string
																	if (!val) return
																	for (let i = 1; i < field.state.value.length; i++) {
																		group.form.setFieldValue(`passengers[${i}].nacionality`, val)
																	}
																	toast.success("Nacionalidad copiada a todos los pasajeros")
																}}
															>
																<Copy className="mr-1 h-3 w-3" /> Copiar a todos
															</Button>
														)}
													</div>
												</subField.Field>
												<NationalitySelect
													name={`passengers[${index}].nacionality`}
													value={(subField.state.value as string | undefined) ?? ""}
													onChange={subField.handleChange}
													onBlur={subField.handleBlur}
													invalid={
														!!subField.state.meta.errors.length && subField.state.meta.isTouched
													}
												/>
												<subField.FieldError />
											</subField.FieldSet>
										)}
									</group.AppField>

									{/* Phone */}
									<group.AppField name={`passengers[${index}].phone`}>
										{(subField: any) => (
											<subField.FieldSet className="w-full">
												<subField.Field>
													<subField.FieldLabel htmlFor={`passengers[${index}].phone`}>
														Teléfono
													</subField.FieldLabel>
													<Input
														name={`passengers[${index}].phone`}
														placeholder="+56 9 1234 5678"
														type="tel"
														value={(subField.state.value as string | undefined) ?? ""}
														onBlur={subField.handleBlur}
														onChange={(e) => subField.handleChange(e.target.value)}
														aria-invalid={
															!!subField.state.meta.errors.length && subField.state.meta.isTouched
														}
													/>
												</subField.Field>
												<subField.FieldError />
											</subField.FieldSet>
										)}
									</group.AppField>

									{/* Email */}
									<group.AppField name={`passengers[${index}].email`}>
										{(subField: any) => (
											<subField.FieldSet className="w-full">
												<subField.Field>
													<subField.FieldLabel htmlFor={`passengers[${index}].email`}>
														Correo Electrónico
													</subField.FieldLabel>
													<Input
														name={`passengers[${index}].email`}
														placeholder="pasajero@ejemplo.cl"
														type="email"
														value={(subField.state.value as string | undefined) ?? ""}
														onBlur={subField.handleBlur}
														onChange={(e) => subField.handleChange(e.target.value)}
														aria-invalid={
															!!subField.state.meta.errors.length && subField.state.meta.isTouched
														}
													/>
												</subField.Field>
												<subField.FieldError />
											</subField.FieldSet>
										)}
									</group.AppField>

									{/* Hotels */}
									<group.AppField name={`passengers[${index}].hotels` as any} mode="array">
										{(hotelsField: any) => {
											const hotels = (hotelsField.state.value || []) as Array<{
												clientId?: string
												hotelName?: string
												checkIn?: Date
												checkOut?: Date
												order?: number
											}>
											return (
												<div className="w-full space-y-3 lg:col-span-2">
													<div className="flex w-full items-center justify-between">
														<div className="flex items-center gap-2">
															<label className="text-sm font-medium">Hoteles</label>
															{index === 0 && field.state.value.length > 1 && hotels.length > 0 && (
																<Button
																	type="button"
																	variant="ghost"
																	size="sm"
																	className="h-auto px-2 py-0.5 text-xs"
																	onClick={() => {
																		for (let i = 1; i < field.state.value.length; i++) {
																			const clonedHotels = hotels.map((h: any) => ({
																				...h,
																				clientId: createClientId(),
																			}))
																			group.form.setFieldValue(
																				`passengers[${i}].hotels`,
																				clonedHotels
																			)
																		}
																		toast.success("Hoteles copiados a todos los pasajeros")
																	}}
																>
																	<Copy className="mr-1 h-3 w-3" /> Copiar a todos
																</Button>
															)}
														</div>

														<Button
															type="button"
															variant="outline"
															size="sm"
															onClick={() =>
																hotelsField.pushValue({
																	clientId: createClientId(),
																	hotelName: "",
																	checkIn: undefined,
																	checkOut: undefined,
																	order: hotels.length,
																})
															}
														>
															<Plus className="h-4 w-4" /> Agregar hotel
														</Button>
													</div>

													{hotels.map((hotel, hotelIndex) => (
														<div
															key={hotel.clientId || hotelIndex}
															className="flex flex-wrap items-end gap-2 rounded-md border p-3"
														>
															<group.AppField
																name={`passengers[${index}].hotels[${hotelIndex}].hotelName` as any}
															>
																{(hotelNameField: any) => (
																	<div className="min-w-[180px] flex-1 space-y-1">
																		<label className="text-xs font-medium">Nombre del Hotel</label>
																		<Input
																			placeholder="Hotel Plaza"
																			type="text"
																			value={(hotelNameField.state.value as string) ?? ""}
																			onBlur={hotelNameField.handleBlur}
																			onChange={(e) => hotelNameField.handleChange(e.target.value)}
																		/>
																	</div>
																)}
															</group.AppField>

															{hotels.length >= 2 && (
																<>
																	<group.AppField
																		name={
																			`passengers[${index}].hotels[${hotelIndex}].checkIn` as any
																		}
																	>
																		{(checkInField: any) => {
																			const date = checkInField.state.value as Date | undefined
																			return (
																				<div className="min-w-[160px] space-y-1">
																					<label className="text-xs font-medium">Check-in</label>
																					<Popover>
																						<PopoverTrigger asChild>
																							<Button
																								variant="outline"
																								className={cn(
																									"w-full justify-start text-start font-normal",
																									!date && "text-muted-foreground"
																								)}
																							>
																								<CalendarIcon className="size-4" />
																								{date
																									? format(date, "PPP", { locale: es })
																									: "Seleccionar"}
																							</Button>
																						</PopoverTrigger>
																						<PopoverContent className="w-auto p-0" align="start">
																							<Calendar
																								mode="single"
																								selected={date}
																								onSelect={(newDate) => {
																									if (newDate) checkInField.handleChange(newDate)
																								}}
																								locale={es}
																								required={false}
																							/>
																						</PopoverContent>
																					</Popover>
																				</div>
																			)
																		}}
																	</group.AppField>

																	<group.AppField
																		name={
																			`passengers[${index}].hotels[${hotelIndex}].checkOut` as any
																		}
																	>
																		{(checkOutField: any) => {
																			const date = checkOutField.state.value as Date | undefined
																			return (
																				<div className="min-w-[160px] space-y-1">
																					<label className="text-xs font-medium">Check-out</label>
																					<Popover>
																						<PopoverTrigger asChild>
																							<Button
																								variant="outline"
																								className={cn(
																									"w-full justify-start text-start font-normal",
																									!date && "text-muted-foreground"
																								)}
																							>
																								<CalendarIcon className="size-4" />
																								{date
																									? format(date, "PPP", { locale: es })
																									: "Seleccionar"}
																							</Button>
																						</PopoverTrigger>
																						<PopoverContent className="w-auto p-0" align="start">
																							<Calendar
																								mode="single"
																								selected={date}
																								onSelect={(newDate) => {
																									if (newDate) checkOutField.handleChange(newDate)
																								}}
																								locale={es}
																								required={false}
																							/>
																						</PopoverContent>
																					</Popover>
																				</div>
																			)
																		}}
																	</group.AppField>
																</>
															)}

															<Button
																type="button"
																variant="ghost"
																size="icon"
																className="text-destructive shrink-0"
																onClick={() => hotelsField.removeValue(hotelIndex)}
															>
																<Trash2 className="h-4 w-4" />
															</Button>
														</div>
													))}
												</div>
											)
										}}
									</group.AppField>

									{/* Diet type */}
									<group.AppField name={`passengers[${index}].diet_type`}>
										{(subField: any) => (
											<subField.FieldSet className="w-full">
												<subField.Field>
													<subField.FieldLabel htmlFor={`passengers[${index}].diet_type`}>
														Alimentación
													</subField.FieldLabel>
												</subField.Field>
												<Select
													name={`passengers[${index}].diet_type`}
													value={(subField.state.value as string | undefined) ?? ""}
													onValueChange={(value) => {
														subField.handleChange(value)
														if (value !== "OTHER") {
															group.form.setFieldValue(`passengers[${index}].dietOther`, "")
														}
													}}
													aria-invalid={
														!!subField.state.meta.errors.length && subField.state.meta.isTouched
													}
												>
													<subField.Field>
														<SelectTrigger className="w-full">
															<SelectValue placeholder="Seleccione el tipo de alimentación" />
														</SelectTrigger>
													</subField.Field>
													<SelectContent>
														{DIET_OPTIONS.map(({ label, value }) => (
															<SelectItem key={value} value={value}>
																{label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<subField.FieldError />
											</subField.FieldSet>
										)}
									</group.AppField>

									{/* Allergies */}
									<group.AppField name={`passengers[${index}].allergies` as any} mode="array">
										{(allergiesField: any) => {
											const allergies = (allergiesField.state.value || []) as string[]
											return (
												<div className="w-full space-y-2">
													<label className="text-sm font-medium">Alergias</label>
													<div className="flex gap-2">
														<Input
															data-allergy-input={index}
															placeholder="Ej: Mariscos, Gluten..."
															onKeyDown={(e) => {
																if (e.key === "Enter") {
																	e.preventDefault()
																	const value = e.currentTarget.value.trim()
																	if (value) {
																		allergiesField.pushValue(value)
																		e.currentTarget.value = ""
																	}
																}
															}}
														/>
														<Button
															type="button"
															variant="outline"
															size="sm"
															onClick={() => {
																const input = document.querySelector<HTMLInputElement>(
																	`[data-allergy-input="${index}"]`
																)
																const value = input?.value?.trim()
																if (value && input) {
																	allergiesField.pushValue(value)
																	input.value = ""
																}
															}}
														>
															Agregar
														</Button>
													</div>
													{allergies.length > 0 && (
														<div className="flex flex-wrap gap-2">
															{allergies.map((allergy: string, allergyIndex: number) => (
																<Badge
																	key={allergyIndex}
																	variant="secondary"
																	className="gap-1 pr-1"
																>
																	{allergy}
																	<button
																		type="button"
																		className="hover:text-destructive ml-1 text-xs"
																		onClick={() => allergiesField.removeValue(allergyIndex)}
																	>
																		&times;
																	</button>
																</Badge>
															))}
														</div>
													)}
												</div>
											)
										}}
									</group.AppField>

									{/* DietOther — only when diet_type === "OTHER" */}
									<group.Subscribe
										selector={({ values }: any) => ({
											dietType: values.passengers?.[index]?.diet_type,
										})}
									>
										{({ dietType }: { dietType: string }) =>
											dietType === "OTHER" ? (
												<group.AppField name={`passengers[${index}].dietOther`}>
													{(subField: any) => (
														<subField.FieldSet className="w-full lg:col-span-2">
															<subField.Field>
																<subField.FieldLabel htmlFor={`passengers[${index}].dietOther`}>
																	Detalle de alimentación
																</subField.FieldLabel>
																<Textarea
																	name={`passengers[${index}].dietOther`}
																	placeholder="Describe la alimentación especial..."
																	className="h-20"
																	value={(subField.state.value as string) ?? ""}
																	onBlur={subField.handleBlur}
																	onChange={(e) => subField.handleChange(e.target.value)}
																/>
															</subField.Field>
															<subField.FieldError />
														</subField.FieldSet>
													)}
												</group.AppField>
											) : null
										}
									</group.Subscribe>
								</div>
							</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>

				<div className="flex items-center justify-between pt-2">
					<p className="text-muted-foreground text-xs">
						La cantidad de pasajeros se determina por las entradas seleccionadas en el paso
						anterior.
					</p>
				</div>
			</div>
		</div>
	)
}
