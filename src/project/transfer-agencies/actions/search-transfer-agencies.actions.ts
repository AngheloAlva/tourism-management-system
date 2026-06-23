"use server"

import { headers } from "next/headers"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import type { AgencySearchResult } from "@/project/agency/actions/search-agencies.actions"

async function getAuthUser() {
	const session = await auth.api.getSession({
		headers: await headers(),
	})

	if (!session?.user) {
		throw new Error("No autenticado")
	}

	return session.user
}

export async function searchTransferAgencies(
	query: string,
	activeOnly: boolean = true
): Promise<AgencySearchResult[]> {
	try {
		await getAuthUser()

		const searchQuery = query.trim()

		const where = {
			AND: [
				activeOnly ? { active: true } : {},
				searchQuery
					? {
							OR: [
								{ name: { contains: searchQuery, mode: "insensitive" as const } },
								{ phone: { contains: searchQuery, mode: "insensitive" as const } },
							],
						}
					: {},
			],
		}

		const agencies = await (prisma as any).transferAgency.findMany({
			where,
			orderBy: { name: "asc" },
			take: searchQuery ? 50 : undefined,
		})

		return agencies.map(
			(agency: {
				id: string
				name: string
				contactEmails: string[]
				phone: string | null
				active: boolean
			}) => ({
				id: agency.id,
				name: agency.name,
				contactEmails: agency.contactEmails,
				phone: agency.phone,
				codePrefix: null,
				codeLength: null,
				active: agency.active,
			})
		)
	} catch (error) {
		console.error("Error searching transfer agencies:", error)
		throw new Error("Error al buscar agencias de transfer")
	}
}
