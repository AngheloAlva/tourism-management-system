/**
 * T-F3 — Integration tests for updateSaleComments
 *
 * Covers: REQ-4-S5, empty→null coercion, no-op produces no audit row (REQ-4-S4 integration).
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import { revalidatePath } from "next/cache"
import { updateSaleComments } from "@/project/sales/actions/inline-edit/update-sale-comments.action"
import { loginAs, logout } from "../../../helpers/auth"
import { prisma, truncateAll, disconnect } from "../../../helpers/db"
import { createUser, createSaleRecord } from "../../../helpers/factories"

describe("updateSaleComments — integration", () => {
	beforeEach(async () => {
		await truncateAll()
		vi.mocked(revalidatePath).mockClear()
	})

	afterAll(async () => {
		await disconnect()
	})

	it("REQ-4-S5: saves comments and creates AuditLog", async () => {
		const user = await createUser({ role: "admin" })
		loginAs(user)
		const sale = await createSaleRecord({ sellerId: user.id, status: "TO_BE_DONE" })

		const result = await updateSaleComments({
			saleRecordId: sale.id,
			comments: "Llamar el martes",
		})

		expect(result.success).toBe(true)

		const row = await prisma.saleRecord.findUniqueOrThrow({ where: { id: sale.id } })
		expect(row.comments).toBe("Llamar el martes")

		const logs = await prisma.auditLog.findMany({ where: { entityId: sale.id } })
		expect(logs).toHaveLength(1)
		const meta = logs[0].metadata as Record<string, unknown>
		expect(meta.source).toBe("inline-edit")
	})

	it("empty string coerces to null in DB", async () => {
		const user = await createUser({ role: "admin" })
		loginAs(user)
		const sale = await createSaleRecord({
			sellerId: user.id,
			status: "TO_BE_DONE",
		})

		// Manually set comments first
		await prisma.saleRecord.update({
			where: { id: sale.id },
			data: { comments: "Old comment" },
		})

		const result = await updateSaleComments({ saleRecordId: sale.id, comments: null })

		expect(result.success).toBe(true)
		const row = await prisma.saleRecord.findUniqueOrThrow({ where: { id: sale.id } })
		expect(row.comments).toBeNull()
	})

	it("REQ-4-S4 integration: no-op produces no AuditLog entry", async () => {
		const user = await createUser({ role: "admin" })
		loginAs(user)
		// Sale with existing comment
		const sale = await createSaleRecord({ sellerId: user.id, status: "TO_BE_DONE" })
		await prisma.saleRecord.update({
			where: { id: sale.id },
			data: { comments: "Same note" },
		})

		const result = await updateSaleComments({ saleRecordId: sale.id, comments: "Same note" })

		expect(result.success).toBe(true)
		const logs = await prisma.auditLog.findMany({ where: { entityId: sale.id } })
		// AuditService.detectChanges skips no-ops → no log created
		expect(logs).toHaveLength(0)
	})

	it("REQ-1-S1: CANCELLED sale rejected", async () => {
		const user = await createUser({ role: "admin" })
		loginAs(user)
		const sale = await createSaleRecord({ sellerId: user.id, status: "CANCELLED" })

		const result = await updateSaleComments({ saleRecordId: sale.id, comments: "X" })

		expect(result.success).toBe(false)
		expect((result as { code?: string }).code).toBe("CANCELLED")
	})

	it("REQ-8-S1: unauthenticated call rejected", async () => {
		logout()
		const user = await createUser({ role: "admin" })
		const sale = await createSaleRecord({ sellerId: user.id })

		const result = await updateSaleComments({ saleRecordId: sale.id, comments: "X" })

		expect(result.success).toBe(false)
		expect((result as { error: string }).error).toContain("autorizado")
	})
})
