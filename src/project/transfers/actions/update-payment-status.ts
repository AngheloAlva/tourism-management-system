"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

import { canCurrentUserInteractPath } from "@/project/roles/actions/role.actions"

type BatchUpdatePaymentStatusParams = {
	type: "RECEPTION" | "TRANSFER"
	vouchers: number[]
	status: "PENDING" | "ENTRANCE_ONLY" | "TOUR_ONLY" | "FULLY_PAID"
	proofOfPayment?: string
}

export async function batchUpdatePaymentStatus(params: BatchUpdatePaymentStatusParams) {
	const canInteract = await canCurrentUserInteractPath("/dashboard/balance-de-agencias")
	if (!canInteract) {
		return { success: false, error: "No tiene permisos para actualizar estados de pago" }
	}

	const { type, vouchers, status, proofOfPayment } = params

	try {
		const transferType = type === "RECEPTION" ? "INCOMING" : "OUTGOING"

		await prisma.agencyTransfer.updateMany({
			where: {
				voucher: { in: vouchers },
				type: transferType,
			},
			data: {
				paymentStatus: status,
				...(proofOfPayment && { proofOfPayment }),
			},
		})

		revalidatePath("/dashboard/balance-de-agencias")

		return { success: true }
	} catch (error) {
		console.error("[batchUpdatePaymentStatus] Error:", error)
		return { success: false, error: "Error al actualizar los estados de pago" }
	}
}
