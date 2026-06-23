"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AuditService } from "@/lib/audit/service"
import { canCurrentUserInteractPaths } from "@/project/roles/actions/role.actions"
import { loadSaleForInlineEdit } from "@/project/sales/server/inline-edit-helpers"
import { updateSaleCommentsSchema } from "@/project/sales/schemas/inline-edit.schema"

import type { SaleRecordWithDetails } from "@/project/sales/actions/sale-record.actions"

type ActionResult =
	| { success: true; sale: SaleRecordWithDetails }
	| { success: false; error: string; code?: string }

export async function updateSaleComments(input: {
	saleRecordId: string
	comments: string | null
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
		const parsed = updateSaleCommentsSchema.safeParse(input)
		if (!parsed.success) {
			return {
				success: false,
				error: parsed.error.issues[0]?.message ?? "Datos inválidos",
				code: "VALIDATION",
			}
		}

		const { saleRecordId, comments } = parsed.data

		// Load sale + NOT_FOUND + CANCELLED guards
		const currentSale = await loadSaleForInlineEdit(saleRecordId)

		// Prisma update — ONLY comments (REQ-9-S3)
		const updatedSale = await prisma.saleRecord.update({
			where: { id: saleRecordId },
			data: { comments },
		})

		// Audit log — logUpdate internally skips if no change (handles REQ-4-S4)
		await AuditService.logUpdate(
			"SaleRecord",
			saleRecordId,
			{ id: session.user.id, name: session.user.name, email: session.user.email },
			{ comments: currentSale.comments },
			{ comments },
			{ source: "inline-edit", field: "comments" }
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
		const msg = err instanceof Error ? err.message : "Error al actualizar los comentarios"
		return { success: false, error: msg }
	}
}
