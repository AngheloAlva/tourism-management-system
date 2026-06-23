"use server"

import { prisma } from "@/lib/prisma"

import type { TransferAgency } from "../types/transfer-agency"

export async function getTransferAgencyById(id: string): Promise<TransferAgency | null> {
	try {
		return await (prisma as any).transferAgency.findUnique({
			where: { id },
		})
	} catch (error) {
		console.error("Error fetching transfer agency:", error)
		throw new Error("Error al obtener la agencia de transfer")
	}
}
