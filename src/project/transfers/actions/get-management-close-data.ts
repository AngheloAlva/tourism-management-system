"use server"

import { prisma } from "@/lib/prisma"
import type { CGData, CGParams, CGRow, Estado } from "../components/cierre-gestion/types"
import { getEventDisplayName } from "@/project/events/utils/event-display"
import { canCurrentUserInteractPath } from "@/project/roles/actions/role.actions"

export async function getManagementCloseData(params: CGParams): Promise<CGData> {
	const canInteract = await canCurrentUserInteractPath("/dashboard/balance-de-agencias")
	if (!canInteract) {
		throw new Error("No tiene permisos para consultar el balance de agencias")
	}

	const { agencyId, from, to, includePaid = false } = params

	// Construir filtros de fecha
	const dateFilter = {
		...(from && { gte: from }),
		...(to && { lte: to }),
	}

	// Filtro de estado de pago (excluir pagados si no se solicitan)
	const paymentStatusFilter = includePaid ? undefined : { not: "FULLY_PAID" as const }

	try {
		// Obtener recepciones (AgencyTransfer INCOMING)
		const receptions = await prisma.agencyTransfer.findMany({
			where: {
				type: "INCOMING",
				agencyId,
				...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
				...(paymentStatusFilter && { paymentStatus: paymentStatusFilter }),
			},
			include: {
				priceDetails: true,
				passengers: true,
				eventBookings: {
					include: {
						event: {
							include: {
								tour: true,
								transferService: { select: { id: true, name: true } },
							},
						},
					},
				},
			},
			orderBy: {
				createdAt: "desc",
			},
		})

		// Obtener transferencias (AgencyTransfer OUTGOING)
		const transfers = await prisma.agencyTransfer.findMany({
			where: {
				type: "OUTGOING",
				agencyId,
				...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
				...(paymentStatusFilter && { paymentStatus: paymentStatusFilter }),
			},
			include: {
				priceDetails: true,
				passengers: true,
				eventBookings: {
					include: {
						event: {
							include: {
								tour: true,
								transferService: { select: { id: true, name: true } },
							},
						},
					},
				},
			},
			orderBy: {
				date: "desc",
			},
		})

		// Transformar recepciones a CGRow
		const recepcionesData: CGRow[] = receptions.map((reception) => {
			const totalEntrada = reception.priceDetails.reduce(
				(sum: number, price) => sum + price.entrancePrice,
				0
			)
			const totalValor = reception.priceDetails.reduce(
				(sum: number, price) => sum + price.tourPrice,
				0
			)

			return {
				id: reception.id,
				fecha: reception.date.toISOString(),
				voucher: reception.voucher,
				pax: reception.passengers.length || reception.priceDetails.length,
				tour: reception.eventBookings[0]?.event ? getEventDisplayName(reception.eventBookings[0].event) : "Sin tour",
				entrada: totalEntrada,
				valor: totalValor,
				total: totalEntrada + totalValor,
				estado: reception.paymentStatus as Estado,
				type: "RECEPTION",
				proofOfPayment: reception.proofOfPayment,
			}
		})

		// Transformar transferencias a CGRow
		const traspasosData: CGRow[] = transfers.map((transfer) => {
			const totalEntrada = transfer.priceDetails.reduce(
				(sum: number, price) => sum + price.entrancePrice,
				0
			)
			const totalValor = transfer.priceDetails.reduce(
				(sum: number, price) => sum + price.tourPrice,
				0
			)

			const tourName = transfer.eventBookings[0]?.event ? getEventDisplayName(transfer.eventBookings[0].event) : "Sin tour"

			return {
				id: transfer.id,
				fecha: transfer.date.toISOString(),
				voucher: transfer.voucher,
				pax: transfer.priceDetails.length,
				tour: tourName,
				entrada: totalEntrada,
				valor: totalValor,
				total: totalEntrada + totalValor,
				estado: transfer.paymentStatus as Estado,
				type: "TRANSFER",
				proofOfPayment: transfer.proofOfPayment,
			}
		})

		return {
			recepciones: recepcionesData,
			traspasos: traspasosData,
		}
	} catch (error) {
		console.error("[getManagementCloseData] Error:", error)
		throw new Error("Error al obtener datos de cierre de gestión")
	}
}
