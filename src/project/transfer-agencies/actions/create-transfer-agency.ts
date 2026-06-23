"use server"

import { headers } from "next/headers"

import { transferAgencySchema, type CreateTransferAgency } from "../schemas/transfer-agency.schema"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { canCurrentUserInteractPath } from "@/project/roles/actions/role.actions"

import type { TransferAgency } from "../types/transfer-agency"

export async function createTransferAgency(data: CreateTransferAgency): Promise<TransferAgency> {
	const session = await auth.api.getSession({ headers: await headers() })
	if (!session?.user) throw new Error("No autorizado")

	const canInteract = await canCurrentUserInteractPath("/dashboard/gestion-de-mayoristas")
	if (!canInteract) throw new Error("No tiene permisos para esta acción")

	try {
		const validatedData = transferAgencySchema.parse(data)
		const website = validatedData.website === "" ? null : validatedData.website
		const emails = validatedData.contactEmails.map((item) => item.email.trim())

		return await (prisma as any).transferAgency.create({
			data: {
				...validatedData,
				website,
				contactEmails: emails,
			},
		})
	} catch (error) {
		console.error("Error creating transfer agency:", error)
		if (error instanceof Error) {
			throw new Error(`Error al crear la agencia de transfer: ${error.message}`)
		}
		throw new Error("Error al crear la agencia de transfer")
	}
}
