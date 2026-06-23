"use server"

import { prisma } from "@/lib/prisma"
import { AGENCY_TOUR_PRICING_INCLUDE, mapAgencyTourPricing } from "../utils/agency-pricing"

import type { Agency } from "../types/agency"

export async function getActiveAgencies(): Promise<Agency[]> {
	try {
		const agencies = await prisma.agency.findMany({
			where: {
				active: true,
			},
			include: AGENCY_TOUR_PRICING_INCLUDE,
			orderBy: {
				name: "asc",
			},
		})

		return agencies.map((agency) => ({
			...agency,
			tourPricing: mapAgencyTourPricing(agency.tourPricing),
		})) as Agency[]
	} catch (error) {
		console.error("Error fetching agencies:", error)
		throw new Error("Error al obtener las agencias")
	}
}
