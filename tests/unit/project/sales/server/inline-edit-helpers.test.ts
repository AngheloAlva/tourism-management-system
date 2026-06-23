import { describe, expect, it, vi, beforeEach } from "vitest"

// Mock Prisma BEFORE importing the helpers module
vi.mock("@/lib/prisma", () => ({
	prisma: {
		saleRecord: {
			findUnique: vi.fn(),
		},
	},
}))

import { resolveAgencyTargetColumn, loadSaleForInlineEdit } from "@/project/sales/server/inline-edit-helpers"
import { prisma } from "@/lib/prisma"

// Type for the partial SaleRecord shape used by resolveAgencyTargetColumn
type SaleChannelShape = {
	channel: "ONLINE" | "AGENCY" | "PHYSICAL" | "WHOLESALE"
	isWholesale: boolean
}

describe("resolveAgencyTargetColumn", () => {
	// Agency resolution matrix (from spec REQ-3)
	it("WHOLESALE → 'agencyId'", () => {
		const sale: SaleChannelShape = { channel: "WHOLESALE", isWholesale: false }
		expect(resolveAgencyTargetColumn(sale)).toBe("agencyId")
	})

	it("WHOLESALE + isWholesale=true → 'agencyId' (isWholesale is ignored for WHOLESALE channel)", () => {
		const sale: SaleChannelShape = { channel: "WHOLESALE", isWholesale: true }
		expect(resolveAgencyTargetColumn(sale)).toBe("agencyId")
	})

	it("ONLINE + isWholesale=true → 'wholesaleAgencyId'", () => {
		const sale: SaleChannelShape = { channel: "ONLINE", isWholesale: true }
		expect(resolveAgencyTargetColumn(sale)).toBe("wholesaleAgencyId")
	})

	it("PHYSICAL + isWholesale=true → 'wholesaleAgencyId'", () => {
		const sale: SaleChannelShape = { channel: "PHYSICAL", isWholesale: true }
		expect(resolveAgencyTargetColumn(sale)).toBe("wholesaleAgencyId")
	})

	it("AGENCY + isWholesale=false → null (not editable)", () => {
		const sale: SaleChannelShape = { channel: "AGENCY", isWholesale: false }
		expect(resolveAgencyTargetColumn(sale)).toBeNull()
	})

	it("AGENCY + isWholesale=true → null (AGENCY channel is always disabled)", () => {
		const sale: SaleChannelShape = { channel: "AGENCY", isWholesale: true }
		expect(resolveAgencyTargetColumn(sale)).toBeNull()
	})

	it("ONLINE + isWholesale=false → null", () => {
		const sale: SaleChannelShape = { channel: "ONLINE", isWholesale: false }
		expect(resolveAgencyTargetColumn(sale)).toBeNull()
	})

	it("PHYSICAL + isWholesale=false → null", () => {
		const sale: SaleChannelShape = { channel: "PHYSICAL", isWholesale: false }
		expect(resolveAgencyTargetColumn(sale)).toBeNull()
	})
})

describe("loadSaleForInlineEdit", () => {
	const mockFindUnique = vi.mocked(prisma.saleRecord.findUnique)

	beforeEach(() => {
		mockFindUnique.mockReset()
	})

	it("throws NOT_FOUND when sale does not exist", async () => {
		mockFindUnique.mockResolvedValue(null)

		await expect(loadSaleForInlineEdit("nonexistent-id")).rejects.toMatchObject({
			code: "NOT_FOUND",
		})
	})

	it("throws CANCELLED when sale status is CANCELLED", async () => {
		mockFindUnique.mockResolvedValue({
			id: "sale-123",
			status: "CANCELLED",
			channel: "ONLINE",
			isWholesale: false,
			fileNumber: null,
			comments: null,
			contacted: false,
			agencyId: null,
			wholesaleAgencyId: null,
			updatedAt: new Date(),
			agency: null,
			wholesaleAgency: null,
		} as never)

		await expect(loadSaleForInlineEdit("sale-123")).rejects.toMatchObject({
			code: "CANCELLED",
		})
	})

	it("returns the sale when it exists and is not CANCELLED", async () => {
		const mockSale = {
			id: "sale-123",
			status: "COMPLETED",
			channel: "WHOLESALE",
			isWholesale: false,
			fileNumber: "FN-001",
			comments: null,
			contacted: false,
			agencyId: "agency-abc",
			wholesaleAgencyId: null,
			updatedAt: new Date(),
			agency: { id: "agency-abc", name: "Mayorista Test" },
			wholesaleAgency: null,
		}
		mockFindUnique.mockResolvedValue(mockSale as never)

		const result = await loadSaleForInlineEdit("sale-123")
		expect(result.id).toBe("sale-123")
		expect(result.status).toBe("COMPLETED")
	})
})
