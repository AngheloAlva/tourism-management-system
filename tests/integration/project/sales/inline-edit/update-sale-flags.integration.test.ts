/**
 * T-F4 — Integration tests for updateSaleFlags
 *
 * Covers: REQ-5-S5, toggle true→false→true sequence, no-op on same value.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import { revalidatePath } from "next/cache"
import { updateSaleFlags } from "@/project/sales/actions/inline-edit/update-sale-flags.action"
import { loginAs, logout } from "../../../helpers/auth"
import { prisma, truncateAll, disconnect } from "../../../helpers/db"
import { createUser, createSaleRecord } from "../../../helpers/factories"

describe("updateSaleFlags — integration", () => {
	beforeEach(async () => {
		await truncateAll()
		vi.mocked(revalidatePath).mockClear()
	})

	afterAll(async () => {
		await disconnect()
	})

	it("REQ-5-S5: toggling contacted persists and creates AuditLog", async () => {
		const user = await createUser({ role: "admin" })
		loginAs(user)
		const sale = await createSaleRecord({
			sellerId: user.id,
			status: "TO_BE_DONE",
			contacted: false,
		})

		const result = await updateSaleFlags({ saleRecordId: sale.id, contacted: true })

		expect(result.success).toBe(true)

		const row = await prisma.saleRecord.findUniqueOrThrow({ where: { id: sale.id } })
		expect(row.contacted).toBe(true)

		const logs = await prisma.auditLog.findMany({ where: { entityId: sale.id } })
		expect(logs).toHaveLength(1)
		const meta = logs[0].metadata as Record<string, unknown>
		expect(meta.source).toBe("inline-edit")
	})

	it("toggle sequence: false → true → false — each produces one audit entry", async () => {
		const user = await createUser({ role: "admin" })
		loginAs(user)
		const sale = await createSaleRecord({
			sellerId: user.id,
			status: "TO_BE_DONE",
			contacted: false,
		})

		await updateSaleFlags({ saleRecordId: sale.id, contacted: true })
		await updateSaleFlags({ saleRecordId: sale.id, contacted: false })

		const row = await prisma.saleRecord.findUniqueOrThrow({ where: { id: sale.id } })
		expect(row.contacted).toBe(false)

		const logs = await prisma.auditLog.findMany({ where: { entityId: sale.id } })
		expect(logs).toHaveLength(2)
	})

	it("no-op: same value produces no AuditLog entry", async () => {
		const user = await createUser({ role: "admin" })
		loginAs(user)
		const sale = await createSaleRecord({
			sellerId: user.id,
			status: "TO_BE_DONE",
			contacted: true,
		})

		const result = await updateSaleFlags({ saleRecordId: sale.id, contacted: true })

		expect(result.success).toBe(true)
		const logs = await prisma.auditLog.findMany({ where: { entityId: sale.id } })
		// AuditService detects no change → no log
		expect(logs).toHaveLength(0)
	})

	it("REQ-1-S1: CANCELLED sale rejected", async () => {
		const user = await createUser({ role: "admin" })
		loginAs(user)
		const sale = await createSaleRecord({ sellerId: user.id, status: "CANCELLED" })

		const result = await updateSaleFlags({ saleRecordId: sale.id, contacted: true })

		expect(result.success).toBe(false)
		expect((result as { code?: string }).code).toBe("CANCELLED")
	})

	it("REQ-8-S1: unauthenticated call rejected", async () => {
		logout()
		const user = await createUser({ role: "admin" })
		const sale = await createSaleRecord({ sellerId: user.id })

		const result = await updateSaleFlags({ saleRecordId: sale.id, contacted: true })

		expect(result.success).toBe(false)
		expect((result as { error: string }).error).toContain("autorizado")
	})
})
