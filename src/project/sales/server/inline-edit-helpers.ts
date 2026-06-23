import { prisma } from "@/lib/prisma"

/**
 * Shape of a SaleRecord used by the inline-edit helpers.
 * Intentionally minimal to avoid coupling to the full SaleRecordWithDetails type.
 */
export interface SaleForInlineEdit {
	id: string
	status: "TO_BE_DONE" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
	channel: "ONLINE" | "AGENCY" | "PHYSICAL" | "WHOLESALE"
	isWholesale: boolean
	fileNumber: string | null
	comments: string | null
	contacted: boolean
	agencyId: string | null
	wholesaleAgencyId: string | null
	updatedAt: Date
	agency: { id: string; name: string } | null
	wholesaleAgency: { id: string; name: string } | null
}

/**
 * Agency resolution matrix (normative — from spec REQ-3).
 *
 * | channel   | isWholesale | result              |
 * |-----------|-------------|---------------------|
 * | WHOLESALE | any         | "agencyId"          |
 * | ONLINE    | true        | "wholesaleAgencyId" |
 * | PHYSICAL  | true        | "wholesaleAgencyId" |
 * | AGENCY    | any         | null                |
 * | ONLINE    | false       | null                |
 * | PHYSICAL  | false       | null                |
 */
export function resolveAgencyTargetColumn(
	sale: Pick<SaleForInlineEdit, "channel" | "isWholesale">
): "agencyId" | "wholesaleAgencyId" | null {
	if (sale.channel === "WHOLESALE") {
		return "agencyId"
	}

	if ((sale.channel === "ONLINE" || sale.channel === "PHYSICAL") && sale.isWholesale === true) {
		return "wholesaleAgencyId"
	}

	return null
}

/**
 * Loads a SaleRecord for an inline-edit action, enforcing two guards:
 * - NOT_FOUND: throws if the sale does not exist.
 * - CANCELLED: throws if the sale is cancelled.
 *
 * Actions catch these thrown objects and map them to the error return shape.
 */
export async function loadSaleForInlineEdit(id: string): Promise<SaleForInlineEdit> {
	const sale = await prisma.saleRecord.findUnique({
		where: { id },
		select: {
			id: true,
			status: true,
			channel: true,
			isWholesale: true,
			fileNumber: true,
			comments: true,
			contacted: true,
			agencyId: true,
			wholesaleAgencyId: true,
			updatedAt: true,
			agency: { select: { id: true, name: true } },
			wholesaleAgency: { select: { id: true, name: true } },
		},
	})

	if (!sale) {
		throw { code: "NOT_FOUND", message: "Venta no encontrada" }
	}

	if (sale.status === "CANCELLED") {
		throw { code: "CANCELLED", message: "El registro ya está cancelado" }
	}

	return sale as SaleForInlineEdit
}
