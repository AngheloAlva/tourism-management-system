import { describe, expect, it, vi, beforeEach } from "vitest"

// Mock next/headers (required by "use server" actions in unit tests)
vi.mock("next/headers", () => ({
	headers: vi.fn().mockResolvedValue(new Headers()),
}))

// Mock next/cache
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}))

// Mock AuditService
vi.mock("@/lib/audit/service", () => ({
	AuditService: {
		logUpdate: vi.fn().mockResolvedValue(null),
	},
}))

// Mock auth
vi.mock("@/lib/auth", () => ({
	auth: {
		api: {
			getSession: vi.fn(),
		},
	},
}))

// Mock role actions
vi.mock("@/project/roles/actions/role.actions", () => ({
	canCurrentUserInteractPaths: vi.fn(),
}))

// Mock helpers
vi.mock("@/project/sales/server/inline-edit-helpers", () => ({
	loadSaleForInlineEdit: vi.fn(),
}))

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
	prisma: {
		saleRecord: {
			update: vi.fn(),
		},
	},
}))

import { updateSaleFileInfo } from "@/project/sales/actions/inline-edit/update-sale-file-info.action"
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
	channel: "WHOLESALE" as const,
	isWholesale: false,
	fileNumber: null,
	comments: null,
	contacted: false,
	agencyId: "agency-abc",
	wholesaleAgencyId: null,
	updatedAt: new Date(),
	agency: { id: "agency-abc", name: "Test Agency" },
	wholesaleAgency: null,
}

const MOCK_UPDATED_SALE = { ...MOCK_SALE, fileNumber: "FN-2026-001" }

function setupAuthMocks(authenticated = true, canInteract = true) {
	if (authenticated) {
		mockGetSession.mockResolvedValue({ user: MOCK_USER, session: {} } as never)
	} else {
		mockGetSession.mockResolvedValue(null)
	}
	mockCanInteract.mockResolvedValue(canInteract)
}

describe("updateSaleFileInfo", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockUpdate.mockResolvedValue(MOCK_UPDATED_SALE as never)
		mockLoadSale.mockResolvedValue(MOCK_SALE)
	})

	// REQ-8-S1: unauthenticated call rejected
	it("returns error when no session (REQ-8-S1)", async () => {
		setupAuthMocks(false)

		const result = await updateSaleFileInfo({ saleRecordId: VALID_SALE_ID, fileNumber: "FN-001" })

		expect(result.success).toBe(false)
		expect(result).toMatchObject({ success: false })
		expect(prisma.saleRecord.update).not.toHaveBeenCalled()
	})

	// REQ-8-S1: no permission rejected
	it("returns error when user lacks permission (REQ-8-S1)", async () => {
		setupAuthMocks(true, false)

		const result = await updateSaleFileInfo({ saleRecordId: VALID_SALE_ID, fileNumber: "FN-001" })

		expect(result.success).toBe(false)
		expect(prisma.saleRecord.update).not.toHaveBeenCalled()
	})

	// REQ-2-S5: validation — fileNumber too long
	it("returns validation error when fileNumber > 120 chars (REQ-2-S5)", async () => {
		setupAuthMocks()

		const result = await updateSaleFileInfo({
			saleRecordId: VALID_SALE_ID,
			fileNumber: "x".repeat(121),
		})

		expect(result.success).toBe(false)
		expect(prisma.saleRecord.update).not.toHaveBeenCalled()
	})

	// REQ-1-S1: CANCELLED sale guard (via loadSaleForInlineEdit throwing)
	it("returns CANCELLED error when sale is cancelled (REQ-1-S1)", async () => {
		setupAuthMocks()
		mockLoadSale.mockRejectedValue({ code: "CANCELLED", message: "El registro ya está cancelado" })

		const result = await updateSaleFileInfo({ saleRecordId: VALID_SALE_ID, fileNumber: "FN-001" })

		expect(result.success).toBe(false)
		expect(result).toMatchObject({ success: false })
		expect(prisma.saleRecord.update).not.toHaveBeenCalled()
	})

	// REQ-2-S1: save valid fileNumber
	it("saves valid fileNumber and returns success (REQ-2-S1)", async () => {
		setupAuthMocks()
		mockLoadSale.mockResolvedValue({ ...MOCK_SALE, fileNumber: null })

		const result = await updateSaleFileInfo({ saleRecordId: VALID_SALE_ID, fileNumber: "FN-2026-001" })

		expect(result.success).toBe(true)
		expect(prisma.saleRecord.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ fileNumber: "FN-2026-001" }),
			})
		)
	})

	// REQ-2-S2: clear fileNumber (set to null/empty)
	it("normalizes empty string to null for fileNumber (REQ-2-S2)", async () => {
		setupAuthMocks()
		mockLoadSale.mockResolvedValue({ ...MOCK_SALE, fileNumber: "FN-OLD" })

		const result = await updateSaleFileInfo({ saleRecordId: VALID_SALE_ID, fileNumber: "" })

		expect(result.success).toBe(true)
		expect(prisma.saleRecord.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ fileNumber: null }),
			})
		)
	})

	// REQ-9-S1: isolation — only fileNumber in update data
	it("prisma update contains ONLY fileNumber in data object (REQ-9-S1)", async () => {
		setupAuthMocks()

		await updateSaleFileInfo({ saleRecordId: VALID_SALE_ID, fileNumber: "FN-2026-001" })

		const updateCall = mockUpdate.mock.calls[0][0]
		const dataKeys = Object.keys(updateCall.data)
		expect(dataKeys).toEqual(["fileNumber"])
	})

	// REQ-8-S2: session user used for audit
	it("passes session user identity to AuditService (REQ-8-S2)", async () => {
		setupAuthMocks()
		mockLoadSale.mockResolvedValue({ ...MOCK_SALE, fileNumber: null })

		await updateSaleFileInfo({ saleRecordId: VALID_SALE_ID, fileNumber: "FN-2026-001" })

		expect(mockLogUpdate).toHaveBeenCalledWith(
			"SaleRecord",
			VALID_SALE_ID,
			expect.objectContaining({ id: "user-123", name: "Operador", email: "op@turismo.cl" }),
			expect.any(Object),
			expect.any(Object),
			expect.objectContaining({ source: "inline-edit" })
		)
	})

	// REQ-9-S1: revalidatePath called
	it("calls revalidatePath on success", async () => {
		setupAuthMocks()

		await updateSaleFileInfo({ saleRecordId: VALID_SALE_ID, fileNumber: "FN-2026-001" })

		expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/registro-de-ventas")
		expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/navegacion-ventas")
	})
})
