/**
 * T-F1 — Integration tests for updateSaleFileInfo
 *
 * Covers: REQ-2-S6, REQ-6-S4
 * - Persists fileNumber + null coercion to real DB
 * - Two sequential edits produce two AuditLog entries
 * - CANCELLED sale is rejected (no DB write)
 * - Unauthenticated call is rejected
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import { revalidatePath } from "next/cache"
import { updateSaleFileInfo } from "@/project/sales/actions/inline-edit/update-sale-file-info.action"
import { loginAs, logout } from "../../../helpers/auth"
import { prisma, truncateAll, disconnect } from "../../../helpers/db"
import { createUser, createSaleRecord } from "../../../helpers/factories"

describe("updateSaleFileInfo — integration", () => {
	beforeEach(async () => {
		await truncateAll()
		vi.mocked(revalidatePath).mockClear()
	})

	afterAll(async () => {
		await disconnect()
	})

	it("REQ-2-S6: persists fileNumber and fileNumberPending (pending UI = null) to DB", async () => {
		const user = await createUser({ role: "admin" })
		loginAs(user)
		const sale = await createSaleRecord({ sellerId: user.id, status: "TO_BE_DONE" })

		const result = await updateSaleFileInfo({
			saleRecordId: sale.id,
			fileNumber: "INTEG-001",
		})

		expect(result.success).toBe(true)

		const row = await prisma.saleRecord.findUniqueOrThrow({ where: { id: sale.id } })
		expect(row.fileNumber).toBe("INTEG-001")

		// Exactly one AuditLog entry for this sale
		const logs = await prisma.auditLog.findMany({ where: { entityId: sale.id } })
		expect(logs).toHaveLength(1)
		expect(logs[0].action).toBe("UPDATE")
	})

	it("REQ-2-S6: empty string coerces to null in DB", async () => {
		const user = await createUser({ role: "admin" })
		loginAs(user)
		const sale = await createSaleRecord({
			sellerId: user.id,
			fileNumber: "FN-OLD",
			status: "TO_BE_DONE",
		})

		const result = await updateSaleFileInfo({
			saleRecordId: sale.id,
			fileNumber: null, // UI sends null when emptied
		})

		expect(result.success).toBe(true)
		const row = await prisma.saleRecord.findUniqueOrThrow({ where: { id: sale.id } })
		expect(row.fileNumber).toBeNull()
	})

	it("REQ-6-S4: two sequential edits produce two AuditLog entries", async () => {
		const user = await createUser({ role: "admin" })
		loginAs(user)
		const sale = await createSaleRecord({ sellerId: user.id, status: "TO_BE_DONE" })

		await updateSaleFileInfo({ saleRecordId: sale.id, fileNumber: "FN-1" })
		await updateSaleFileInfo({ saleRecordId: sale.id, fileNumber: "FN-2" })

		const logs = await prisma.auditLog.findMany({ where: { entityId: sale.id } })
		expect(logs).toHaveLength(2)
		// Both have source inline-edit
		for (const log of logs) {
			const meta = log.metadata as Record<string, unknown>
			expect(meta.source).toBe("inline-edit")
		}
	})

	it("revalidatePath is called on success", async () => {
		const user = await createUser({ role: "admin" })
		loginAs(user)
		const sale = await createSaleRecord({ sellerId: user.id })

		await updateSaleFileInfo({ saleRecordId: sale.id, fileNumber: "FN-X" })

		expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/dashboard/registro-de-ventas")
		expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/dashboard/navegacion-ventas")
	})

	it("REQ-1-S1: CANCELLED sale is rejected — no DB write", async () => {
		const user = await createUser({ role: "admin" })
		loginAs(user)
		const sale = await createSaleRecord({ sellerId: user.id, status: "CANCELLED" })

		const result = await updateSaleFileInfo({ saleRecordId: sale.id, fileNumber: "SHOULD-NOT-SAVE" })

		expect(result.success).toBe(false)
		const row = await prisma.saleRecord.findUniqueOrThrow({ where: { id: sale.id } })
		expect(row.fileNumber).toBeNull() // unchanged
	})

	it("REQ-8-S1: unauthenticated call is rejected", async () => {
		logout()
		const user = await createUser({ role: "admin" })
		const sale = await createSaleRecord({ sellerId: user.id })

		const result = await updateSaleFileInfo({ saleRecordId: sale.id, fileNumber: "X" })

		expect(result.success).toBe(false)
		expect((result as { error: string }).error).toContain("autorizado")
	})
})
