import { z } from "zod"

export const changePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, { error: "La contraseña actual es obligatoria" }),
		newPassword: z
			.string()
			.min(8, { error: "La nueva contraseña debe tener al menos 8 caracteres" })
			.max(128, { error: "La nueva contraseña no puede tener más de 128 caracteres" }),
		confirmPassword: z.string().min(1, { error: "Debes confirmar la nueva contraseña" }),
	})
	.superRefine((data, ctx) => {
		if (data.newPassword !== data.confirmPassword) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Las contraseñas no coinciden",
				path: ["confirmPassword"],
			})
		}
	})

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>
