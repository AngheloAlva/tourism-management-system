"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AuditService } from "@/lib/audit/service"
import { canCurrentUserInteractPaths } from "@/project/roles/actions/role.actions"
import { loadSaleForInlineEdit } from "@/project/sales/server/inline-edit-helpers"
import { updateSaleFlagsSchema } from "@/project/sales/schemas/inline-edit.schema"

import type { SaleRecordWithDetails } from "@/project/sales/actions/sale-record.actions"

type ActionResult =
	| { success: true; sale: SaleRecordWithDetails }
	| { success: false; error: string; code?: string }

export async function updateSaleFlags(input: {
	saleRecordId: string
	contacted: boolean
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
		const parsed = updateSaleFlagsSchema.safeParse(input)
		if (!parsed.success) {
			return {
				success: false,
				error: parsed.error.issues[0]?.message ?? "Datos inválidos",
				code: "VALIDATION",
			}
		}

		const { saleRecordId, contacted } = parsed.data

		// Load sale + NOT_FOUND + CANCELLED guards
		// No booking.date validation here — this action MUST NOT use saleRecordFormSchema (REQ-9-S5)
		const currentSale = await loadSaleForInlineEdit(saleRecordId)

		// Prisma update — ONLY contacted (REQ-9-S4)
		const updatedSale = await prisma.saleRecord.update({
			where: { id: saleRecordId },
			data: { contacted },
		})

		// Audit log — logUpdate internally skips if no change (handles REQ-5-S3)
		await AuditService.logUpdate(
			"SaleRecord",
			saleRecordId,
			{ id: session.user.id, name: session.user.name, email: session.user.email },
			{ contacted: currentSale.contacted },
			{ contacted },
			{ source: "inline-edit", field: "contacted" }
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
		const msg = err instanceof Error ? err.message : "Error al actualizar los indicadores"
		return { success: false, error: msg }
	}
}
