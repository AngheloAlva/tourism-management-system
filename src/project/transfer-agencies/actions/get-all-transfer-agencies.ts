"use server"

import { prisma } from "@/lib/prisma"

import type { TransferAgency } from "../types/transfer-agency"

export async function getAllTransferAgencies(): Promise<TransferAgency[]> {
	try {
		return await (prisma as any).transferAgency.findMany({
			orderBy: {
				name: "asc",
			},
		})
	} catch (error) {
		console.error("Error fetching all transfer agencies:", error)
		throw new Error("Error al obtener las agencias de transfer")
	}
}
