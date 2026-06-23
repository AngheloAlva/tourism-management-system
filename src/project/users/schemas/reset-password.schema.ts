import { z } from "zod"

export const resetPasswordSchema = z
	.object({
		userId: z.string().min(1, { error: "El ID de usuario es obligatorio" }),
		mode: z.enum(["random", "manual"]),
		manualPassword: z
			.string()
			.min(8, { error: "La contraseña debe tener al menos 8 caracteres" })
			.max(128, { error: "La contraseña no puede tener más de 128 caracteres" })
			.optional(),
	})
	.superRefine((data, ctx) => {
		if (data.mode === "manual" && !data.manualPassword) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Debés ingresar una contraseña cuando el modo es manual",
				path: ["manualPassword"],
			})
		}
	})

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>
