"use client"

import { ChevronDown, PlusCircleIcon, XCircleIcon } from "lucide-react"
import { useEffect } from "react"
import { toast } from "sonner"

import { agencySchema, type CreateAgency } from "../schemas/agency.schema"
import { useCreateAgency, useUpdateAgency } from "../hooks/use-agencies"
import { useAppForm } from "@/shared/components/ui/tanstack-form"
import { useActiveTours } from "@/project/tours/hooks/use-tours"
import { flattenTourEntries } from "@/project/tours/utils/tour-form-helpers"

import { Field, FieldContent, FieldError, FieldLabel } from "@/shared/components/ui/field"
import { Spinner } from "@/shared/components/ui/spinner"
import { Button } from "@/shared/components/ui/button"
import { Switch } from "@/shared/components/ui/switch"
import { Input } from "@/shared/components/ui/input"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/shared/components/ui/collapsible"
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupButton,
} from "@/shared/components/ui/input-group"

import type { Agency } from "../types/agency"

interface AgencyFormProps {
	agency?: Agency | null
	onSuccess?: () => void
}

const DEFAULT_PRIVATE_CAPACITY = 12

function normalizePrivatePricingTiers(
	raw: unknown
): Array<{ capacity: number; price?: number } | null> {
	if (!raw) return []

	if (Array.isArray(raw)) {
		return raw
			.map((tier) => {
				if (!tier || typeof tier !== "object") return null
				const capacity = Number((tier as { capacity?: unknown }).capacity)
				const priceRaw = (tier as { price?: unknown }).price
				const price = Number(priceRaw)
				return {
					capacity,
					price: Number.isFinite(price) ? price : undefined,
				}
			})
			.filter((tier): tier is { capacity: number; price: number } =>
				Boolean(tier && Number.isFinite(tier.capacity) && tier.capacity > 0)
			)
			.sort((a, b) => a.capacity - b.capacity)
	}

	if (typeof raw === "object") {
		return Object.entries(raw as Record<string, unknown>)
			.map(([key, value]) => {
				const capacity = Number(key)
				const price = Number(value)
				return {
					capacity,
					price: Number.isFinite(price) ? price : undefined,
				}
			})
			.filter((tier) => Number.isFinite(tier.capacity) && tier.capacity > 0)
			.sort((a, b) => a.capacity - b.capacity)
	}

	return []
}

function extractTourPrivatePriceTiers(tour: {
	privatePriceTiers?: unknown
	privatePricing?: unknown
}) {
	if (tour.privatePriceTiers) {
		return normalizePrivatePricingTiers(tour.privatePriceTiers)
	}

	return normalizePrivatePricingTiers(tour.privatePricing)
}

export function AgencyForm({ agency, onSuccess }: AgencyFormProps) {
	const isEditing = !!agency

	const createAgency = useCreateAgency()
	const updateAgency = useUpdateAgency()
	const { data: activeTours } = useActiveTours()

	const form = useAppForm({
		defaultValues: {
			name: agency?.name || "",
			phone: agency?.phone || "",
			taxId: agency?.taxId || "",
			country: agency?.country || "",
			address: agency?.address || "",
			website: agency?.website || "",
			active: agency?.active ?? true,
			codePrefix: agency?.codePrefix || "",
			codeLength: agency?.codeLength?.toString() || "",
			contactEmails: agency?.contactEmails?.map((email) => ({ email })) || [{ email: "" }],
			tourPricing:
				agency?.tourPricing?.map((pricing) => ({
					tourId: pricing.tourId,
					priceCategoryOverrides: (pricing.priceCategoryOverrides || []).map((o) => ({
						tourPriceCategoryId: o.tourPriceCategoryId,
						price: String(o.price),
					})),
					entryOverrides: (pricing.entryOverrides || []).map((o) => ({
						tourEntryId: o.tourEntryId,
						price: String(o.price),
					})),
					privatePriceTiers: (pricing.privatePriceTiers || []).map((tier) => ({
						capacity: tier.capacity,
						price: String(tier.price),
					})),
				})) || [],
		} as CreateAgency,
		validators: {
			onChange: agencySchema as any,
		},
		onSubmit: async ({ value }) => {
			try {
				if (isEditing) {
					await updateAgency.mutateAsync({
						id: agency.id,
						name: value.name,
						active: value.active,
						phone: value.phone || null,
						taxId: value.taxId || null,
						codeLength: value.codeLength,
						country: value.country || null,
						address: value.address || null,
						website: value.website || null,
						contactEmails: value.contactEmails,
						codePrefix: value.codePrefix || null,
						tourPricing: value.tourPricing || [],
					})
				} else {
					await createAgency.mutateAsync({
						name: value.name,
						active: value.active,
						phone: value.phone || null,
						taxId: value.taxId || null,
						codeLength: value.codeLength,
						country: value.country || null,
						address: value.address || null,
						website: value.website || null,
						contactEmails: value.contactEmails,
						codePrefix: value.codePrefix || null,
						tourPricing: value.tourPricing || [],
					})
				}

				onSuccess?.()
			} catch (error) {
				toast.error("Error al guardar la agencia", { description: (error as Error).message })
			}
		},
	})

	const isLoading = createAgency.isPending || updateAgency.isPending

	useEffect(() => {
		if (!activeTours || activeTours.length === 0) return

		const currentTourPricing = form.getFieldValue("tourPricing") || []
		const currentByTourId = new Map(currentTourPricing.map((pricing) => [pricing.tourId, pricing]))

		const mergedTourPricing = activeTours.map((tour) => {
			const current = currentByTourId.get(tour.id)
			const basePrivateTiers = extractTourPrivatePriceTiers(tour)
			const baseTierMap = new Map(
				basePrivateTiers.map((tier) => [
					tier?.capacity,
					tier?.price !== undefined ? String(tier.price) : "",
				])
			)

			const currentTierMap = new Map(
				(current?.privatePriceTiers || []).map((tier) => [Number(tier.capacity), tier.price ?? ""])
			)

			const currentCapacities = (current?.privatePriceTiers || [])
				.map((tier) => Number(tier.capacity))
				.filter((capacity) => Number.isFinite(capacity) && capacity > 0)

			const lastKnownCapacity =
				[...currentCapacities, ...basePrivateTiers.map((tier) => tier?.capacity)]
					.sort((a, b) => (a || 0) - (b || 0))
					.at(-1) || DEFAULT_PRIVATE_CAPACITY

			const capacitiesSource =
				basePrivateTiers.length > 0
					? basePrivateTiers.map((tier) => tier?.capacity)
					: [lastKnownCapacity]

			const mergedPrivateTiers = capacitiesSource
				.map((capacity) => Number(capacity))
				.filter((capacity) => Number.isFinite(capacity) && capacity > 0)
				.sort((a, b) => a - b)
				.map((capacity) => ({
					capacity,
					price: currentTierMap.get(capacity) ?? baseTierMap.get(capacity) ?? "",
				}))

			// Merge price category overrides
			const currentCategoryOverrideMap = new Map(
				(current?.priceCategoryOverrides || []).map((o) => [o.tourPriceCategoryId, o.price ?? ""])
			)
			const tourPriceCategories = (tour as { priceCategories?: Array<{ id: string; name: string; entries?: Array<{ id: string; name: string; variantName: string }> }> }).priceCategories || []
			const mergedPriceCategoryOverrides = tourPriceCategories.map((cat) => ({
				tourPriceCategoryId: cat.id,
				price: currentCategoryOverrideMap.get(cat.id) ?? "",
			}))

			// Merge entry overrides
			const currentEntryOverrideMap = new Map(
				(current?.entryOverrides || []).map((o) => [o.tourEntryId, o.price ?? ""])
			)
			const tourEntries = flattenTourEntries(tourPriceCategories)
			const mergedEntryOverrides = tourEntries.map((entry) => ({
				tourEntryId: entry.id,
				price: currentEntryOverrideMap.get(entry.id) ?? "",
			}))

			return {
				tourId: tour.id,
				priceCategoryOverrides: mergedPriceCategoryOverrides,
				entryOverrides: mergedEntryOverrides,
				privatePriceTiers: mergedPrivateTiers,
			}
		})

		const activeTourIds = new Set(activeTours.map((tour) => tour.id))
		const orphanPricing = currentTourPricing.filter((pricing) => !activeTourIds.has(pricing.tourId))
		const nextTourPricing = [...mergedTourPricing, ...orphanPricing]

		const currentSerialized = JSON.stringify(currentTourPricing)
		const mergedSerialized = JSON.stringify(nextTourPricing)

		if (currentSerialized !== mergedSerialized) {
			form.setFieldValue("tourPricing", nextTourPricing)
		}
	}, [activeTours, form])

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault()
				e.stopPropagation()
				form.handleSubmit()
			}}
			className="space-y-6"
		>
			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,35%)]">
				<div className="grid h-fit gap-4 md:grid-cols-2">
					<form.Field name="name">
						{(field) => (
							<Field data-invalid={field.state.meta.errors.length > 0} className="md:col-span-2">
								<FieldLabel htmlFor={field.name}>Nombre</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Ej: Ekatours Chile"
									aria-invalid={field.state.meta.errors.length > 0}
									data-testid="agency-input-name"
								/>
								{field.state.meta.errors.length > 0 && (
									<FieldError errors={field.state.meta.errors} />
								)}
							</Field>
						)}
					</form.Field>

					<div className="my-4 space-y-2 md:col-span-2">
						<div className="flex items-center justify-between">
							<h2 className="font-semibold">Correos de Contacto</h2>

							<form.Field name="contactEmails" mode="array">
								{(field) => (
									<Button
										size="sm"
										type="button"
										variant="secondary"
										onClick={() => field.pushValue({ email: "" })}
									>
										<PlusCircleIcon className="h-3 w-3" />
										Agregar Correo
									</Button>
								)}
							</form.Field>
						</div>

						<form.Field name="contactEmails" mode="array">
							{(field) => (
								<>
									{field.state.value.map((_, index) => (
										<div key={index} className="flex items-start justify-between gap-2">
											<form.Field name={`contactEmails[${index}].email`}>
												{(subField) => (
													<Field
														orientation="horizontal"
														data-invalid={subField.state.meta.errors.length > 0}
														className="flex-1"
													>
														<FieldContent>
															<InputGroup>
																<InputGroupInput
																	id={subField.name}
																	name={subField.name}
																	value={subField.state.value}
																	onBlur={subField.handleBlur}
																	onChange={(e) => subField.handleChange(e.target.value)}
																	aria-invalid={subField.state.meta.errors.length > 0}
																	placeholder="name@example.com"
																	type="email"
																	autoComplete="email"
																/>
															</InputGroup>
															{subField.state.meta.errors.length > 0 && (
																<FieldError errors={subField.state.meta.errors} />
															)}
														</FieldContent>
													</Field>
												)}
											</form.Field>

											<InputGroupAddon align="inline-end">
												<InputGroupButton
													type="button"
													variant="ghost"
													size="icon-xs"
													onClick={() => field.removeValue(index)}
													aria-label={`Remove email ${index + 1}`}
												>
													<XCircleIcon />
												</InputGroupButton>
											</InputGroupAddon>
										</div>
									))}
								</>
							)}
						</form.Field>
					</div>

					<form.Field name="phone">
						{(field) => (
							<Field data-invalid={field.state.meta.errors.length > 0}>
								<FieldLabel htmlFor={field.name}>Teléfono</FieldLabel>
								<Input
									type="tel"
									id={field.name}
									name={field.name}
									value={field.state.value || ""}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Ej: +56 9 1234 5678"
									aria-invalid={field.state.meta.errors.length > 0}
								/>
								{field.state.meta.errors.length > 0 && (
									<FieldError errors={field.state.meta.errors} />
								)}
							</Field>
						)}
					</form.Field>

					<form.Field name="country">
						{(field) => (
							<Field data-invalid={field.state.meta.errors.length > 0}>
								<FieldLabel htmlFor={field.name}>País</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value || ""}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Chile"
									aria-invalid={field.state.meta.errors.length > 0}
								/>
								{field.state.meta.errors.length > 0 && (
									<FieldError errors={field.state.meta.errors} />
								)}
							</Field>
						)}
					</form.Field>

					<form.Field name="address">
						{(field) => (
							<Field data-invalid={field.state.meta.errors.length > 0}>
								<FieldLabel htmlFor={field.name}>Dirección</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value || ""}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									aria-invalid={field.state.meta.errors.length > 0}
									placeholder="Calle Principal 123, Oficina 456"
								/>
								{field.state.meta.errors.length > 0 && (
									<FieldError errors={field.state.meta.errors} />
								)}
							</Field>
						)}
					</form.Field>

					<form.Field name="taxId">
						{(field) => (
							<Field data-invalid={field.state.meta.errors.length > 0}>
								<FieldLabel htmlFor={field.name}>RUT / Tax ID</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value || ""}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="12.345.678-9"
									aria-invalid={field.state.meta.errors.length > 0}
								/>
								{field.state.meta.errors.length > 0 && (
									<FieldError errors={field.state.meta.errors} />
								)}
							</Field>
						)}
					</form.Field>

					<form.Field name="codePrefix">
						{(field) => (
							<Field data-invalid={field.state.meta.errors.length > 0}>
								<FieldLabel htmlFor={field.name}>Prefijo de Código</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value || ""}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Ej: R"
									aria-invalid={field.state.meta.errors.length > 0}
								/>
								{field.state.meta.errors.length > 0 && (
									<FieldError errors={field.state.meta.errors} />
								)}
							</Field>
						)}
					</form.Field>

					<form.Field name="codeLength">
						{(field) => (
							<Field data-invalid={field.state.meta.errors.length > 0}>
								<FieldLabel htmlFor={field.name}>Longitud del Código</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value || ""}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Ej: 5"
									type="number"
									aria-invalid={field.state.meta.errors.length > 0}
								/>
								{field.state.meta.errors.length > 0 && (
									<FieldError errors={field.state.meta.errors} />
								)}
							</Field>
						)}
					</form.Field>

					<form.Field name="website">
						{(field) => (
							<Field data-invalid={field.state.meta.errors.length > 0}>
								<FieldLabel htmlFor={field.name}>Sitio Web</FieldLabel>
								<Input
									type="url"
									id={field.name}
									name={field.name}
									value={field.state.value || ""}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									aria-invalid={field.state.meta.errors.length > 0}
									placeholder="https://www.example.com"
								/>
								{field.state.meta.errors.length > 0 && (
									<FieldError errors={field.state.meta.errors} />
								)}
							</Field>
						)}
					</form.Field>

					<form.Field name="active">
						{(field) => (
							<Field
								orientation="horizontal"
								data-invalid={field.state.meta.errors.length > 0}
								className="flex flex-col items-start justify-center"
							>
								<FieldContent className="flex-0">
									<FieldLabel htmlFor="form-rhf-switch-active">Agencia activa</FieldLabel>
									{field.state.meta.errors.length > 0 && (
										<FieldError errors={field.state.meta.errors} />
									)}
								</FieldContent>

								<Switch
									name={field.name}
									checked={field.state.value}
									id="form-rhf-switch-active"
									onCheckedChange={field.handleChange}
									aria-invalid={field.state.meta.errors.length > 0}
								/>
							</Field>
						)}
					</form.Field>
				</div>

				<div className="space-y-3 rounded-lg border p-4 lg:sticky lg:top-4 lg:max-h-[70vh] lg:overflow-y-auto">
					<div>
						<h2 className="font-semibold">Precios Mayoristas por Tour</h2>
						<p className="text-muted-foreground text-sm">
							Define precios negociados para esta agencia. Si dejas vacío, el sistema usa el precio
							base del tour.
						</p>
					</div>

					<form.Field name="tourPricing" mode="array">
						{(field) => (
							<div className="space-y-4">
								{field.state.value.length === 0 && (
									<div className="text-muted-foreground rounded border border-dashed p-4 text-sm">
										No hay tours activos para configurar.
									</div>
								)}

								{field.state.value.map((pricing, index) => {
									const tourName =
										activeTours?.find((tour) => tour.id === pricing.tourId)?.name ||
										agency?.tourPricing?.find((item) => item.tourId === pricing.tourId)?.tour
											?.name ||
										"Tour sin nombre"

									return (
										<Collapsible
											key={`${pricing.tourId}-${index}`}
											defaultOpen={index === 0}
											className="rounded border"
										>
											<CollapsibleTrigger asChild>
												<button
													type="button"
													className="group flex w-full items-center justify-between gap-3 p-3 text-left"
												>
													<div className="min-w-0">
														<p className="truncate font-medium">{tourName}</p>
													</div>
													<ChevronDown className="text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
												</button>
											</CollapsibleTrigger>

											<CollapsibleContent className="space-y-10 border-t p-3">
												{(pricing as any).priceCategoryOverrides && (pricing as any).priceCategoryOverrides.length > 0 && (
													<div className="space-y-2">
														<h4 className="text-sm font-medium">Precios de Categoría</h4>
														<div className="grid gap-3">
															{((pricing as any).priceCategoryOverrides || []).map((cat: any, catIndex: number) => {
																const activeTour = activeTours?.find((t) => t.id === pricing.tourId)
																const catDef = (activeTour?.priceCategories || []).find((c: any) => c.id === cat.tourPriceCategoryId)
																return (
																	<form.Field
																		key={`${pricing.tourId}-pco-${cat.tourPriceCategoryId}-${catIndex}`}
																		name={`tourPricing[${index}].priceCategoryOverrides[${catIndex}].price`}
																	>
																		{(subField) => (
																			<Field data-invalid={subField.state.meta.errors.length > 0}>
																				<FieldLabel htmlFor={subField.name}>
																					{catDef?.name || cat.tourPriceCategoryId}
																				</FieldLabel>
																				<Input
																					id={subField.name}
																					name={subField.name}
																					type="number"
																					min="0"
																					step="1"
																					value={subField.state.value || ""}
																					onBlur={subField.handleBlur}
																					onChange={(e) => subField.handleChange(e.target.value)}
																					placeholder="Ej: 35000"
																					aria-invalid={subField.state.meta.errors.length > 0}
																				/>
																				{subField.state.meta.errors.length > 0 && (
																					<FieldError errors={subField.state.meta.errors} />
																				)}
																			</Field>
																		)}
																	</form.Field>
																)
															})}
														</div>
													</div>
												)}

												{(pricing as any).entryOverrides && (pricing as any).entryOverrides.length > 0 && (
													<div className="space-y-2">
														<h4 className="text-sm font-medium">Precios de Entradas</h4>
														<div className="grid gap-3">
															{(() => {
																const activeTour = activeTours?.find((t) => t.id === pricing.tourId)
																const allEntries = activeTour ? flattenTourEntries(activeTour.priceCategories || []) : []
																return ((pricing as any).entryOverrides || []).map((entry: any, entryIndex: number) => {
																	const entryDef = allEntries.find((e: any) => e.id === entry.tourEntryId)
																	return (
																		<form.Field
																			key={`${pricing.tourId}-eo-${entry.tourEntryId}-${entryIndex}`}
																			name={`tourPricing[${index}].entryOverrides[${entryIndex}].price`}
																		>
																			{(subField) => (
																				<Field data-invalid={subField.state.meta.errors.length > 0}>
																					<FieldLabel htmlFor={subField.name}>
																						{entryDef ? `${entryDef.name}${entryDef.variantName ? ` - ${entryDef.variantName}` : ""}` : entry.tourEntryId}
																					</FieldLabel>
																					<Input
																						id={subField.name}
																						name={subField.name}
																						type="number"
																						min="0"
																						step="1"
																						value={subField.state.value || ""}
																						onBlur={subField.handleBlur}
																						onChange={(e) => subField.handleChange(e.target.value)}
																						placeholder="Ej: 35000"
																						aria-invalid={subField.state.meta.errors.length > 0}
																					/>
																					{subField.state.meta.errors.length > 0 && (
																						<FieldError errors={subField.state.meta.errors} />
																					)}
																				</Field>
																			)}
																		</form.Field>
																	)
																})
															})()}
														</div>
													</div>
												)}

												<div className="space-y-2">
													<h4 className="text-sm font-medium">Modo Privado (por capacidad)</h4>
													<div className="grid gap-3">
														{pricing.privatePriceTiers?.map((tier, tierIndex) => (
															<form.Field
																key={`${pricing.tourId}-tier-${tier.capacity}-${tierIndex}`}
																name={`tourPricing[${index}].privatePriceTiers[${tierIndex}].price`}
															>
																{(subField) => (
																	<Field data-invalid={subField.state.meta.errors.length > 0}>
																		<FieldLabel htmlFor={subField.name}>
																			Hasta {tier.capacity} pax
																		</FieldLabel>
																		<Input
																			id={subField.name}
																			name={subField.name}
																			type="number"
																			min="0"
																			step="1"
																			value={subField.state.value || ""}
																			onBlur={subField.handleBlur}
																			onChange={(e) => subField.handleChange(e.target.value)}
																			placeholder="Ej: 120000"
																			aria-invalid={subField.state.meta.errors.length > 0}
																		/>
																		{subField.state.meta.errors.length > 0 && (
																			<FieldError errors={subField.state.meta.errors} />
																		)}
																	</Field>
																)}
															</form.Field>
														))}
													</div>
												</div>
											</CollapsibleContent>
										</Collapsible>
									)
								})}
							</div>
						)}
					</form.Field>
				</div>
			</div>

			<div className="flex justify-end gap-2">
				<Button
					type="submit"
					disabled={isLoading}
					className="bg-primary text-white hover:bg-orange-600"
					data-testid="agency-button-form-submit"
				>
					{isLoading ? (
						<>
							<Spinner className="h-4 w-4" />
							Guardando...
						</>
					) : (
						<>{isEditing ? "Actualizar Agencia" : "Crear Agencia"}</>
					)}
				</Button>
			</div>
		</form>
	)
}
