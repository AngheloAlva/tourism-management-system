import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("next/headers", () => ({
	headers: vi.fn().mockResolvedValue(new Headers()),
}))

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}))

vi.mock("@/lib/audit/service", () => ({
	AuditService: {
		logUpdate: vi.fn().mockResolvedValue(null),
	},
}))

vi.mock("@/lib/auth", () => ({
	auth: {
		api: {
			getSession: vi.fn(),
		},
	},
}))

vi.mock("@/project/roles/actions/role.actions", () => ({
	canCurrentUserInteractPaths: vi.fn(),
}))

vi.mock("@/project/sales/server/inline-edit-helpers", () => ({
	loadSaleForInlineEdit: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
	prisma: {
		saleRecord: {
			update: vi.fn(),
		},
	},
}))

import { updateSaleComments } from "@/project/sales/actions/inline-edit/update-sale-comments.action"
import { auth } from "@/lib/auth"
import { canCurrentUserInteractPaths } from "@/project/roles/actions/role.actions"
import { loadSaleForInlineEdit } from "@/project/sales/server/inline-edit-helpers"
import { AuditService } from "@/lib/audit/service"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"

const mockGetSession = vi.mocked(auth.api.getSession)
const mockCanInteract = vi.mocked(canCurrentUserInteractPaths)
const mockLoadSale = vi.mocked(loadSaleForInlineEdit)
const mockUpdate = vi.mocked(prisma.saleRecord.update)
const mockLogUpdate = vi.mocked(AuditService.logUpdate)
const mockRevalidatePath = vi.mocked(revalidatePath)

const VALID_SALE_ID = "clxxxxxxxxxxxxxxxxxxxxxx"
const MOCK_USER = { id: "user-123", name: "Operador", email: "op@turismo.cl" }
const MOCK_SALE = {
	id: VALID_SALE_ID,
	status: "COMPLETED" as const,
	channel: "ONLINE" as const,
	isWholesale: false,
	fileNumber: null,
	comments: null,
	contacted: false,
	agencyId: null,
	wholesaleAgencyId: null,
	updatedAt: new Date(),
	agency: null,
	wholesaleAgency: null,
}

function setupAuthMocks(authenticated = true, canInteract = true) {
	if (authenticated) {
		mockGetSession.mockResolvedValue({ user: MOCK_USER, session: {} } as never)
	} else {
		mockGetSession.mockResolvedValue(null)
	}
	mockCanInteract.mockResolvedValue(canInteract)
}

describe("updateSaleComments", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockUpdate.mockResolvedValue({ ...MOCK_SALE, comments: "Follow up needed" } as never)
		mockLoadSale.mockResolvedValue(MOCK_SALE)
	})

	// REQ-8-S1: unauthenticated
	it("returns error when not authenticated (REQ-8-S1)", async () => {
		setupAuthMocks(false)

		const result = await updateSaleComments({ saleRecordId: VALID_SALE_ID, comments: "test" })

		expect(result.success).toBe(false)
		expect(prisma.saleRecord.update).not.toHaveBeenCalled()
	})

	// REQ-1-S1: CANCELLED guard
	it("returns CANCELLED error when sale is cancelled (REQ-1-S1)", async () => {
		setupAuthMocks()
		mockLoadSale.mockRejectedValue({ code: "CANCELLED", message: "El registro ya está cancelado" })

		const result = await updateSaleComments({ saleRecordId: VALID_SALE_ID, comments: "test" })

		expect(result.success).toBe(false)
		expect(prisma.saleRecord.update).not.toHaveBeenCalled()
	})

	// REQ-4-S3: validation — comments > 2000 chars rejected
	it("returns validation error when comments > 2000 chars (REQ-4-S3)", async () => {
		setupAuthMocks()

		const result = await updateSaleComments({
			saleRecordId: VALID_SALE_ID,
			comments: "x".repeat(2001),
		})

		expect(result.success).toBe(false)
		expect(prisma.saleRecord.update).not.toHaveBeenCalled()
	})

	// REQ-4-S1: save a comment
	it("saves a comment and returns success (REQ-4-S1)", async () => {
		setupAuthMocks()
		mockLoadSale.mockResolvedValue({ ...MOCK_SALE, comments: null })

		const result = await updateSaleComments({
			saleRecordId: VALID_SALE_ID,
			comments: "Follow up needed",
		})

		expect(result.success).toBe(true)
		expect(prisma.saleRecord.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: { comments: "Follow up needed" },
			})
		)
	})

	// REQ-4-S2: clear a comment (empty → null)
	it("normalizes empty string to null for comments (REQ-4-S2)", async () => {
		setupAuthMocks()
		mockLoadSale.mockResolvedValue({ ...MOCK_SALE, comments: "Old note" })

		const result = await updateSaleComments({ saleRecordId: VALID_SALE_ID, comments: "" })

		expect(result.success).toBe(true)
		expect(prisma.saleRecord.update).toHaveBeenCalledWith(
			expect.objectContaining({ data: { comments: null } })
		)
	})

	// REQ-9-S3: isolation — only comments in data
	it("prisma update contains ONLY comments in data object (REQ-9-S3)", async () => {
		setupAuthMocks()

		await updateSaleComments({ saleRecordId: VALID_SALE_ID, comments: "test" })

		const dataKeys = Object.keys(mockUpdate.mock.calls[0][0].data)
		expect(dataKeys).toEqual(["comments"])
	})

	// REQ-4-S4: no-op when unchanged — AuditService still called (logUpdate skips no-ops internally)
	it("calls AuditService.logUpdate even on no-op (service decides to skip) (REQ-4-S4)", async () => {
		setupAuthMocks()
		mockLoadSale.mockResolvedValue({ ...MOCK_SALE, comments: "Same note" })

		await updateSaleComments({ saleRecordId: VALID_SALE_ID, comments: "Same note" })

		// AuditService.logUpdate is called — it internally skips if no changes
		expect(mockLogUpdate).toHaveBeenCalled()
	})

	// Audit metadata: source = "inline-edit"
	it("passes metadata.source='inline-edit' to AuditService", async () => {
		setupAuthMocks()
		mockLoadSale.mockResolvedValue({ ...MOCK_SALE, comments: null })

		await updateSaleComments({ saleRecordId: VALID_SALE_ID, comments: "test" })

		expect(mockLogUpdate).toHaveBeenCalledWith(
			"SaleRecord",
			VALID_SALE_ID,
			expect.any(Object),
			expect.objectContaining({ comments: null }),
			expect.objectContaining({ comments: "test" }),
			expect.objectContaining({ source: "inline-edit", field: "comments" })
		)
	})

	// revalidatePath called
	it("calls revalidatePath on success (REQ-9-S3)", async () => {
		setupAuthMocks()

		await updateSaleComments({ saleRecordId: VALID_SALE_ID, comments: "test" })

		expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/registro-de-ventas")
		expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/navegacion-ventas")
	})
})
