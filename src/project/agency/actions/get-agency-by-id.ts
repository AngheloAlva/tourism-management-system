"use server"

import { prisma } from "@/lib/prisma"
import { AGENCY_TOUR_PRICING_INCLUDE, mapAgencyTourPricing } from "../utils/agency-pricing"

import type { Agency } from "../types/agency"

export async function getAgencyById(id: string): Promise<Agency | null> {
	try {
		const agency = await prisma.agency.findUnique({
			where: { id },
			include: AGENCY_TOUR_PRICING_INCLUDE,
		})

		if (!agency) return null

		return {
			...agency,
			tourPricing: mapAgencyTourPricing(agency.tourPricing),
		} as Agency
	} catch (error) {
		console.error("Error fetching agency:", error)
		throw new Error("Error al obtener la agencia")
	}
}
