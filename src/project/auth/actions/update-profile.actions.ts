"use server"

import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { updateProfileSchema } from "../schemas/update-profile.schema"

export interface UpdateProfileResult {
	ok: boolean
	error?: string
}

export async function updateMyProfileAction(input: unknown): Promise<UpdateProfileResult> {
	const session = await auth.api.getSession({ headers: await headers() })

	if (!session?.user) {
		return { ok: false, error: "No autorizado" }
	}

	const parsed = updateProfileSchema.safeParse(input)
	if (!parsed.success) {
		const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos"
		return { ok: false, error: firstError }
	}

	const { name, phone } = parsed.data

	try {
		await prisma.user.update({
			where: { id: session.user.id },
			data: { name, phone: phone ?? null },
		})
	} catch {
		return { ok: false, error: "Error al guardar los datos. Intentá de nuevo." }
	}

	return { ok: true }
}
