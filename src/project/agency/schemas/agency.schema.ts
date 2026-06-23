import { z } from "zod"

export const agencyTourPrivateTierSchema = z.object({
	capacity: z.number().int().min(1, "La capacidad debe ser mayor o igual a 1"),
	price: z.string().optional().nullable(),
})

export const agencyPriceCategoryOverrideSchema = z.object({
	tourPriceCategoryId: z.string(),
	price: z.union([z.number(), z.string()]),
})

export const agencyEntryOverrideSchema = z.object({
	tourEntryId: z.string(),
	price: z.union([z.number(), z.string()]),
})

export const agencyTourPricingSchema = z.object({
	tourId: z.string().min(1, "El tour es obligatorio"),
	privatePriceTiers: z.array(agencyTourPrivateTierSchema).default([]),
	priceCategoryOverrides: z.array(agencyPriceCategoryOverrideSchema).optional(),
	entryOverrides: z.array(agencyEntryOverrideSchema).optional(),
})

export const agencySchema = z.object({
	name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
	contactEmails: z
		.array(z.object({ email: z.string().email("Debe ser un correo válido") }))
		.min(1, "Debe agregar al menos un correo de contacto"),
	phone: z.string().optional().nullable(),
	country: z.string().optional().nullable(),
	address: z.string().optional().nullable(),
	website: z.string().url("Debe ser una URL válida").optional().or(z.literal("")).nullable(),
	taxId: z.string().optional().nullable(),
	codePrefix: z.string().optional().nullable(),
	codeLength: z.string().optional().nullable(),
	active: z.boolean().default(true).optional(),
	tourPricing: z.array(agencyTourPricingSchema).default([]),
})

export type CreateAgency = z.infer<typeof agencySchema>
export type UpdateAgency = Partial<CreateAgency> & { id: string }
