import { z } from "zod"

// ─── Schemas: separated tour pricing and entries ──────────────────────────────

export const tourEntrySchema = z.object({
	id: z.string().optional(),
	name: z.string().min(1, "El nombre de la entrada es obligatorio"),
	variantName: z.string().min(1, "El nombre de variante es obligatorio"),
	price: z.number().min(0, "El precio debe ser mayor o igual a 0"),
	isDefault: z.boolean(),
	isSpecial: z.boolean(),
	sortOrder: z.number().int(),
	active: z.boolean(),
})

export const priceCategorySchema = z.object({
	id: z.string().optional(),
	name: z.string().min(1, "El nombre es obligatorio"),
	price: z.number().min(0, "El precio debe ser mayor o igual a 0"),
	receptionPrice: z.number().min(0),
	transferPrice: z.number().min(0),
	minPrice: z.number().min(0).optional().nullable(),
	maxPrice: z.number().min(0).optional().nullable(),
	ageMin: z.number().int().optional().nullable(),
	ageMax: z.number().int().optional().nullable(),
	isDefault: z.boolean(),
	isSpecial: z.boolean(),
	sortOrder: z.number().int(),
	active: z.boolean(),
	entries: z.array(tourEntrySchema),
})

export const privatePricingSchema = z
	.array(
		z.object({
			capacity: z.number(),
			price: z.number().min(0, "El precio debe ser mayor o igual a 0"),
			entryPrice: z.number().min(0),
		})
	)
	.optional()
	.nullable()

export const tourSchema = z.object({
	name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
	description: z.string().optional().nullable(),
	recommendations: z.string().optional().nullable(),

	maxCapacity: z.number().int().min(1, "La capacidad debe ser al menos 1"),

	priceCategories: z
		.array(priceCategorySchema)
		.min(1, "Debe tener al menos una categoría de precio"),

	privatePricing: privatePricingSchema,

	startTime: z.string().optional().nullable(),
	endTime: z.string().optional().nullable(),
	websiteUrl: z.string().url("Debe ser una URL valida").optional().or(z.literal("")).nullable(),
	imageUrl: z.string().optional().nullable(),

	generalSummaryEs: z.string().max(300, "Maximo 300 caracteres").optional().nullable(),
	generalSummaryEn: z.string().max(300, "Maximo 300 caracteres").optional().nullable(),
	generalSummaryPt: z.string().max(300, "Maximo 300 caracteres").optional().nullable(),

	scheduleEs: z.string().optional().nullable(),
	scheduleEn: z.string().optional().nullable(),
	schedulePt: z.string().optional().nullable(),

	includesEs: z.string().optional().nullable(),
	includesEn: z.string().optional().nullable(),
	includesPt: z.string().optional().nullable(),

	pickupEs: z.string().optional().nullable(),
	pickupEn: z.string().optional().nullable(),
	pickupPt: z.string().optional().nullable(),

	whatToBringEs: z.string().optional().nullable(),
	whatToBringEn: z.string().optional().nullable(),
	whatToBringPt: z.string().optional().nullable(),

	altitudeEs: z.string().optional().nullable(),
	altitudeEn: z.string().optional().nullable(),
	altitudePt: z.string().optional().nullable(),

	active: z.boolean(),
})

export const createTourSchema = tourSchema

export const updateTourSchema = tourSchema.partial().extend({
	id: z.string(),
})

export type Tour = z.infer<typeof tourSchema>
export type CreateTour = z.infer<typeof createTourSchema>
export type UpdateTour = z.infer<typeof updateTourSchema>
export type PriceCategory = z.infer<typeof priceCategorySchema>
export type TourEntry = z.infer<typeof tourEntrySchema>
export type PrivatePricing = z.infer<typeof privatePricingSchema>
