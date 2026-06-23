"use server"

import { prisma } from "@/lib/prisma"

export async function checkTransferredEvents(eventIds: string[]): Promise<Record<string, boolean>> {
	if (!eventIds || eventIds.length === 0) {
		return {}
	}

	try {
		const transfers = await prisma.transferEventBooking.findMany({
			where: {
				eventId: { in: eventIds },
			},
			select: {
				eventId: true,
			},
		})

		// Crear un mapa de eventId -> ya traspasado
		const transferredMap: Record<string, boolean> = {}
		transfers.forEach((transfer) => {
			transferredMap[transfer.eventId] = true
		})

		return transferredMap
	} catch (error) {
		console.error("Error checking transferred events:", error)
		return {}
	}
}
