"use server"

import { headers } from "next/headers"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export interface AgencySearchResult {
	id: string
	name: string
	contactEmails: string[]
	phone: string | null
	codePrefix: string | null
	codeLength: number | null
	active: boolean
}

async function getAuthUser() {
	const session = await auth.api.getSession({
		headers: await headers(),
	})

	if (!session?.user) {
		throw new Error("No autenticado")
	}

	return session.user
}

export async function searchAgencies(
	query: string,
	activeOnly: boolean = true
): Promise<AgencySearchResult[]> {
	try {
		await getAuthUser()

		const searchQuery = query.trim()

		if (!searchQuery) {
			const agencies = await prisma.agency.findMany({
				where: activeOnly ? { active: true } : undefined,
				orderBy: {
					name: "asc",
				},
			})

			return agencies.map((agency) => ({
				id: agency.id,
				name: agency.name,
				contactEmails: agency.contactEmails,
				phone: agency.phone,
				codePrefix: agency.codePrefix,
				codeLength: agency.codeLength,
				active: agency.active,
			}))
		}

		const agencies = await prisma.agency.findMany({
			where: {
				AND: [
					activeOnly ? { active: true } : {},
					{
						OR: [
							{
								name: {
									contains: searchQuery,
									mode: "insensitive",
								},
							},
							{
								phone: {
									contains: searchQuery,
									mode: "insensitive",
								},
							},
							{
								codePrefix: {
									contains: searchQuery,
									mode: "insensitive",
								},
							},
						],
					},
				],
			},
			orderBy: {
				name: "asc",
			},
			take: 50,
		})

		return agencies.map((agency) => ({
			id: agency.id,
			name: agency.name,
			contactEmails: agency.contactEmails,
			phone: agency.phone,
			codePrefix: agency.codePrefix,
			codeLength: agency.codeLength,
			active: agency.active,
		}))
	} catch (error) {
		console.error("Error searching agencies:", error)
		throw new Error("Error al buscar agencias")
	}
}
