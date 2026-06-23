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
	resolveAgencyTargetColumn: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
	prisma: {
		saleRecord: {
			update: vi.fn(),
		},
		agency: {
			findUnique: vi.fn(),
		},
	},
}))

import { updateSaleAgency } from "@/project/sales/actions/inline-edit/update-sale-agency.action"
import { auth } from "@/lib/auth"
import { canCurrentUserInteractPaths } from "@/project/roles/actions/role.actions"
import { loadSaleForInlineEdit, resolveAgencyTargetColumn } from "@/project/sales/server/inline-edit-helpers"
import { AuditService } from "@/lib/audit/service"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"

const mockGetSession = vi.mocked(auth.api.getSession)
const mockCanInteract = vi.mocked(canCurrentUserInteractPaths)
const mockLoadSale = vi.mocked(loadSaleForInlineEdit)
const mockResolveColumn = vi.mocked(resolveAgencyTargetColumn)
const mockSaleUpdate = vi.mocked(prisma.saleRecord.update)
const mockAgencyFindUnique = vi.mocked(prisma.agency.findUnique)
const mockLogUpdate = vi.mocked(AuditService.logUpdate)
const mockRevalidatePath = vi.mocked(revalidatePath)

const VALID_SALE_ID = "clxxxxxxxxxxxxxxxxxxxxxx"
const VALID_AGENCY_ID = "clyyyyyyyyyyyyyyyyyyyyyy"
const MOCK_USER = { id: "user-123", name: "Operador", email: "op@turismo.cl" }
const MOCK_UPDATED_AT = new Date("2026-05-26T00:00:00.000Z")

const WHOLESALE_SALE = {
	id: VALID_SALE_ID,
	status: "COMPLETED" as const,
	channel: "WHOLESALE" as const,
	isWholesale: false,
	fileNumber: null,
	comments: null,
	contacted: false,
	agencyId: "old-agency",
	wholesaleAgencyId: null,
	updatedAt: MOCK_UPDATED_AT,
	agency: { id: "old-agency", name: "Old Agency" },
	wholesaleAgency: null,
}

const ONLINE_WHOLESALE_SALE = {
	...WHOLESALE_SALE,
	channel: "ONLINE" as const,
	isWholesale: true,
	agencyId: null,
	wholesaleAgencyId: "old-ref-agency",
	agency: null,
	wholesaleAgency: { id: "old-ref-agency", name: "Old Referrer" },
}

const MOCK_AGENCY = { id: VALID_AGENCY_ID, name: "New Agency", active: true }

function setupAuthMocks(authenticated = true, canInteract = true) {
	if (authenticated) {
		mockGetSession.mockResolvedValue({ user: MOCK_USER, session: {} } as never)
	} else {
		mockGetSession.mockResolvedValue(null)
	}
	mockCanInteract.mockResolvedValue(canInteract)
}

describe("updateSaleAgency", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockSaleUpdate.mockResolvedValue({ ...WHOLESALE_SALE, agencyId: VALID_AGENCY_ID } as never)
		mockAgencyFindUnique.mockResolvedValue(MOCK_AGENCY as never)
	})

	// REQ-8-S1: unauthenticated
	it("returns error when not authenticated (REQ-8-S1)", async () => {
		setupAuthMocks(false)

		const result = await updateSaleAgency({
			saleRecordId: VALID_SALE_ID,
			agencyId: VALID_AGENCY_ID,
			expectedUpdatedAt: MOCK_UPDATED_AT,
		})

		expect(result.success).toBe(false)
		expect(prisma.saleRecord.update).not.toHaveBeenCalled()
	})

	// REQ-1-S1: CANCELLED guard
	it("returns CANCELLED error when sale is cancelled (REQ-1-S1)", async () => {
		setupAuthMocks()
		mockLoadSale.mockRejectedValue({ code: "CANCELLED", message: "El registro ya está cancelado" })

		const result = await updateSaleAgency({
			saleRecordId: VALID_SALE_ID,
			agencyId: VALID_AGENCY_ID,
			expectedUpdatedAt: MOCK_UPDATED_AT,
		})

		expect(result.success).toBe(false)
		expect(prisma.saleRecord.update).not.toHaveBeenCalled()
	})

	// STALE check: concurrent edit rejected
	it("returns STALE error when expectedUpdatedAt does not match (REQ-9-S2 / STALE path)", async () => {
		setupAuthMocks()
		const staleSale = { ...WHOLESALE_SALE, updatedAt: new Date("2026-05-26T01:00:00.000Z") }
		mockLoadSale.mockResolvedValue(staleSale)
		mockResolveColumn.mockReturnValue("agencyId")

		const result = await updateSaleAgency({
			saleRecordId: VALID_SALE_ID,
			agencyId: VALID_AGENCY_ID,
			expectedUpdatedAt: MOCK_UPDATED_AT, // stale — server has a newer value
		})

		expect(result.success).toBe(false)
		if (!result.success) {
			expect(result.code).toBe("STALE")
		}
		expect(prisma.saleRecord.update).not.toHaveBeenCalled()
	})

	// REQ-3-S3: AGENCY channel → invalid target → rejected
	it("returns INVALID_AGENCY_TARGET when resolveAgencyTargetColumn returns null (REQ-3-S3)", async () => {
		setupAuthMocks()
		const agencySale = { ...WHOLESALE_SALE, channel: "AGENCY" as const }
		mockLoadSale.mockResolvedValue(agencySale)
		mockResolveColumn.mockReturnValue(null)

		const result = await updateSaleAgency({
			saleRecordId: VALID_SALE_ID,
			agencyId: VALID_AGENCY_ID,
			expectedUpdatedAt: MOCK_UPDATED_AT,
		})

		expect(result.success).toBe(false)
		if (!result.success) {
			expect(result.code).toBe("INVALID_AGENCY_TARGET")
		}
		expect(prisma.saleRecord.update).not.toHaveBeenCalled()
	})

	// REQ-3-S4: non-existent agency rejected
	it("returns INVALID_AGENCY_TARGET when agency does not exist (REQ-3-S4)", async () => {
		setupAuthMocks()
		mockLoadSale.mockResolvedValue(WHOLESALE_SALE)
		mockResolveColumn.mockReturnValue("agencyId")
		mockAgencyFindUnique.mockResolvedValue(null)

		const result = await updateSaleAgency({
			saleRecordId: VALID_SALE_ID,
			agencyId: VALID_AGENCY_ID,
			expectedUpdatedAt: MOCK_UPDATED_AT,
		})

		expect(result.success).toBe(false)
		if (!result.success) {
			expect(result.code).toBe("INVALID_AGENCY_TARGET")
		}
		expect(prisma.saleRecord.update).not.toHaveBeenCalled()
	})

	// W-1: agency must be active to be assigned
	it("queries agency with active:true filter to reject inactive agencies (W-1)", async () => {
		setupAuthMocks()
		mockLoadSale.mockResolvedValue(WHOLESALE_SALE)
		mockResolveColumn.mockReturnValue("agencyId")

		await updateSaleAgency({
			saleRecordId: VALID_SALE_ID,
			agencyId: VALID_AGENCY_ID,
			expectedUpdatedAt: MOCK_UPDATED_AT,
		})

		expect(mockAgencyFindUnique).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: VALID_AGENCY_ID, active: true },
			})
		)
	})

	// W-2: consolidate to a single findUnique call
	it("calls prisma.agency.findUnique only once per action (W-2)", async () => {
		setupAuthMocks()
		mockLoadSale.mockResolvedValue(WHOLESALE_SALE)
		mockResolveColumn.mockReturnValue("agencyId")

		await updateSaleAgency({
			saleRecordId: VALID_SALE_ID,
			agencyId: VALID_AGENCY_ID,
			expectedUpdatedAt: MOCK_UPDATED_AT,
		})

		expect(mockAgencyFindUnique).toHaveBeenCalledTimes(1)
	})

	// REQ-3-S1: WHOLESALE sale — writes agencyId only
	it("writes agencyId and not wholesaleAgencyId for WHOLESALE sale (REQ-3-S1)", async () => {
		setupAuthMocks()
		mockLoadSale.mockResolvedValue(WHOLESALE_SALE)
		mockResolveColumn.mockReturnValue("agencyId")

		await updateSaleAgency({
			saleRecordId: VALID_SALE_ID,
			agencyId: VALID_AGENCY_ID,
			expectedUpdatedAt: MOCK_UPDATED_AT,
		})

		expect(prisma.saleRecord.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: { agencyId: VALID_AGENCY_ID },
			})
		)
		const dataKeys = Object.keys(mockSaleUpdate.mock.calls[0][0].data)
		expect(dataKeys).not.toContain("wholesaleAgencyId")
	})

	// REQ-3-S2: ONLINE+isWholesale — writes wholesaleAgencyId only
	it("writes wholesaleAgencyId for ONLINE+isWholesale sale (REQ-3-S2)", async () => {
		setupAuthMocks()
		mockLoadSale.mockResolvedValue(ONLINE_WHOLESALE_SALE)
		mockResolveColumn.mockReturnValue("wholesaleAgencyId")

		await updateSaleAgency({
			saleRecordId: VALID_SALE_ID,
			agencyId: VALID_AGENCY_ID,
			expectedUpdatedAt: MOCK_UPDATED_AT,
		})

		const updateCall = mockSaleUpdate.mock.calls[0][0]
		expect(updateCall.data).toEqual({ wholesaleAgencyId: VALID_AGENCY_ID })
		expect(Object.keys(updateCall.data)).not.toContain("agencyId")
	})

	// REQ-3-S5: Audit log records correct column + before/after
	it("audit log records agencyId change for WHOLESALE sale (REQ-3-S5)", async () => {
		setupAuthMocks()
		mockLoadSale.mockResolvedValue(WHOLESALE_SALE)
		mockResolveColumn.mockReturnValue("agencyId")

		await updateSaleAgency({
			saleRecordId: VALID_SALE_ID,
			agencyId: VALID_AGENCY_ID,
			expectedUpdatedAt: MOCK_UPDATED_AT,
		})

		expect(mockLogUpdate).toHaveBeenCalledWith(
			"SaleRecord",
			VALID_SALE_ID,
			expect.objectContaining({ id: "user-123" }),
			expect.objectContaining({ agencyId: "old-agency" }),
			expect.objectContaining({ agencyId: VALID_AGENCY_ID }),
			expect.objectContaining({ source: "inline-edit", field: "agencyId" })
		)
	})

	// REQ-3-S6: Audit log for ONLINE+isWholesale records wholesaleAgencyId
	it("audit log records wholesaleAgencyId change for ONLINE+isWholesale sale (REQ-3-S6)", async () => {
		setupAuthMocks()
		mockLoadSale.mockResolvedValue(ONLINE_WHOLESALE_SALE)
		mockResolveColumn.mockReturnValue("wholesaleAgencyId")

		await updateSaleAgency({
			saleRecordId: VALID_SALE_ID,
			agencyId: VALID_AGENCY_ID,
			expectedUpdatedAt: MOCK_UPDATED_AT,
		})

		expect(mockLogUpdate).toHaveBeenCalledWith(
			"SaleRecord",
			VALID_SALE_ID,
			expect.any(Object),
			expect.objectContaining({ wholesaleAgencyId: "old-ref-agency" }),
			expect.objectContaining({ wholesaleAgencyId: VALID_AGENCY_ID }),
			expect.objectContaining({ source: "inline-edit", field: "wholesaleAgencyId" })
		)
	})

	// REQ-3-S7: clearing agency (null) is allowed
	it("allows clearing agency by passing null (REQ-3-S7)", async () => {
		setupAuthMocks()
		mockLoadSale.mockResolvedValue(WHOLESALE_SALE)
		mockResolveColumn.mockReturnValue("agencyId")

		const result = await updateSaleAgency({
			saleRecordId: VALID_SALE_ID,
			agencyId: null,
			expectedUpdatedAt: MOCK_UPDATED_AT,
		})

		expect(result.success).toBe(true)
		expect(prisma.saleRecord.update).toHaveBeenCalledWith(
			expect.objectContaining({ data: { agencyId: null } })
		)
	})

	// REQ-9-S2: isolation — only ONE column written at a time
	it("data object contains ONLY the resolved column (REQ-9-S2)", async () => {
		setupAuthMocks()
		mockLoadSale.mockResolvedValue(WHOLESALE_SALE)
		mockResolveColumn.mockReturnValue("agencyId")

		await updateSaleAgency({
			saleRecordId: VALID_SALE_ID,
			agencyId: VALID_AGENCY_ID,
			expectedUpdatedAt: MOCK_UPDATED_AT,
		})

		const dataKeys = Object.keys(mockSaleUpdate.mock.calls[0][0].data)
		expect(dataKeys).toHaveLength(1)
		expect(dataKeys[0]).toBe("agencyId")
	})

	// revalidatePath called
	it("calls revalidatePath on success", async () => {
		setupAuthMocks()
		mockLoadSale.mockResolvedValue(WHOLESALE_SALE)
		mockResolveColumn.mockReturnValue("agencyId")

		await updateSaleAgency({
			saleRecordId: VALID_SALE_ID,
			agencyId: VALID_AGENCY_ID,
			expectedUpdatedAt: MOCK_UPDATED_AT,
		})

		expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/registro-de-ventas")
		expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/navegacion-ventas")
	})
})
