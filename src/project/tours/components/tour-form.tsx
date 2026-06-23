"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Clock, FileText, Globe, Languages, Loader2, Tag, Users } from "lucide-react"

import { tourSchema, type Tour as TourFormData } from "../schemas/tour.schema"
import { useCreateTour, useUpdateTour } from "../hooks/use-tours"
import type { TourWithDerivedPricing } from "../actions/tour.actions"
import { DEFAULT_PRICE_CATEGORIES } from "../constants/default-price-categories"
import { useAppForm } from "@/shared/components/ui/tanstack-form"

/**
 * Helper to extract the form type without needing to replicate all TanStack Form generics.
 * The function body is unreachable; it exists only for `ReturnType` inference.
 */
function _inferTourForm() {
	// eslint-disable-next-line react-hooks/rules-of-hooks
	return useAppForm({
		defaultValues: {} as TourFormData,
		validators: { onChange: tourSchema },
	})
}
export type TourFormApi = ReturnType<typeof _inferTourForm>

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"
import { Textarea } from "@/shared/components/ui/textarea"
import { PriceCategoryTab } from "./regular-pricing-tab"
import { PrivatePricingTab } from "./private-pricing-tab"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Switch } from "@/shared/components/ui/switch"
import { Label } from "@/shared/components/ui/label"
import { Separator } from "@/shared/components/ui/separator"
import { Badge } from "@/shared/components/ui/badge"
import {
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	CardDescription,
} from "@/shared/components/ui/card"

// ---------------------------------------------------------------------------
// Language fields configuration
// ---------------------------------------------------------------------------

type LangSuffix = "Es" | "En" | "Pt"

interface LangFieldDef {
	base: string
	labels: Record<LangSuffix, string>
	placeholders: Record<LangSuffix, string>
	type: "textarea" | "input"
	maxLength?: number
	rows?: number
}

const LANG_FIELDS: LangFieldDef[] = [
	{
		base: "generalSummary",
		labels: {
			Es: "Resumen General (max. 300 caracteres)",
			En: "General Summary (max. 300 chars)",
			Pt: "Resumo Geral (max. 300 caracteres)",
		},
		placeholders: {
			Es: "Resumen en español...",
			En: "Summary in English...",
			Pt: "Resumo em português...",
		},
		type: "textarea",
		maxLength: 300,
		rows: 3,
	},
	{
		base: "schedule",
		labels: { Es: "Horario", En: "Schedule", Pt: "Horario" },
		placeholders: {
			Es: "Horario en español...",
			En: "Schedule in English...",
			Pt: "Horario em português...",
		},
		type: "textarea",
		rows: 3,
	},
	{
		base: "includes",
		labels: { Es: "Incluye", En: "Includes", Pt: "Inclui" },
		placeholders: {
			Es: "Que incluye...",
			En: "What's included...",
			Pt: "O que inclui...",
		},
		type: "textarea",
		rows: 4,
	},
	{
		base: "pickup",
		labels: { Es: "Recogida", En: "Pickup", Pt: "Recolha" },
		placeholders: {
			Es: "Informacion de recogida...",
			En: "Pickup information...",
			Pt: "Informacao de recolha...",
		},
		type: "textarea",
		rows: 3,
	},
	{
		base: "whatToBring",
		labels: { Es: "Que llevar", En: "What to bring", Pt: "O que trazer" },
		placeholders: {
			Es: "Que llevar...",
			En: "What to bring...",
			Pt: "O que trazer...",
		},
		type: "textarea",
		rows: 3,
	},
	{
		base: "altitude",
		labels: { Es: "Altura", En: "Altitude", Pt: "Altitude" },
		placeholders: {
			Es: "Ej: 3,800 msnm",
			En: "Ex: 3,800 masl",
			Pt: "Ex: 3.800 m acima do nivel do mar",
		},
		type: "input",
	},
]

function LanguageFields({ form, lang }: { form: TourFormApi; lang: LangSuffix }) {
	return (
		<div className="space-y-4">
			{LANG_FIELDS.map((fieldDef) => {
				// Field names like "generalSummaryEs" exist in the schema — safe cast
				const fieldName = `${fieldDef.base}${lang}` as keyof TourFormData & string
				return (
					<form.AppField key={fieldName} name={fieldName}>
						{(field) => (
							<field.Field>
								<field.FieldLabel>{fieldDef.labels[lang]}</field.FieldLabel>
								{fieldDef.type === "textarea" ? (
									<>
										<Textarea
											value={(field.state.value as string) || ""}
											onChange={(e) => field.handleChange(e.target.value || null)}
											placeholder={fieldDef.placeholders[lang]}
											rows={fieldDef.rows}
											maxLength={fieldDef.maxLength}
											className="resize-none"
										/>
										{fieldDef.maxLength && (
											<p className="text-muted-foreground text-xs">
												{((field.state.value as string) || "").length}/{fieldDef.maxLength}{" "}
												caracteres
											</p>
										)}
									</>
								) : (
									<Input
										value={(field.state.value as string) || ""}
										onChange={(e) => field.handleChange(e.target.value || null)}
										placeholder={fieldDef.placeholders[lang]}
									/>
								)}
							</field.Field>
						)}
					</form.AppField>
				)
			})}
		</div>
	)
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------

interface TourFormProps {
	tour?: TourWithDerivedPricing
}

export function TourForm({ tour }: TourFormProps) {
	const router = useRouter()
	const isEditing = !!tour
	const createTour = useCreateTour()
	const updateTour = useUpdateTour()

	const defaultPriceCategories =
		tour?.priceCategories && tour.priceCategories.length > 0
			? tour.priceCategories.map((et, index) => ({
					id: et.id,
					name: et.name,
					price: et.price,
					receptionPrice: et.receptionPrice,
					transferPrice: et.transferPrice ?? 0,
					minPrice: et.minPrice ?? 0,
					maxPrice: et.maxPrice ?? 0,
					ageMin: et.ageMin,
					ageMax: et.ageMax,
					isDefault: et.isDefault,
					isSpecial: et.isSpecial,
					sortOrder: et.sortOrder ?? index,
					active: true,
					entries: (et.entries || []).map((entry, idx) => ({
						id: entry.id,
						name: entry.name,
						variantName: entry.variantName,
						price: entry.price,
						isDefault: entry.isDefault,
						isSpecial: entry.isSpecial,
						sortOrder: entry.sortOrder ?? idx,
						active: true,
					})),
				}))
			: DEFAULT_PRICE_CATEGORIES

	const form = useAppForm({
		defaultValues: {
			name: tour?.name || "",
			description: tour?.description || null,
			recommendations: tour?.recommendations || null,
			maxCapacity: tour?.maxCapacity || 12,

			priceCategories: defaultPriceCategories,

			privatePricing: Object.values(tour?.privatePriceTiers || tour?.privatePricing || []).map(
				(tier: { capacity: number; price: number; entryPrice?: number }) => ({
					capacity: tier.capacity,
					price: tier.price,
					entryPrice: tier.entryPrice ?? 0,
				})
			),

			startTime: tour?.startTime || null,
			endTime: tour?.endTime || null,
			websiteUrl: tour?.websiteUrl || null,
			imageUrl: tour?.imageUrl || null,

			generalSummaryEs: tour?.generalSummaryEs || null,
			generalSummaryEn: tour?.generalSummaryEn || null,
			generalSummaryPt: tour?.generalSummaryPt || null,
			scheduleEs: tour?.scheduleEs || null,
			scheduleEn: tour?.scheduleEn || null,
			schedulePt: tour?.schedulePt || null,
			includesEs: tour?.includesEs || null,
			includesEn: tour?.includesEn || null,
			includesPt: tour?.includesPt || null,
			pickupEs: tour?.pickupEs || null,
			pickupEn: tour?.pickupEn || null,
			pickupPt: tour?.pickupPt || null,
			whatToBringEs: tour?.whatToBringEs || null,
			whatToBringEn: tour?.whatToBringEn || null,
			whatToBringPt: tour?.whatToBringPt || null,
			altitudeEs: tour?.altitudeEs || null,
			altitudeEn: tour?.altitudeEn || null,
			altitudePt: tour?.altitudePt || null,

			active: tour?.active ?? true,
		} as TourFormData,
		validators: {
			onChange: tourSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				if (isEditing) {
					await updateTour.mutateAsync({ id: tour.id, ...value })
				} else {
					await createTour.mutateAsync(value)
				}
				router.push("/dashboard/tours")
			} catch (error) {
				// The mutation hooks surface the server error via toast (onError).
				// Keep the log for debugging and stop here so we don't navigate away.
				console.error("Error saving tour:", error)
			}
		},
	})

	const isLoading = createTour.isPending || updateTour.isPending

	return (
		<form
			// noValidate disables native browser constraint validation (e.g. the URL
			// field is <input type="url">). Without this, an invalid value silently
			// blocks submit before our handler runs — the button appears dead. We let
			// Zod/TanStack own validation so errors are shown inline + via toast.
			noValidate
			onSubmit={(e) => {
				e.preventDefault()
				e.stopPropagation()
				// If validation fails, handleSubmit would silently do nothing and the
				// button looks dead. Surface why and stop — there's nothing to submit.
				if (!tourSchema.safeParse(form.state.values).success) {
					toast.error("Corrige los errores marcados antes de guardar")
					return
				}
				form.handleSubmit()
			}}
			className="space-y-6"
		>
			{/* ------------------------------------------------------------------ */}
			{/* Header                                                             */}
			{/* ------------------------------------------------------------------ */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="min-w-0 flex-1 space-y-1">
					<form.AppField name="name">
						{(field) => (
							<field.Field data-invalid={field.state.meta.errors.length > 0}>
								<Input
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Nombre del tour..."
									className="h-auto border-none bg-transparent px-0 text-xl! font-bold shadow-none focus-visible:ring-0"
									data-testid="tour-input-name"
								/>
								<field.FieldError />
							</field.Field>
						)}
					</form.AppField>
					<p className="text-muted-foreground text-sm">
						{isEditing ? "Editando tour o paquete" : "Creando nuevo tour o paquete"}
					</p>
				</div>

				<div className="flex shrink-0 items-center gap-2">
					<form.AppField name="active">
						{(field) => (
							<div className="flex items-center gap-2">
								<Badge variant={field.state.value ? "default" : "secondary"}>
									{field.state.value ? "Activo" : "Inactivo"}
								</Badge>
								<Switch
									checked={field.state.value}
									onCheckedChange={(checked) => field.handleChange(checked)}
								/>
							</div>
						)}
					</form.AppField>

					<Separator orientation="vertical" className="mx-1 h-6" />

					<Button
						type="button"
						variant="outline"
						onClick={() => router.push("/dashboard/tours")}
						disabled={isLoading}
					>
						Cancelar
					</Button>
					<Button type="submit" disabled={isLoading} data-testid="tour-button-form-submit">
						{isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
						{isEditing ? "Guardar" : "Crear Tour"}
					</Button>
				</div>
			</div>

			<Separator />

			{/* ------------------------------------------------------------------ */}
			{/* Two-column layout                                                  */}
			{/* ------------------------------------------------------------------ */}
			<div className="grid gap-6 lg:grid-cols-[1fr_340px]">
				{/* -------------------------------------------------------------- */}
				{/* Main content — Tabs                                            */}
				{/* -------------------------------------------------------------- */}
				<Tabs defaultValue="general" className="w-full">
					<TabsList className="grid w-full grid-cols-4">
						<TabsTrigger value="general">General</TabsTrigger>
						<TabsTrigger value="regular">Precios</TabsTrigger>
						<TabsTrigger value="private">Privados</TabsTrigger>
						<TabsTrigger value="details">Detalles</TabsTrigger>
					</TabsList>

					{/* General tab */}
					<TabsContent value="general" className="mt-4">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-3">
									<div className="flex size-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
										<FileText className="size-4" />
									</div>
									Informacion General
								</CardTitle>
								<CardDescription>Descripcion y recomendaciones del tour</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<form.AppField name="description">
									{(field) => (
										<field.Field>
											<field.FieldLabel>Detalle del Tour</field.FieldLabel>
											<Textarea
												value={field.state.value || ""}
												onChange={(e) => field.handleChange(e.target.value || null)}
												placeholder="Descripcion detallada del tour..."
												rows={4}
												className="resize-none"
											/>
										</field.Field>
									)}
								</form.AppField>

								<form.AppField name="recommendations">
									{(field) => (
										<field.Field>
											<field.FieldLabel>Recomendaciones del Evento/Tour</field.FieldLabel>
											<Textarea
												value={field.state.value || ""}
												onChange={(e) => field.handleChange(e.target.value || null)}
												placeholder="Ej: Entrada a Valle de la Luna (CLP$10.800 adultos, CLP$5.400 ninos)"
												rows={4}
												className="resize-none"
											/>
											<p className="text-muted-foreground text-sm">
												Incluye detalles sobre entradas, requisitos especiales, etc.
											</p>
										</field.Field>
									)}
								</form.AppField>
							</CardContent>
						</Card>
					</TabsContent>

					{/* Regular pricing tab */}
					<TabsContent value="regular" className="mt-4">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-3">
									<div className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
										<Tag className="size-4" />
									</div>
									Precios Regulares
								</CardTitle>
								<CardDescription>Categorias de precio por rango de edad</CardDescription>
							</CardHeader>
							<CardContent>
								<PriceCategoryTab form={form} />
							</CardContent>
						</Card>
					</TabsContent>

					{/* Private pricing tab */}
					<TabsContent value="private" className="mt-4">
						<PrivatePricingTab form={form} />
					</TabsContent>

					{/* Details tab — nested language tabs */}
					<TabsContent value="details" className="mt-4">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-3">
									<div className="flex size-8 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
										<Languages className="size-4" />
									</div>
									Detalles del Tour
								</CardTitle>
								<CardDescription>
									Informacion detallada en diferentes idiomas para vouchers
								</CardDescription>
							</CardHeader>
							<CardContent>
								<Tabs defaultValue="es">
									<TabsList className="grid w-full grid-cols-3">
										<TabsTrigger value="es">Español</TabsTrigger>
										<TabsTrigger value="en">English</TabsTrigger>
										<TabsTrigger value="pt">Portugues</TabsTrigger>
									</TabsList>
									<TabsContent value="es" className="mt-4">
										<LanguageFields form={form} lang="Es" />
									</TabsContent>
									<TabsContent value="en" className="mt-4">
										<LanguageFields form={form} lang="En" />
									</TabsContent>
									<TabsContent value="pt" className="mt-4">
										<LanguageFields form={form} lang="Pt" />
									</TabsContent>
								</Tabs>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>

				{/* -------------------------------------------------------------- */}
				{/* Sidebar                                                        */}
				{/* -------------------------------------------------------------- */}
				<div className="flex flex-col gap-4">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-3 text-base">
								<div className="flex size-7 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
									<Users className="size-3.5" />
								</div>
								Capacidad
							</CardTitle>
						</CardHeader>
						<CardContent>
							<form.AppField name="maxCapacity">
								{(field) => (
									<field.Field data-invalid={field.state.meta.errors.length > 0}>
										<field.FieldLabel>
											Capacidad Maxima <span className="text-destructive">*</span>
										</field.FieldLabel>
										<Input
											type="number"
											value={field.state.value}
											onChange={(e) => field.handleChange(parseInt(e.target.value) || 12)}
											placeholder="12"
										/>
										<field.FieldError />
									</field.Field>
								)}
							</form.AppField>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-3 text-base">
								<div className="flex size-7 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
									<Clock className="size-3.5" />
								</div>
								Horarios
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							<form.AppField name="startTime">
								{(field) => (
									<field.Field>
										<field.FieldLabel>Hora de Inicio</field.FieldLabel>
										<Input
											type="time"
											value={field.state.value || ""}
											onChange={(e) => field.handleChange(e.target.value || null)}
										/>
									</field.Field>
								)}
							</form.AppField>

							<form.AppField name="endTime">
								{(field) => (
									<field.Field>
										<field.FieldLabel>Hora de Fin</field.FieldLabel>
										<Input
											type="time"
											value={field.state.value || ""}
											onChange={(e) => field.handleChange(e.target.value || null)}
										/>
									</field.Field>
								)}
							</form.AppField>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-3 text-base">
								<div className="flex size-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
									<Globe className="size-3.5" />
								</div>
								Web
							</CardTitle>
						</CardHeader>
						<CardContent>
							<form.AppField name="websiteUrl">
								{(field) => (
									<field.Field data-invalid={field.state.meta.errors.length > 0}>
										<field.FieldLabel>URL del Tour</field.FieldLabel>
										<Input
											type="url"
											value={field.state.value || ""}
											onChange={(e) => field.handleChange(e.target.value || null)}
											placeholder="https://ejemplo.com/tour"
										/>
										<field.FieldError />
									</field.Field>
								)}
							</form.AppField>
						</CardContent>
					</Card>
				</div>
			</div>
		</form>
	)
}
