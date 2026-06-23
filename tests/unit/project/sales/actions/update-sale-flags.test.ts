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

import { updateSaleFlags } from "@/project/sales/actions/inline-edit/update-sale-flags.action"
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
	contacted: true,
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

describe("updateSaleFlags", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockUpdate.mockResolvedValue({ ...MOCK_SALE, contacted: false } as never)
		mockLoadSale.mockResolvedValue(MOCK_SALE)
	})

	// REQ-8-S1: unauthenticated
	it("returns error when not authenticated (REQ-8-S1)", async () => {
		setupAuthMocks(false)

		const result = await updateSaleFlags({ saleRecordId: VALID_SALE_ID, contacted: false })

		expect(result.success).toBe(false)
		expect(prisma.saleRecord.update).not.toHaveBeenCalled()
	})

	// REQ-1-S1: CANCELLED guard
	it("returns CANCELLED error when sale is cancelled (REQ-1-S1)", async () => {
		setupAuthMocks()
		mockLoadSale.mockRejectedValue({ code: "CANCELLED", message: "El registro ya está cancelado" })

		const result = await updateSaleFlags({ saleRecordId: VALID_SALE_ID, contacted: false })

		expect(result.success).toBe(false)
		expect(prisma.saleRecord.update).not.toHaveBeenCalled()
	})

	// REQ-5-S4: invalid value rejected (non-boolean)
	it("returns validation error when contacted is not boolean (REQ-5-S4)", async () => {
		setupAuthMocks()

		const result = await updateSaleFlags({
			saleRecordId: VALID_SALE_ID,
			contacted: "yes" as unknown as boolean,
		})

		expect(result.success).toBe(false)
		expect(prisma.saleRecord.update).not.toHaveBeenCalled()
	})

	// REQ-5-S1: toggle true→false
	it("saves contacted=false and returns success (REQ-5-S1)", async () => {
		setupAuthMocks()
		mockLoadSale.mockResolvedValue({ ...MOCK_SALE, contacted: true })

		const result = await updateSaleFlags({ saleRecordId: VALID_SALE_ID, contacted: false })

		expect(result.success).toBe(true)
		expect(prisma.saleRecord.update).toHaveBeenCalledWith(
			expect.objectContaining({ data: { contacted: false } })
		)
	})

	// REQ-5-S2: toggle false→true
	it("saves contacted=true and returns success (REQ-5-S2)", async () => {
		setupAuthMocks()
		mockLoadSale.mockResolvedValue({ ...MOCK_SALE, contacted: false })
		mockUpdate.mockResolvedValue({ ...MOCK_SALE, contacted: true } as never)

		const result = await updateSaleFlags({ saleRecordId: VALID_SALE_ID, contacted: true })

		expect(result.success).toBe(true)
		expect(prisma.saleRecord.update).toHaveBeenCalledWith(
			expect.objectContaining({ data: { contacted: true } })
		)
	})

	// REQ-5-S3: no-op when value unchanged — AuditService called (it decides to skip internally)
	it("calls AuditService.logUpdate even on no-op (service decides) (REQ-5-S3)", async () => {
		setupAuthMocks()
		mockLoadSale.mockResolvedValue({ ...MOCK_SALE, contacted: true })

		await updateSaleFlags({ saleRecordId: VALID_SALE_ID, contacted: true })

		expect(mockLogUpdate).toHaveBeenCalled()
	})

	// REQ-9-S4: isolation — only contacted in data
	it("prisma update contains ONLY contacted in data object (REQ-9-S4)", async () => {
		setupAuthMocks()

		await updateSaleFlags({ saleRecordId: VALID_SALE_ID, contacted: false })

		const dataKeys = Object.keys(mockUpdate.mock.calls[0][0].data)
		expect(dataKeys).toEqual(["contacted"])
	})

	// REQ-9-S5: booking.date validation must NOT run (past-date sales succeed)
	it("succeeds regardless of booking dates (REQ-9-S5)", async () => {
		setupAuthMocks()
		// The sale has no booking.date check — action must succeed
		const result = await updateSaleFlags({ saleRecordId: VALID_SALE_ID, contacted: false })

		expect(result.success).toBe(true)
	})

	// Audit metadata
	it("passes metadata.source='inline-edit' to AuditService", async () => {
		setupAuthMocks()
		mockLoadSale.mockResolvedValue({ ...MOCK_SALE, contacted: true })

		await updateSaleFlags({ saleRecordId: VALID_SALE_ID, contacted: false })

		expect(mockLogUpdate).toHaveBeenCalledWith(
			"SaleRecord",
			VALID_SALE_ID,
			expect.objectContaining({ id: "user-123" }),
			expect.objectContaining({ contacted: true }),
			expect.objectContaining({ contacted: false }),
			expect.objectContaining({ source: "inline-edit", field: "contacted" })
		)
	})

	// revalidatePath called
	it("calls revalidatePath on success (REQ-9-S4)", async () => {
		setupAuthMocks()

		await updateSaleFlags({ saleRecordId: VALID_SALE_ID, contacted: false })

		expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/registro-de-ventas")
		expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/navegacion-ventas")
	})
})
