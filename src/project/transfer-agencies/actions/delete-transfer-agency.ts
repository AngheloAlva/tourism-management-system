"use server"

import { headers } from "next/headers"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { canCurrentUserInteractPath } from "@/project/roles/actions/role.actions"

export async function deleteTransferAgency(id: string): Promise<void> {
	const session = await auth.api.getSession({ headers: await headers() })
	if (!session?.user) throw new Error("No autorizado")

	const canInteract = await canCurrentUserInteractPath("/dashboard/gestion-de-mayoristas")
	if (!canInteract) throw new Error("No tiene permisos para esta acción")

	try {
		await (prisma as any).transferAgency.update({
			where: { id },
			data: { active: false },
		})
	} catch (error) {
		console.error("Error deleting transfer agency:", error)
		throw new Error("Error al eliminar la agencia de transfer")
	}
}
