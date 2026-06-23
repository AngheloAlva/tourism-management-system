"use server"

import { prisma } from "@/lib/prisma"

import type { TransferAgency } from "../types/transfer-agency"

export async function getActiveTransferAgencies(): Promise<TransferAgency[]> {
	try {
		return await (prisma as any).transferAgency.findMany({
			where: { active: true },
			orderBy: { name: "asc" },
		})
	} catch (error) {
		console.error("Error fetching active transfer agencies:", error)
		throw new Error("Error al obtener agencias de transfer activas")
	}
}
