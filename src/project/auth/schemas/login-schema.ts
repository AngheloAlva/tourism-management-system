import { z } from "zod"

export const loginSchema = z.object({
	email: z.email({ message: "Email inválido" }),
	password: z.string().min(1, { message: "Contraseña es requerida" }),
})

export type LoginSchema = z.infer<typeof loginSchema>
