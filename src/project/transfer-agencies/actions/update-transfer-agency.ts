"use server"

import { headers } from "next/headers"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { canCurrentUserInteractPath } from "@/project/roles/actions/role.actions"

import type { UpdateTransferAgency } from "../schemas/transfer-agency.schema"
import type { TransferAgency } from "../types/transfer-agency"

export async function updateTransferAgency(data: UpdateTransferAgency): Promise<TransferAgency> {
	const session = await auth.api.getSession({ headers: await headers() })
	if (!session?.user) throw new Error("No autorizado")

	const canInteract = await canCurrentUserInteractPath("/dashboard/gestion-de-mayoristas")
	if (!canInteract) throw new Error("No tiene permisos para esta acción")

	try {
		const { id, contactEmails, ...updateData } = data

		const existingAgency = await (prisma as any).transferAgency.findUnique({
			where: { id },
		})

		if (!existingAgency) {
			throw new Error("Agencia no encontrada")
		}

		const website = updateData.website === "" ? null : updateData.website
		const emails = contactEmails?.map((item) => item.email.trim())

		return await (prisma as any).transferAgency.update({
			where: { id },
			data: {
				...updateData,
				website,
				contactEmails: emails,
			},
		})
	} catch (error) {
		console.error("Error updating transfer agency:", error)
		if (error instanceof Error) {
			throw new Error(`Error al actualizar la agencia de transfer: ${error.message}`)
		}
		throw new Error("Error al actualizar la agencia de transfer")
	}
}
