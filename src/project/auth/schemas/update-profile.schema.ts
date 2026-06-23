import { z } from "zod"

export const updateProfileSchema = z.object({
	name: z
		.string()
		.trim()
		.min(2, { error: "El nombre debe tener al menos 2 caracteres" })
		.max(120, { error: "El nombre no puede tener más de 120 caracteres" }),
	phone: z
		.string()
		.trim()
		.max(40, { error: "El teléfono no puede tener más de 40 caracteres" })
		.nullable()
		.optional(),
})

export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>
