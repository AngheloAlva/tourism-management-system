"use client"

import { withFieldGroup } from "@/shared/components/ui/tanstack-form"
import { CalendarIcon, Plus, Trash2, Copy, AlertTriangle } from "lucide-react"
import { es } from "date-fns/locale"
import { format } from "date-fns"
import { toast } from "sonner"

import { NationalitySelect } from "../nationality-select"

import { CardTitle, CardHeader, CardContent, CardDescription } from "@/shared/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover"
import {
	Accordion,
	AccordionItem,
	AccordionTrigger,
	AccordionContent,
} from "@/shared/components/ui/accordion"
import { Calendar } from "@/shared/components/ui/calendar"
import { Textarea } from "@/shared/components/ui/textarea"
import { Badge } from "@/shared/components/ui/badge"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import {
	Select,
	SelectItem,
	SelectValue,
	SelectTrigger,
	SelectContent,
} from "@/shared/components/ui/select"
import { Switch } from "@/shared/components/ui/switch"
import { createClientId } from "@/shared/lib/create-client-id"
import { cn } from "@/lib/utils"
import {
	getComplimentaryCategoryOptions,
	isOrphanedCategory,
} from "@/project/sales/utils/complimentary-category-options"

interface EntryTypeDistribution {
	categoryName: string
	name: string
	count: number
	ageMin: number | null
	ageMax: number | null
}

function validateAgeDistribution(
	passengers: Array<{ age?: number }>,
	entryDistribution: EntryTypeDistribution[]
): string[] {
	const warnings: string[] = []
	const typesWithAge = entryDistribution.filter(
		(et) => et.count > 0 && et.ageMin !== null && et.ageMax !== null
	)

	if (typesWithAge.length === 0) return warnings

	for (const entryType of typesWithAge) {
		const matchingPassengers = passengers.filter((p) => {
			const age = p.age || 0
			if (age === 0) return false
			const min = entryType.ageMin ?? 0
			const max = entryType.ageMax ?? 999
			return age >= min && age <= max
		})

		if (matchingPassengers.length < entryType.count) {
			const ageRange = `${entryType.ageMin ?? 0}-${entryType.ageMax ?? "+"}`
			warnings.push(
				`Se esperan ${entryType.count} pasajero(s) de tipo "${entryType.name}" (edad ${ageRange}), pero solo ${matchingPassengers.length} coinciden`
			)
		}
	}

	return warnings
}

export const PassengersFormGroup = withFieldGroup({
	defaultValues: {
		passengerArray: [
			{
				clientId: createClientId(),
				name: "",
				rut: "",
				age: 0,
				phone: "",
				hotels: [{ clientId: createClientId(), hotelName: "", order: 0 }],
				email: "",
				dietOther: "",
				nacionality: "",
				diet_type: "NORMAL",
				allergies: [],
				complimentary: false,
				complimentaryCategory: "",
			},
		],
	},
	render: function Step3Render({ group }) {
		return (
			<group.Subscribe
				selector={({ values }) => ({
					passengerArray: values.passengerArray,
					eventBookings: (values as any).eventBookings,
				})}
			>
				{({ passengerArray, eventBookings }) => {
					const entryDistribution: EntryTypeDistribution[] = []
					if (eventBookings && Array.isArray(eventBookings)) {
						for (const booking of eventBookings) {
							for (const entry of booking.priceEntries || []) {
								if (entry.count > 0) {
									const existing = entryDistribution.find((d) => d.categoryName === entry.categoryName)
									if (existing) {
										existing.count = Math.max(existing.count, entry.count)
									} else {
										entryDistribution.push({
											categoryName: entry.categoryName,
											name: entry.categoryName,
											count: entry.count,
											ageMin: null,
											ageMax: null,
										})
									}
								}
							}
						}
					}

					const ageWarnings = validateAgeDistribution(passengerArray || [], entryDistribution)

					return (
						<div className="space-y-4">
							<CardHeader className="gap-0">
								<CardTitle className="text-2xl font-bold">Detalle de Pasajeros</CardTitle>
								<CardDescription>
									Agregar uno o más pasajeros para esta venta/cotización. Puedes dejar vacío los
									campos que no aplican o no se puedan completar en este momento.
								</CardDescription>
							</CardHeader>

							<CardContent>
								{ageWarnings.length > 0 && (
									<div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
										<div className="flex items-center gap-2 text-sm font-medium text-amber-700">
											<AlertTriangle className="h-4 w-4" />
											Advertencia de edades
										</div>
										<ul className="mt-1 space-y-0.5 pl-6 text-xs text-amber-600">
											{ageWarnings.map((w, i) => (
												<li key={i}>{w}</li>
											))}
										</ul>
									</div>
								)}

								<group.AppField name="passengerArray" mode="array">
									{(field) => {
										const defaultAccordionValues = field.state.value.map(
											(_: unknown, i: number) => `passenger-${i}`
										)
										return (
											<div className="w-full space-y-4">
												{/* Copy buttons are now inline per field */}
												<Accordion type="multiple" defaultValue={defaultAccordionValues}>
													{field.state.value.map((passenger, index) => (
														<AccordionItem
															key={passenger.clientId || index}
															value={`passenger-${index}`}
														>
															<AccordionTrigger className="text-base font-medium">
																<span className="text-muted-foreground">{index + 1}. </span>
																{passenger.name ? `${passenger.name}` : "Sin Nombre"}
																{passenger.complimentary && (
																	<Badge variant="secondary" className="ml-2 text-xs font-normal">
																		Liberado
																	</Badge>
																)}
															</AccordionTrigger>

															<AccordionContent className="h-fit">
																{field.state.value.length > 1 && (
																	<div className="mb-3 flex justify-end">
																		<Button
																			type="button"
																			variant="ghost"
																			size="sm"
																			className="text-destructive gap-1"
																			onClick={() => field.removeValue(index)}
																		>
																			<Trash2 className="h-4 w-4" />
																			Eliminar pasajero
																		</Button>
																	</div>
																)}
																<div className="grid grid-cols-1 gap-x-4 gap-y-5 pb-6 lg:grid-cols-2">
																	<group.AppField name={`passengerArray[${index}].name`}>
																		{(field) => (
																			<field.FieldSet className="w-full">
																				<field.Field>
																					<field.FieldLabel
																						htmlFor={`passengerArray[${index}].name`}
																					>
																						Nombre Completo
																					</field.FieldLabel>
																					<Input
																						name={`passengerArray[${index}].name`}
																						placeholder="Juan Pérez González"
																						type="text"
																						value={(field.state.value as string | undefined) ?? ""}
																						onBlur={field.handleBlur}
																						onChange={(e) => field.handleChange(e.target.value)}
																						aria-invalid={
																							!!field.state.meta.errors.length &&
																							field.state.meta.isTouched
																						}
																						data-testid="sales-input-passenger-name"
																					/>
																				</field.Field>

																				<field.FieldError />
																			</field.FieldSet>
																		)}
																	</group.AppField>

																	<group.AppField name={`passengerArray[${index}].rut`}>
																		{(field) => (
																			<field.FieldSet className="w-full">
																				<field.Field>
																					<field.FieldLabel
																						htmlFor={`passengerArray[${index}].rut`}
																					>
																						RUT / Pasaporte
																					</field.FieldLabel>
																					<Input
																						name={`passengerArray[${index}].rut`}
																						placeholder="12.345.678-9 o AB123456"
																						type="text"
																						value={(field.state.value as string | undefined) ?? ""}
																						onBlur={field.handleBlur}
																						onChange={(e) => field.handleChange(e.target.value)}
																						aria-invalid={
																							!!field.state.meta.errors.length &&
																							field.state.meta.isTouched
																						}
																					/>
																				</field.Field>

																				<field.FieldError />
																			</field.FieldSet>
																		)}
																	</group.AppField>

																	<group.AppField name={`passengerArray[${index}].age`}>
																		{(field) => (
																			<field.FieldSet className="w-full">
																				<field.Field>
																					<field.FieldLabel
																						htmlFor={`passengerArray[${index}].age`}
																					>
																						Edad
																					</field.FieldLabel>
																					<Input
																						name={`passengerArray[${index}].age`}
																						placeholder="25"
																						type="number"
																						inputMode="decimal"
																						value={(field.state.value as number | undefined) ?? ""}
																						onBlur={field.handleBlur}
																						onChange={(e) =>
																							field.handleChange(e.target.valueAsNumber)
																						}
																						aria-invalid={
																							!!field.state.meta.errors.length &&
																							field.state.meta.isTouched
																						}
																					/>
																				</field.Field>

																				<field.FieldError />
																			</field.FieldSet>
																		)}
																	</group.AppField>

																	<group.AppField name={`passengerArray[${index}].nacionality`}>
																		{(field) => {
																			return (
																				<field.FieldSet className="w-full">
																					<field.Field>
																						<div className="flex items-center justify-between">
																							<field.FieldLabel
																								htmlFor={`passengerArray[${index}].nacionality`}
																							>
																								Nacionalidad
																							</field.FieldLabel>
																							{index === 0 && passengerArray.length > 1 && (
																								<Button
																									type="button"
																									variant="ghost"
																									size="sm"
																									className="h-auto px-2 py-0.5 text-xs"
																									onClick={() => {
																										const val = field.state.value as string
																										if (!val) return
																										for (let i = 1; i < passengerArray.length; i++) {
																											group.form.setFieldValue(
																												`passengerArray[${i}].nacionality`,
																												val
																											)
																										}
																										toast.success("Nacionalidad copiada a todos los pasajeros")
																									}}
																								>
																									<Copy className="mr-1 h-3 w-3" /> Copiar a todos
																								</Button>
																							)}
																						</div>
																					</field.Field>
																					<NationalitySelect
																						name={`passengerArray[${index}].nacionality`}
																						value={(field.state.value as string | undefined) ?? ""}
																						onChange={field.handleChange}
																						onBlur={field.handleBlur}
																						invalid={
																							!!field.state.meta.errors.length &&
																							field.state.meta.isTouched
																						}
																					/>

																					<field.FieldError />
																				</field.FieldSet>
																			)
																		}}
																	</group.AppField>

																	<group.AppField name={`passengerArray[${index}].phone`}>
																		{(field) => (
																			<field.FieldSet className="w-full">
																				<field.Field>
																					<div className="flex items-center justify-between">
																						<field.FieldLabel
																							htmlFor={`passengerArray[${index}].phone`}
																						>
																							Teléfono
																						</field.FieldLabel>
																						{index === 0 && passengerArray.length > 1 && (
																							<Button
																								type="button"
																								variant="ghost"
																								size="sm"
																								className="h-auto px-2 py-0.5 text-xs"
																								onClick={() => {
																									const val = field.state.value as string
																									if (!val) return
																									for (let i = 1; i < passengerArray.length; i++) {
																										group.form.setFieldValue(`passengerArray[${i}].phone`, val)
																									}
																									toast.success("Teléfono copiado a todos los pasajeros")
																								}}
																							>
																								<Copy className="mr-1 h-3 w-3" /> Copiar a todos
																							</Button>
																						)}
																					</div>
																					<Input
																						name={`passengerArray[${index}].phone`}
																						placeholder="+56 9 1234 5678"
																						type="tel"
																						inputMode="decimal"
																						value={(field.state.value as string | undefined) ?? ""}
																						onBlur={field.handleBlur}
																						onChange={(e) => field.handleChange(e.target.value)}
																						aria-invalid={
																							!!field.state.meta.errors.length &&
																							field.state.meta.isTouched
																						}
																					/>
																				</field.Field>

																				<field.FieldError />
																			</field.FieldSet>
																		)}
																	</group.AppField>

																	<group.AppField name={`passengerArray[${index}].email`}>
																		{(field) => (
																			<field.FieldSet className="w-full">
																				<field.Field>
																					<field.FieldLabel
																						htmlFor={`passengerArray[${index}].email`}
																					>
																						Correo Electrónico
																					</field.FieldLabel>
																					<Input
																						name={`passengerArray[${index}].email`}
																						placeholder="pasajero@ejemplo.cl"
																						type="email"
																						value={(field.state.value as string | undefined) ?? ""}
																						onBlur={field.handleBlur}
																						onChange={(e) => field.handleChange(e.target.value)}
																						aria-invalid={
																							!!field.state.meta.errors.length &&
																							field.state.meta.isTouched
																						}
																					/>
																				</field.Field>

																				<field.FieldError />
																			</field.FieldSet>
																		)}
																	</group.AppField>

																	<group.AppField
																		name={`passengerArray[${index}].hotels` as any}
																		mode="array"
																	>
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
																							{index === 0 && passengerArray.length > 1 && hotels.length > 0 && (
																								<Button
																									type="button"
																									variant="ghost"
																									size="sm"
																									className="h-auto px-2 py-0.5 text-xs"
																									onClick={() => {
																										for (let i = 1; i < passengerArray.length; i++) {
																											const clonedHotels = hotels.map((h: any) => ({
																												...h,
																												clientId: createClientId(),
																											}))
																											group.form.setFieldValue(
																												`passengerArray[${i}].hotels`,
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
																								name={
																									`passengerArray[${index}].hotels[${hotelIndex}].hotelName` as any
																								}
																							>
																								{(field: any) => (
																									<div className="min-w-[180px] flex-1 space-y-1">
																										<label className="text-xs font-medium">
																											Nombre del Hotel
																										</label>
																										<Input
																											placeholder="Hotel Plaza"
																											type="text"
																											value={(field.state.value as string) ?? ""}
																											onBlur={field.handleBlur}
																											onChange={(e) =>
																												field.handleChange(e.target.value)
																											}
																										/>
																									</div>
																								)}
																							</group.AppField>

																							{hotels.length >= 2 && (
																								<>
																							<group.AppField
																								name={
																									`passengerArray[${index}].hotels[${hotelIndex}].checkIn` as any
																								}
																							>
																								{(field: any) => {
																									const date = field.state.value as Date | undefined
																									return (
																										<div className="min-w-[160px] space-y-1">
																											<label className="text-xs font-medium">
																												Check-in
																											</label>
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
																															? format(date, "PPP", {
																																	locale: es,
																																})
																															: "Seleccionar"}
																													</Button>
																												</PopoverTrigger>
																												<PopoverContent
																													className="w-auto p-0"
																													align="start"
																												>
																													<Calendar
																														mode="single"
																														selected={date}
																														onSelect={(newDate) => {
																															if (newDate)
																																field.handleChange(newDate)
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
																									`passengerArray[${index}].hotels[${hotelIndex}].checkOut` as any
																								}
																							>
																								{(field: any) => {
																									const date = field.state.value as Date | undefined
																									return (
																										<div className="min-w-[160px] space-y-1">
																											<label className="text-xs font-medium">
																												Check-out
																											</label>
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
																															? format(date, "PPP", {
																																	locale: es,
																																})
																															: "Seleccionar"}
																													</Button>
																												</PopoverTrigger>
																												<PopoverContent
																													className="w-auto p-0"
																													align="start"
																												>
																													<Calendar
																														mode="single"
																														selected={date}
																														onSelect={(newDate) => {
																															if (newDate)
																																field.handleChange(newDate)
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

																	<group.AppField name={`passengerArray[${index}].diet_type`}>
																		{(field) => {
																			const options = [
																				{ label: "Normal", value: "NORMAL" },
																				{ label: "Vegetariana", value: "VEGETARIAN" },
																				{ label: "Vegana", value: "VEGAN" },
																				{ label: "Celiaco", value: "CELIAC" },
																				{ label: "Otra", value: "OTHER" },
																			]
																			return (
																				<field.FieldSet className="w-full">
																					<field.Field>
																						<field.FieldLabel
																							htmlFor={`passengerArray[${index}].diet_type`}
																						>
																							Alimentación
																						</field.FieldLabel>
																					</field.Field>
																					<Select
																						name={`passengerArray[${index}].diet_type`}
																						value={(field.state.value as string | undefined) ?? ""}
																						onValueChange={(value) => {
																							field.handleChange(value)
																							if (value !== "OTHER") {
																								group.form.setFieldValue(
																									`passengerArray[${index}].dietOther`,
																									""
																								)
																							}
																						}}
																						defaultValue={String(field?.state.value ?? "")}
																						disabled={false}
																						aria-invalid={
																							!!field.state.meta.errors.length &&
																							field.state.meta.isTouched
																						}
																					>
																						<field.Field>
																							<SelectTrigger className="w-full">
																								<SelectValue placeholder="Seleccione el tipo de alimentación" />
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

																	<group.AppField
																		name={`passengerArray[${index}].allergies` as any}
																		mode="array"
																	>
																		{(allergiesField: any) => {
																			const allergies = (allergiesField.state.value ||
																				[]) as string[]
																			return (
																				<div className="w-full space-y-2">
																					<label className="text-sm font-medium">Alergias</label>

																					<div className="flex gap-2">
																						<Input
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
																							onClick={(e) => {
																								const input = (e.currentTarget as HTMLElement)
																									.previousElementSibling as HTMLInputElement
																								const value = input?.value?.trim()
																								if (value) {
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
																							{allergies.map(
																								(allergy: string, allergyIndex: number) => (
																									<Badge
																										key={allergyIndex}
																										variant="secondary"
																										className="gap-1 pr-1"
																									>
																										{allergy}
																										<button
																											type="button"
																											className="hover:text-destructive ml-1 text-xs"
																											onClick={() =>
																												allergiesField.removeValue(allergyIndex)
																											}
																										>
																											&times;
																										</button>
																									</Badge>
																								)
																							)}
																						</div>
																					)}
																				</div>
																			)
																		}}
																	</group.AppField>

																	<group.Subscribe
																		selector={({ values }) => ({
																			dietType: values.passengerArray[index]?.diet_type,
																		})}
																	>
																		{({ dietType }) =>
																			dietType === "OTHER" ? (
																				<group.AppField name={`passengerArray[${index}].dietOther`}>
																					{(field) => (
																						<field.FieldSet className="w-full lg:col-span-2">
																							<field.Field>
																								<field.FieldLabel
																									htmlFor={`passengerArray[${index}].dietOther`}
																								>
																									Detalle de alimentación
																								</field.FieldLabel>
																								<Textarea
																									name={`passengerArray[${index}].dietOther`}
																									placeholder="Describe la alimentación especial..."
																									className="h-20"
																									value={(field.state.value as string) ?? ""}
																									onBlur={field.handleBlur}
																									onChange={(e) =>
																										field.handleChange(e.target.value)
																									}
																								/>
																							</field.Field>
																							<field.FieldError />
																						</field.FieldSet>
																					)}
																				</group.AppField>
																			) : null
														}
													</group.Subscribe>

													{/* T-14/T-15/T-16: Complimentary (Liberado) row */}
													<group.Subscribe
														selector={({ values }) => ({
															complimentary: values.passengerArray[index]?.complimentary,
															complimentaryCategory: values.passengerArray[index]?.complimentaryCategory,
															eventBookings: (values as any).eventBookings,
														})}
													>
														{({ complimentary, complimentaryCategory, eventBookings }) => {
															const categoryOptions = getComplimentaryCategoryOptions(
																(eventBookings as any) || []
															)
															// Only force a category choice when more than one exists.
															// A single category is the only option, so it is assumed
															// (the pricing core deducts the comp from it regardless).
															const requiresCategorySelection = categoryOptions.length > 1
															const orphaned =
																complimentary &&
																!!complimentaryCategory &&
																isOrphanedCategory(complimentaryCategory, categoryOptions)
															return (
																<div className="lg:col-span-2 space-y-3">
																	{/* T-14: Switch — always visible */}
																	<group.AppField
																		name={`passengerArray[${index}].complimentary` as any}
																	>
																		{(field) => (
																			<field.FieldSet className="flex flex-row items-center justify-between rounded-lg border p-4">
																				<div>
																					<field.FieldLabel
																						htmlFor={`passengerArray[${index}].complimentary`}
																					>
																						Liberado
																					</field.FieldLabel>
																					<p className="text-muted-foreground text-xs">
																						No impacta en el precio del tour (sí paga entradas)
																					</p>
																				</div>
																				<Switch
																					id={`passengerArray[${index}].complimentary`}
																					checked={!!field.state.value}
																					onCheckedChange={(checked) => {
																						;(field.handleChange as unknown as (v: boolean) => void)(checked)
																						if (!checked) {
																							group.form.setFieldValue(
																								`passengerArray[${index}].complimentaryCategory` as any,
																								""
																							)
																						}
																					}}
																				/>
																			</field.FieldSet>
																		)}
																	</group.AppField>

																	{/* T-15: Category Select — only when >1 categories exist */}
																	{complimentary && (
																		requiresCategorySelection ? (
																			<group.AppField
																				name={`passengerArray[${index}].complimentaryCategory` as any}
																			>
																				{(field) => (
																					<field.FieldSet className="w-full">
																						<field.Field>
																							<field.FieldLabel
																								htmlFor={`passengerArray[${index}].complimentaryCategory`}
																							>
																								Categoría *
																							</field.FieldLabel>
																						</field.Field>
																						<Select
																							name={`passengerArray[${index}].complimentaryCategory`}
																							value={(field.state.value as string) || ""}
																							onValueChange={(v) => (field.handleChange as unknown as (v: string) => void)(v)}
																						>
																							<SelectTrigger className="w-full">
																								<SelectValue placeholder="Seleccioná la categoría" />
																							</SelectTrigger>
																							<SelectContent>
																								{categoryOptions.map((cat) => (
																									<SelectItem key={cat} value={cat}>
																										{cat}
																									</SelectItem>
																								))}
																							</SelectContent>
																						</Select>
																						{/* T-16: Orphaned category hint */}
																						{orphaned && (
																							<p className="text-amber-600 text-xs mt-1">
																								Categoría ya no existe, seleccioná otra
																							</p>
																						)}
																						<field.FieldError />
																					</field.FieldSet>
																				)}
																			</group.AppField>
																		) : (
																			<p className="text-muted-foreground text-xs">
																				{categoryOptions.length === 1
																					? `Categoría única (${categoryOptions[0]}): se asume automáticamente`
																					: "En modo privado no requiere categoría"}
																			</p>
																		)
																	)}
																</div>
															)
														}}
													</group.Subscribe>
												</div>
											</AccordionContent>
														</AccordionItem>
													))}
												</Accordion>

												<p className="text-muted-foreground pt-2 text-xs">
													La cantidad de pasajeros se determina por las entradas en el paso
													anterior.
												</p>
											</div>
										)
									}}
								</group.AppField>
							</CardContent>
						</div>
					)
				}}
			</group.Subscribe>
		)
	},
})
