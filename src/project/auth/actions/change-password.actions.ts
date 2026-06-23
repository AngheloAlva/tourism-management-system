"use server"

import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AuditService } from "@/lib/audit/service"
import { changePasswordSchema } from "../schemas/change-password.schema"

export interface ChangePasswordResult {
	ok: boolean
	error?: string
}

export interface MarkMustChangePasswordResult {
	ok: boolean
	error?: string
}

export async function changeMyPasswordAction(
	input: unknown,
): Promise<ChangePasswordResult> {
	const session = await auth.api.getSession({ headers: await headers() })

	if (!session?.user) {
		return { ok: false, error: "No autorizado" }
	}

	const parsed = changePasswordSchema.safeParse(input)
	if (!parsed.success) {
		const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos"
		return { ok: false, error: firstError }
	}

	const { currentPassword, newPassword } = parsed.data

	try {
		await auth.api.changePassword({
			headers: await headers(),
			body: {
				currentPassword,
				newPassword,
				revokeOtherSessions: false,
			},
		})
	} catch {
		return { ok: false, error: "La contraseña actual es incorrecta" }
	}

	try {
		await prisma.user.update({
			where: { id: session.user.id },
			data: { mustChangePassword: false },
		})
	} catch {
		return {
			ok: false,
			error:
				"La contraseña fue actualizada, pero hubo un error al limpiar el marcador. Cerrá sesión y volvé a ingresar.",
		}
	}

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
			description: "El usuario cambió su contraseña por primera vez",
		})
	} catch {
		// Audit failure is non-fatal
	}

	return { ok: true }
}

export async function markUserMustChangePasswordAction(
	userId: string,
): Promise<MarkMustChangePasswordResult> {
	const session = await auth.api.getSession({ headers: await headers() })

	if (!session?.user || session.user.role !== "admin") {
		return { ok: false, error: "No autorizado" }
	}

	if (!userId || typeof userId !== "string") {
		return { ok: false, error: "ID de usuario inválido" }
	}

	try {
		await prisma.user.update({
			where: { id: userId },
			data: { mustChangePassword: true },
		})
	} catch {
		return { ok: false, error: "Error al actualizar el usuario" }
	}

	return { ok: true }
}
