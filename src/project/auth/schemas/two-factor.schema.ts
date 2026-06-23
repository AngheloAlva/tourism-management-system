import { z } from "zod"

export const enableTwoFactorSchema = z.object({
	password: z.string().min(1, "La contraseña es requerida"),
})

export const verifyTwoFactorSchema = z.object({
	code: z.string().length(6, "El código debe tener exactamente 6 dígitos"),
})

export const disableTwoFactorSchema = z.object({
	password: z.string().min(1, "La contraseña es requerida"),
	code: z.string().length(6, "El código TOTP debe tener exactamente 6 dígitos"),
})

export const regenerateBackupCodesSchema = z.object({
	password: z.string().min(1, "La contraseña es requerida"),
})

export type EnableTwoFactorData = z.infer<typeof enableTwoFactorSchema>
export type VerifyTwoFactorData = z.infer<typeof verifyTwoFactorSchema>
export type DisableTwoFactorData = z.infer<typeof disableTwoFactorSchema>
export type RegenerateBackupCodesData = z.infer<typeof regenerateBackupCodesSchema>
