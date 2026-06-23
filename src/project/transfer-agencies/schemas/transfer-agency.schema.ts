import { z } from "zod"

export const transferAgencySchema = z.object({
	name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
	contactEmails: z
		.array(z.object({ email: z.string().email("Debe ser un correo válido") }))
		.min(1, "Debe agregar al menos un correo de contacto"),
	phone: z.string().optional().nullable(),
	country: z.string().optional().nullable(),
	address: z.string().optional().nullable(),
	website: z.string().url("Debe ser una URL válida").optional().or(z.literal("")).nullable(),
	taxId: z.string().optional().nullable(),
	active: z.boolean().default(true).optional(),
})

export type CreateTransferAgency = z.infer<typeof transferAgencySchema>
export type UpdateTransferAgency = Partial<CreateTransferAgency> & { id: string }
