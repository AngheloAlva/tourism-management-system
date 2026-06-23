/**
 * Unit tests for updateInvoicedSaleExecutor.
 * REQ-5: Executor applies stored payload + audit + cash-flow recalc on approval.
 *
 * These tests use mocks — no DB required (unit suite).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ApprovalRequest } from "@/generated/prisma/client"

// ── Mocks ────────────────────────────────────────────────────────────────────

// We mock applySaleUpdateTx and AuditService so these unit tests don't touch DB
vi.mock("@/project/sales/server/apply-sale-update", () => ({
  applySaleUpdateTx: vi.fn().mockResolvedValue({
    id: "sale-1",
    voucher: 100,
    updatedAt: new Date("2026-01-02"),
    passengers: [],
    paymentRecords: [],
    eventBookings: [],
    type: "SALE",
    channel: "PHYSICAL",
    fileNumber: null,
    comments: "updated",
    agencyId: null,
    discount: 0,
    isWholesale: false,
    wholesaleAgencyId: null,
  }),
  isInvoiced: vi.fn().mockReturnValue(true),
}))

vi.mock("@/lib/audit/service", () => ({
  AuditService: {
    logUpdate: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock("@/project/sales/utils/sale-audit-summary", () => ({
  buildSaleAuditSnapshot: vi.fn().mockReturnValue({ type: "SALE" }),
}))

vi.mock("@/project/approvals/utils/fingerprint", () => ({
  fingerprintMatches: vi.fn().mockReturnValue(true),
}))

// ── Import after mocks are set up ─────────────────────────────────────────────

const { updateInvoicedSaleExecutor } = await import(
  "@/project/sales/executors/update-invoiced-sale.executor"
)
const { applySaleUpdateTx } = await import("@/project/sales/server/apply-sale-update")
const { AuditService } = await import("@/lib/audit/service")
const { fingerprintMatches } = await import("@/project/approvals/utils/fingerprint")

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    id: "req-1",
    action: "UPDATE_INVOICED_SALE",
    domain: "sales",
    targetType: "sale-record",
    targetId: "sale-1",
    targetFingerprint: "2026-01-01T00:00:00.000Z",
    status: "APPROVED",
    requestedById: "user-1",
    resolvedById: "admin-1",
    resolvedAt: new Date(),
    executedAt: null,
    reason: "Test update",
    metadata: {
      payload: {
        type: "QUOTE",
        channel: "PHYSICAL",
        isWholesale: false,
        paymentPending: false,
        fileNumberPending: false,
        discount: 0,
        comments: "updated",
        passengerArray: [],
        paymentArray: [],
        eventBookings: [],
      },
    },
    snapshot: null,
    codeHash: null,
    codeLast4: null,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    invalidationReason: null,
    executionError: null,
    ...overrides,
  }
}

function makeTx() {
  return {
    saleRecord: {
      findUnique: vi.fn().mockResolvedValue({
        id: "sale-1",
        updatedAt: new Date("2026-01-01"),
        passengers: [],
        paymentRecords: [],
        eventBookings: [],
        type: "SALE",
        channel: "PHYSICAL",
        fileNumber: null,
        comments: null,
        agencyId: null,
        discount: 0,
        isWholesale: false,
        wholesaleAgencyId: null,
      }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: "admin-1",
        name: "Admin User",
        email: "admin@test.local",
      }),
    },
  } as unknown as import("@/generated/prisma/client").Prisma.TransactionClient
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("updateInvoicedSaleExecutor (unit)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fingerprintMatches).mockReturnValue(true)
  })

  // ── T-EXEC-1: success path — audit called with correct subtype ────────────

  it("T-EXEC-1: success path → applySaleUpdateTx called + AuditService.logUpdate called with sale:update-invoiced subtype and approvalRequestId", async () => {
    const tx = makeTx()
    const request = makeRequest()

    const result = await updateInvoicedSaleExecutor({
      tx,
      request,
      payload: request.metadata as unknown,
      requestedById: "user-1",
      resolvedById: "admin-1",
      targetId: "sale-1",
    })

    expect(result.ok).toBe(true)
    expect(applySaleUpdateTx).toHaveBeenCalled()

    const logUpdateCall = vi.mocked(AuditService.logUpdate).mock.calls[0]
    const metadata = logUpdateCall?.[5] as Record<string, unknown> | undefined // 6th arg = metadata
    expect(metadata?.subtype).toBe("sale:update-invoiced")
    expect(metadata?.approvalRequestId).toBe("req-1")
  })

  // ── T-EXEC-2: fingerprint mismatch → invalidated, no mutation ────────────

  it("T-EXEC-2: fingerprint mismatch → returns invalidated=true, applySaleUpdateTx NOT called", async () => {
    vi.mocked(fingerprintMatches).mockReturnValue(false)

    const tx = makeTx()
    const request = makeRequest({ targetFingerprint: "2026-01-01T00:00:00.000Z" })

    const result = await updateInvoicedSaleExecutor({
      tx,
      request,
      payload: request.metadata as unknown,
      requestedById: "user-1",
      resolvedById: "admin-1",
      targetId: "sale-1",
    })

    expect(result.ok).toBe(false)
    expect((result as { invalidated?: boolean }).invalidated).toBe(true)
    expect((result as { reason?: string }).reason).toBe("target_modified")
    expect(applySaleUpdateTx).not.toHaveBeenCalled()
    expect(AuditService.logUpdate).not.toHaveBeenCalled()
  })

  // ── T-EXEC-3: target not found → invalidated ─────────────────────────────

  it("T-EXEC-3: target not found → returns invalidated=true", async () => {
    const tx = {
      saleRecord: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as import("@/generated/prisma/client").Prisma.TransactionClient

    const request = makeRequest()

    const result = await updateInvoicedSaleExecutor({
      tx,
      request,
      payload: request.metadata as unknown,
      requestedById: "user-1",
      resolvedById: "admin-1",
      targetId: "sale-1",
    })

    expect(result.ok).toBe(false)
    expect((result as { invalidated?: boolean }).invalidated).toBe(true)
    expect((result as { reason?: string }).reason).toBe("target_not_found")
    expect(applySaleUpdateTx).not.toHaveBeenCalled()
  })
})
