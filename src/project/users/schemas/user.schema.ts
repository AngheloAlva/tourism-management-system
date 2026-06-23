import { z } from "zod"

// Schema para crear/editar usuario
export const userSchema = z.object({
	name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
	email: z.string().email("Email inválido"),
	password: z
		.string()
		.min(8, "La contraseña debe tener al menos 8 caracteres")
		.max(128, "La contraseña no puede tener más de 128 caracteres"),
	role: z.string().min(1, "Debe seleccionar un rol"),
	rut: z
		.string()
		.min(8, "El RUT debe tener al menos 8 caracteres")
		.regex(/^[0-9kK.\-]+$/, "Formato de RUT inválido"),
	phone: z.string().min(8, "El teléfono es obligatorio"),
	birthDate: z.string().min(1, "La fecha de nacimiento es obligatoria"),
	workSchedule: z.string().min(3, "El horario de trabajo es obligatorio"),
	image: z.string().url("URL inválida").optional().or(z.literal("")),
})

export type UserFormData = z.infer<typeof userSchema>
