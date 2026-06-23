"use server"

import { headers } from "next/headers"

import { agencySchema, type CreateAgency } from "../schemas/agency.schema"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { canCurrentUserInteractPath } from "@/project/roles/actions/role.actions"
import {
	AGENCY_TOUR_PRICING_INCLUDE,
	normalizeTourPricing,
	buildTourPricingCreate,
	mapAgencyTourPricing,
} from "../utils/agency-pricing"

import type { Agency } from "../types/agency"

export async function createAgency(data: CreateAgency): Promise<Agency> {
	const session = await auth.api.getSession({ headers: await headers() })
	if (!session?.user) throw new Error("No autorizado")

	const canInteract = await canCurrentUserInteractPath("/dashboard/gestion-de-agencias")
	if (!canInteract) throw new Error("No tiene permisos para esta acción")

	try {
		const validatedData = agencySchema.parse(data)
		const { tourPricing: rawTourPricing, ...agencyData } = validatedData

		const website = agencyData.website === "" ? null : agencyData.website
		const emails = agencyData.contactEmails.map((emails) => emails.email.trim())

		const normalizedTourPricing = normalizeTourPricing(rawTourPricing)

		const agency = await prisma.agency.create({
			data: {
				...agencyData,
				website,
				contactEmails: emails,
				codeLength: agencyData.codeLength ? +agencyData.codeLength : null,
				...(normalizedTourPricing.length > 0
					? {
							tourPricing: {
								create: buildTourPricingCreate(normalizedTourPricing),
							},
						}
					: undefined),
			},
			include: AGENCY_TOUR_PRICING_INCLUDE,
		})

		return {
			...agency,
			tourPricing: mapAgencyTourPricing(agency.tourPricing),
		} as Agency
	} catch (error) {
		console.error("Error creating agency:", error)
		if (error instanceof Error) {
			throw new Error(`Error al crear la agencia: ${error.message}`)
		}
		throw new Error("Error al crear la agencia")
	}
}
