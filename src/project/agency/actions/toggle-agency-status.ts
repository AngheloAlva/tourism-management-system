"use server"

import { headers } from "next/headers"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { canCurrentUserInteractPath } from "@/project/roles/actions/role.actions"

import type { Agency } from "../types/agency"

export async function toggleAgencyStatus(id: string): Promise<Agency> {
	const session = await auth.api.getSession({ headers: await headers() })
	if (!session?.user) throw new Error("No autorizado")

	const canInteract = await canCurrentUserInteractPath("/dashboard/gestion-de-agencias")
	if (!canInteract) throw new Error("No tiene permisos para esta acción")

	try {
		const agency = await prisma.agency.findUnique({
			where: { id },
		})

		if (!agency) {
			throw new Error("Agencia no encontrada")
		}

		const updatedAgency = await prisma.agency.update({
			where: { id },
			data: { active: !agency.active },
		})

		return updatedAgency
	} catch (error) {
		console.error("Error toggling agency status:", error)
		throw new Error("Error al cambiar el estado de la agencia")
	}
}
