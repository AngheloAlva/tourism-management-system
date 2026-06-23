/**
 * T-F2 — Integration tests for updateSaleAgency
 *
 * Covers: REQ-3-S8, WHOLESALE path + agencyId column, ONLINE+isWholesale path,
 * STALE rejection, non-existent agency rejection, audit row content, CANCELLED rejection.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import { revalidatePath } from "next/cache"
import { updateSaleAgency } from "@/project/sales/actions/inline-edit/update-sale-agency.action"
import { loginAs, logout } from "../../../helpers/auth"
import { prisma, truncateAll, disconnect } from "../../../helpers/db"
import { createUser, createSaleRecord, createAgency } from "../../../helpers/factories"

describe("updateSaleAgency — integration", () => {
	beforeEach(async () => {
		await truncateAll()
		vi.mocked(revalidatePath).mockClear()
	})

	afterAll(async () => {
		await disconnect()
	})

	it("REQ-3-S8: WHOLESALE sale writes agencyId and produces audit row", async () => {
		const user = await createUser({ role: "admin" })
		loginAs(user)
		const agency = await createAgency({ active: true })
		const sale = await createSaleRecord({
			sellerId: user.id,
			channel: "WHOLESALE",
			isWholesale: false,
			status: "TO_BE_DONE",
		})

		const result = await updateSaleAgency({
			saleRecordId: sale.id,
			agencyId: agency.id,
			expectedUpdatedAt: sale.updatedAt,
		})

		expect(result.success).toBe(true)

		const row = await prisma.saleRecord.findUniqueOrThrow({ where: { id: sale.id } })
		expect(row.agencyId).toBe(agency.id)
		expect(row.wholesaleAgencyId).toBeNull() // untouched

		const logs = await prisma.auditLog.findMany({ where: { entityId: sale.id } })
		expect(logs).toHaveLength(1)
		const meta = logs[0].metadata as Record<string, unknown>
		expect(meta.source).toBe("inline-edit")
	})

	it("ONLINE+isWholesale writes wholesaleAgencyId only", async () => {
		const user = await createUser({ role: "admin" })
		loginAs(user)
		const agency = await createAgency({ active: true })
		const sale = await createSaleRecord({
			sellerId: user.id,
			channel: "ONLINE",
			isWholesale: true,
			status: "TO_BE_DONE",
		})

		const result = await updateSaleAgency({
			saleRecordId: sale.id,
			agencyId: agency.id,
			expectedUpdatedAt: sale.updatedAt,
		})

		expect(result.success).toBe(true)

		const row = await prisma.saleRecord.findUniqueOrThrow({ where: { id: sale.id } })
		expect(row.wholesaleAgencyId).toBe(agency.id)
		expect(row.agencyId).toBeNull() // untouched
	})

	it("STALE token — rejected, DB unchanged", async () => {
		const user = await createUser({ role: "admin" })
		loginAs(user)
		const agency = await createAgency({ active: true })
		const sale = await createSaleRecord({
			sellerId: user.id,
			channel: "WHOLESALE",
			status: "TO_BE_DONE",
		})

		// Pass a deliberately stale timestamp (1 second in the past)
		const staleDate = new Date(sale.updatedAt.getTime() - 1000)

		const result = await updateSaleAgency({
			saleRecordId: sale.id,
			agencyId: agency.id,
			expectedUpdatedAt: staleDate,
		})

		expect(result.success).toBe(false)
		expect((result as { code?: string }).code).toBe("STALE")

		const row = await prisma.saleRecord.findUniqueOrThrow({ where: { id: sale.id } })
		expect(row.agencyId).toBeNull() // unchanged
	})

	it("non-existent or inactive agency rejected", async () => {
		const user = await createUser({ role: "admin" })
		loginAs(user)
		const inactiveAgency = await createAgency({ active: false })
		const sale = await createSaleRecord({
			sellerId: user.id,
			channel: "WHOLESALE",
			status: "TO_BE_DONE",
		})

		const result = await updateSaleAgency({
			saleRecordId: sale.id,
			agencyId: inactiveAgency.id,
			expectedUpdatedAt: sale.updatedAt,
		})

		expect(result.success).toBe(false)

		const row = await prisma.saleRecord.findUniqueOrThrow({ where: { id: sale.id } })
		expect(row.agencyId).toBeNull() // unchanged
	})

	it("REQ-1-S1: CANCELLED sale rejected", async () => {
		const user = await createUser({ role: "admin" })
		loginAs(user)
		const agency = await createAgency({ active: true })
		const sale = await createSaleRecord({
			sellerId: user.id,
			channel: "WHOLESALE",
			status: "CANCELLED",
		})

		const result = await updateSaleAgency({
			saleRecordId: sale.id,
			agencyId: agency.id,
			expectedUpdatedAt: sale.updatedAt,
		})

		expect(result.success).toBe(false)
		expect((result as { code?: string }).code).toBe("CANCELLED")
	})

	it("REQ-8-S1: unauthenticated call rejected", async () => {
		logout()
		const user = await createUser({ role: "admin" })
		const agency = await createAgency({ active: true })
		const sale = await createSaleRecord({ sellerId: user.id, channel: "WHOLESALE" })

		const result = await updateSaleAgency({
			saleRecordId: sale.id,
			agencyId: agency.id,
			expectedUpdatedAt: sale.updatedAt,
		})

		expect(result.success).toBe(false)
		expect((result as { error: string }).error).toContain("autorizado")
	})
})
