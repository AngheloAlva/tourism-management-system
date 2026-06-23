"use server"

import { prisma } from "@/lib/prisma"

import { canCurrentUserInteractPath } from "@/project/roles/actions/role.actions"

import type { TransferAgency } from "../types/transfer-agency"

export async function toggleTransferAgencyStatus(id: string): Promise<TransferAgency> {
	const canInteract = await canCurrentUserInteractPath("/dashboard/gestion-de-mayoristas")
	if (!canInteract) {
		throw new Error("No tiene permisos para cambiar el estado de la agencia")
	}

	try {
		const agency = await (prisma as any).transferAgency.findUnique({
			where: { id },
		})

		if (!agency) {
			throw new Error("Agencia no encontrada")
		}

		return await (prisma as any).transferAgency.update({
			where: { id },
			data: { active: !agency.active },
		})
	} catch (error) {
		console.error("Error toggling transfer agency status:", error)
		throw new Error("Error al cambiar el estado de la agencia de transfer")
	}
}
