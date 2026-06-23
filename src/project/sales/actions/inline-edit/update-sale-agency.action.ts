"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AuditService } from "@/lib/audit/service"
import { canCurrentUserInteractPaths } from "@/project/roles/actions/role.actions"
import { loadSaleForInlineEdit, resolveAgencyTargetColumn } from "@/project/sales/server/inline-edit-helpers"
import { updateSaleAgencySchema } from "@/project/sales/schemas/inline-edit.schema"

import type { SaleRecordWithDetails } from "@/project/sales/actions/sale-record.actions"
import type { AuditFieldValue } from "@/lib/audit/types"

type ActionResult =
	| { success: true; sale: SaleRecordWithDetails }
	| { success: false; error: string; code?: string }

export async function updateSaleAgency(input: {
	saleRecordId: string
	agencyId: string | null
	expectedUpdatedAt: Date
}): Promise<ActionResult> {
	try {
		// Auth guard
		const session = await auth.api.getSession({ headers: await headers() })
		if (!session?.user) {
			return { success: false, error: "No autorizado", code: "UNAUTHORIZED" }
		}

		const canInteract = await canCurrentUserInteractPaths([
			"/dashboard/registro-de-ventas",
			"/dashboard/navegacion-ventas",
		])
		if (!canInteract) {
			return { success: false, error: "No autorizado", code: "UNAUTHORIZED" }
		}

		// Zod validation
		const parsed = updateSaleAgencySchema.safeParse(input)
		if (!parsed.success) {
			return {
				success: false,
				error: parsed.error.issues[0]?.message ?? "Datos inválidos",
				code: "VALIDATION",
			}
		}

		const { saleRecordId, agencyId, expectedUpdatedAt } = parsed.data

		// Load sale + NOT_FOUND + CANCELLED guards
		const currentSale = await loadSaleForInlineEdit(saleRecordId)

		// Optimistic concurrency check (STALE guard)
		if (currentSale.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
			return {
				success: false,
				error: "La venta fue modificada por otra persona, recargá la vista",
				code: "STALE",
			}
		}

		// Resolve target column
		const targetColumn = resolveAgencyTargetColumn(currentSale)
		if (targetColumn === null) {
			return {
				success: false,
				error: "No se puede cambiar la agencia en este tipo de venta",
				code: "INVALID_AGENCY_TARGET",
			}
		}

		// If agencyId is not null, verify the agency exists AND is active.
		// Single query: existence + active guard + name for audit.
		let newAgencyName: string | null = null
		if (agencyId !== null) {
			const agency = await prisma.agency.findUnique({
				where: { id: agencyId, active: true },
				select: { id: true, name: true },
			})
			if (!agency) {
				return {
					success: false,
					error: "La agencia seleccionada no existe o está inactiva",
					code: "INVALID_AGENCY_TARGET",
				}
			}
			newAgencyName = agency.name
		}

		// Determine old/new values for audit (only the resolved column)
		const oldValues: Record<string, AuditFieldValue> =
			targetColumn === "agencyId"
				? { agencyId: currentSale.agencyId, agencyName: currentSale.agency?.name ?? null }
				: { wholesaleAgencyId: currentSale.wholesaleAgencyId, wholesaleAgencyName: currentSale.wholesaleAgency?.name ?? null }

		const newValues: Record<string, AuditFieldValue> =
			targetColumn === "agencyId"
				? { agencyId, agencyName: newAgencyName }
				: { wholesaleAgencyId: agencyId, wholesaleAgencyName: newAgencyName }

		// Prisma update — ONLY the resolved column (REQ-9-S2)
		const updatedSale = await prisma.saleRecord.update({
			where: { id: saleRecordId },
			data:
				targetColumn === "agencyId"
					? { agencyId }
					: { wholesaleAgencyId: agencyId },
		})

		// Audit log
		await AuditService.logUpdate(
			"SaleRecord",
			saleRecordId,
			{ id: session.user.id, name: session.user.name, email: session.user.email },
			oldValues,
			newValues,
			{ source: "inline-edit", field: targetColumn }
		)

		// Cache invalidation
		revalidatePath("/dashboard/registro-de-ventas")
		revalidatePath("/dashboard/navegacion-ventas")

		return { success: true, sale: updatedSale as unknown as SaleRecordWithDetails }
	} catch (err) {
		const typed = err as { code?: string; message?: string }
		if (typed?.code === "NOT_FOUND") {
			return { success: false, error: typed.message ?? "Venta no encontrada", code: "NOT_FOUND" }
		}
		if (typed?.code === "CANCELLED") {
			return { success: false, error: typed.message ?? "El registro ya está cancelado", code: "CANCELLED" }
		}
		const msg = err instanceof Error ? err.message : "Error al actualizar la agencia"
		return { success: false, error: msg }
	}
}
