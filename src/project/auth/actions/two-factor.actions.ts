"use server"

import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { AuditService } from "@/lib/audit/service"
import { AUDIT_EVENT } from "@/lib/audit/events"
import {
	enableTwoFactorSchema,
	verifyTwoFactorSchema,
	disableTwoFactorSchema,
	regenerateBackupCodesSchema,
} from "../schemas/two-factor.schema"

// ─── Enable 2FA ──────────────────────────────────────────────────────────────

export interface EnableTwoFactorResult {
	ok: boolean
	error?: string
	data?: {
		totpURI: string
		backupCodes: string[]
	}
}

/**
 * Step 1 of the enable-2FA wizard.
 * Validates the user's current password and initialises the TOTP secret.
 * Returns the TOTP URI (for QR rendering) and backup codes (shown in step 4).
 * Does NOT commit 2FA as active — that happens on verifyTwoFactorSetupAction.
 */
export async function enableTwoFactorAction(input: unknown): Promise<EnableTwoFactorResult> {
	const session = await auth.api.getSession({ headers: await headers() })

	if (!session?.user) {
		return { ok: false, error: "No autorizado" }
	}

	const parsed = enableTwoFactorSchema.safeParse(input)
	if (!parsed.success) {
		const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos"
		return { ok: false, error: firstError }
	}

	try {
		const result = await auth.api.enableTwoFactor({
			body: { password: parsed.data.password },
			headers: await headers(),
		})

		return {
			ok: true,
			data: {
				totpURI: result.totpURI,
				backupCodes: result.backupCodes,
			},
		}
	} catch (e) {
		const message = e instanceof Error ? e.message : "Error al activar 2FA"

		// Better Auth returns "Invalid password" on wrong password
		if (message.toLowerCase().includes("invalid password") || message.toLowerCase().includes("password")) {
			return { ok: false, error: "Contraseña incorrecta. Revisá e intentá de nuevo." }
		}

		return { ok: false, error: "Error al iniciar la configuración de 2FA. Intentá de nuevo." }
	}
}

// ─── Verify TOTP setup ────────────────────────────────────────────────────────

export interface VerifyTwoFactorSetupResult {
	ok: boolean
	error?: string
}

/**
 * Step 3 of the enable-2FA wizard.
 * Verifies the 6-digit TOTP code from the authenticator app.
 * On success: revokes other sessions and writes the audit log.
 * After this call, 2FA is fully active for the user.
 */
export async function verifyTwoFactorSetupAction(input: unknown): Promise<VerifyTwoFactorSetupResult> {
	const session = await auth.api.getSession({ headers: await headers() })

	if (!session?.user) {
		return { ok: false, error: "No autorizado" }
	}

	const parsed = verifyTwoFactorSchema.safeParse(input)
	if (!parsed.success) {
		const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos"
		return { ok: false, error: firstError }
	}

	const requestHeaders = await headers()

	try {
		await auth.api.verifyTOTP({
			body: { code: parsed.data.code },
			headers: requestHeaders,
		})
	} catch (e) {
		const message = e instanceof Error ? e.message : ""

		if (message.toLowerCase().includes("invalid code") || message.toLowerCase().includes("invalid")) {
			return { ok: false, error: "Código incorrecto. Verificá que el reloj de tu dispositivo esté sincronizado e intentá de nuevo." }
		}

		return { ok: false, error: "Error al verificar el código. Intentá de nuevo." }
	}

	// Revoke other sessions so 2FA takes effect immediately on other devices
	try {
		await auth.api.revokeOtherSessions({ headers: requestHeaders })
	} catch (e) {
		// Non-fatal: session revocation failure shouldn't block 2FA activation
		console.error("[2fa] revokeOtherSessions failed after TOTP verify", e)
	}

	// Audit log — non-fatal
	try {
		await AuditService.createLog({
			action: "UPDATE",
			entityType: "User",
			entityId: session.user.id,
			user: {
				id: session.user.id,
				name: session.user.name,
				email: session.user.email,
			},
			description: "Activó autenticación de dos factores",
			metadata: {
				event: AUDIT_EVENT.USER_2FA_ENABLED,
				userId: session.user.id,
				timestamp: new Date().toISOString(),
			},
		})
	} catch (e) {
		console.error("[audit] USER_2FA_ENABLED failed", e)
	}

	return { ok: true }
}

// ─── Disable 2FA ──────────────────────────────────────────────────────────────

export interface DisableTwoFactorResult {
	ok: boolean
	error?: string
}

/**
 * Disables 2FA for the current user.
 * Flow: verify TOTP code first → if valid, call disableTwoFactor with password.
 * Prevents disabling without proving possession of the authenticator device.
 */
export async function disableTwoFactorAction(input: unknown): Promise<DisableTwoFactorResult> {
	const session = await auth.api.getSession({ headers: await headers() })

	if (!session?.user) {
		return { ok: false, error: "No autorizado" }
	}

	const parsed = disableTwoFactorSchema.safeParse(input)
	if (!parsed.success) {
		const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos"
		return { ok: false, error: firstError }
	}

	const requestHeaders = await headers()

	// Step 1: verify TOTP code — abort early if invalid
	try {
		await auth.api.verifyTOTP({
			body: { code: parsed.data.code },
			headers: requestHeaders,
		})
	} catch (e) {
		const message = e instanceof Error ? e.message : ""

		if (message.toLowerCase().includes("invalid code") || message.toLowerCase().includes("invalid")) {
			return { ok: false, error: "Código inválido" }
		}

		return { ok: false, error: "Error al verificar el código TOTP. Intentá de nuevo." }
	}

	// Step 2: TOTP verified — now disable 2FA with password
	try {
		await auth.api.disableTwoFactor({
			body: { password: parsed.data.password },
			headers: requestHeaders,
		})
	} catch (e) {
		const message = e instanceof Error ? e.message : ""

		if (message.toLowerCase().includes("invalid password") || message.toLowerCase().includes("password")) {
			return { ok: false, error: "Contraseña incorrecta. Revisá e intentá de nuevo." }
		}

		return { ok: false, error: "Error al desactivar 2FA. Intentá de nuevo." }
	}

	// Audit log — non-fatal
	try {
		await AuditService.createLog({
			action: "UPDATE",
			entityType: "User",
			entityId: session.user.id,
			user: {
				id: session.user.id,
				name: session.user.name,
				email: session.user.email,
			},
			description: "Desactivó autenticación de dos factores",
			metadata: {
				event: AUDIT_EVENT.USER_2FA_DISABLED,
				userId: session.user.id,
				timestamp: new Date().toISOString(),
			},
		})
	} catch (e) {
		console.error("[audit] USER_2FA_DISABLED failed", e)
	}

	return { ok: true }
}

// ─── Regenerate backup codes ──────────────────────────────────────────────────

export interface RegenerateBackupCodesResult {
	ok: boolean
	error?: string
	data?: {
		backupCodes: string[]
	}
}

/**
 * Regenerates backup codes for the current user.
 * Requires the user's current password. Previous codes are immediately invalidated.
 */
export async function regenerateBackupCodesAction(input: unknown): Promise<RegenerateBackupCodesResult> {
	const session = await auth.api.getSession({ headers: await headers() })

	if (!session?.user) {
		return { ok: false, error: "No autorizado" }
	}

	const parsed = regenerateBackupCodesSchema.safeParse(input)
	if (!parsed.success) {
		const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos"
		return { ok: false, error: firstError }
	}

	try {
		const result = await auth.api.generateBackupCodes({
			body: { password: parsed.data.password },
			headers: await headers(),
		})

		// Audit log — non-fatal
		try {
			await AuditService.createLog({
				action: "UPDATE",
				entityType: "User",
				entityId: session.user.id,
				user: {
					id: session.user.id,
					name: session.user.name,
					email: session.user.email,
				},
				description: "Regeneró códigos de respaldo de 2FA",
				metadata: {
					event: AUDIT_EVENT.USER_2FA_BACKUP_CODES_REGENERATED,
					userId: session.user.id,
					timestamp: new Date().toISOString(),
				},
			})
		} catch (e) {
			console.error("[audit] USER_2FA_BACKUP_CODES_REGENERATED failed", e)
		}

		return {
			ok: true,
			data: {
				backupCodes: result.backupCodes,
			},
		}
	} catch (e) {
		const message = e instanceof Error ? e.message : ""

		if (message.toLowerCase().includes("invalid password") || message.toLowerCase().includes("password")) {
			return { ok: false, error: "Contraseña incorrecta. Revisá e intentá de nuevo." }
		}

		return { ok: false, error: "Error al regenerar los códigos de respaldo. Intentá de nuevo." }
	}
}
