"use server"

import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AuditService } from "@/lib/audit/service"
import { AUDIT_EVENT } from "@/lib/audit/events"
import { resetPasswordSchema } from "../schemas/reset-password.schema"
import { generateTemporaryPassword } from "../utils/generate-temporary-password"

export interface ResetPasswordResult {
	ok: boolean
	error?: string
	data?: { temporaryPassword: string }
}

export async function resetUserPasswordAction(input: unknown): Promise<ResetPasswordResult> {
	const session = await auth.api.getSession({ headers: await headers() })

	if (!session?.user) {
		return { ok: false, error: "No autorizado" }
	}

	if (session.user.role !== "admin") {
		return { ok: false, error: "Solo los administradores pueden resetear contraseñas" }
	}

	const parsed = resetPasswordSchema.safeParse(input)
	if (!parsed.success) {
		const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos"
		return { ok: false, error: firstError }
	}

	const { userId, mode, manualPassword } = parsed.data

	// Self-reset guard: admin must use Mi Cuenta to change their own password
	if (session.user.id === userId) {
		return {
			ok: false,
			error: "No podés resetear tu propia contraseña. Usá la sección de cambio de contraseña en Mi Cuenta.",
		}
	}

	// Fetch target user to include in audit log
	let targetUser: { email: string; name: string }
	try {
		targetUser = await prisma.user.findUniqueOrThrow({
			where: { id: userId },
			select: { email: true, name: true },
		})
	} catch {
		return { ok: false, error: "Usuario no encontrado" }
	}

	let temporaryPassword: string
	if (mode === "random") {
		temporaryPassword = generateTemporaryPassword()
	} else {
		// Schema's superRefine guarantees manualPassword is present when mode === "manual",
		// but TS can't narrow through superRefine — guard explicitly.
		if (!manualPassword) {
			return { ok: false, error: "Falta la contraseña manual" }
		}
		temporaryPassword = manualPassword
	}

	// Set the new password via Better Auth admin API
	try {
		await auth.api.setUserPassword({
			body: { userId, newPassword: temporaryPassword },
			headers: await headers(),
		})
	} catch {
		return { ok: false, error: "Error al resetear la contraseña. Intentá de nuevo." }
	}

	// Mark user as must-change-password on next login
	try {
		await prisma.user.update({
			where: { id: userId },
			data: { mustChangePassword: true },
		})
	} catch {
		return { ok: false, error: "Contraseña reseteada, pero hubo un error al marcar cambio obligatorio." }
	}

	// Audit log — NEVER include the password
	try {
		await AuditService.createLog({
			action: "UPDATE",
			entityType: "User",
			entityId: userId,
			user: {
				id: session.user.id,
				name: session.user.name,
				email: session.user.email,
			},
			description: "Reseteó la contraseña del usuario",
			metadata: {
				event: AUDIT_EVENT.USER_PASSWORD_RESET_BY_ADMIN,
				actorId: session.user.id,
				actorEmail: session.user.email,
				targetUserId: userId,
				targetEmail: targetUser.email,
				timestamp: new Date().toISOString(),
			},
		})
	} catch (e) {
		// Audit failure is non-fatal — log so it surfaces in Vercel logs for ops.
		console.error("[audit] USER_PASSWORD_RESET_BY_ADMIN failed", e)
	}

	return { ok: true, data: { temporaryPassword } }
}
