"use server"

import { headers } from "next/headers"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { canCurrentUserInteractPath } from "@/project/roles/actions/role.actions"
import {
	AGENCY_TOUR_PRICING_INCLUDE,
	normalizeTourPricing,
	buildTourPricingCreate,
	mapAgencyTourPricing,
} from "../utils/agency-pricing"

import type { UpdateAgency } from "../schemas/agency.schema"
import type { Agency } from "../types/agency"

export async function updateAgency(data: UpdateAgency): Promise<Agency> {
	const session = await auth.api.getSession({ headers: await headers() })
	if (!session?.user) throw new Error("No autorizado")

	const canInteract = await canCurrentUserInteractPath("/dashboard/gestion-de-agencias")
	if (!canInteract) throw new Error("No tiene permisos para esta acción")

	try {
		const { id, contactEmails, tourPricing, ...updateData } = data

		const existingAgency = await prisma.agency.findUnique({
			where: { id },
		})

		if (!existingAgency) {
			throw new Error("Agencia no encontrada")
		}

		const website = updateData.website === "" ? null : updateData.website
		const emails = contactEmails?.map((emails) => emails.email.trim())

		const normalizedTourPricing = normalizeTourPricing(tourPricing)

		const agency = await prisma.agency.update({
			where: { id },
			data: {
				...updateData,
				website,
				contactEmails: emails,
				codeLength: updateData.codeLength ? +updateData.codeLength : null,
				tourPricing: {
					deleteMany: {},
					create: buildTourPricingCreate(normalizedTourPricing),
				},
			},
			include: AGENCY_TOUR_PRICING_INCLUDE,
		})

		return {
			...agency,
			tourPricing: mapAgencyTourPricing(agency.tourPricing),
		} as Agency
	} catch (error) {
		console.error("Error updating agency:", error)
		if (error instanceof Error) {
			throw new Error(`Error al actualizar la agencia: ${error.message}`)
		}
		throw new Error("Error al actualizar la agencia")
	}
}
