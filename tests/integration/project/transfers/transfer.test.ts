/**
 * T-C9 — Transfers integration tests
 * Production code: src/project/transfers/actions/transfer.actions.ts
 *                  src/project/transfers/actions/update-payment-status.ts
 *
 * Key observations about the production code:
 * - Transfer = AgencyTransfer with type: "OUTGOING"
 * - createTransfer: requires complex TransferFormData with eventTransfers + passengerPrices
 *   to build new bookings. Not practical to call in tests — uses factory for setup instead.
 * - deleteTransfer: hard delete. Auth + permission check only.
 * - updateTransfer: writes AuditLog, calls revalidatePath("/dashboard/navegacion-traspasos").
 *   Validates passenger selection, excludes self from "already transferred" check.
 * - cancelTransfer: sets status=CANCELLED, writes AuditLog, calls revalidatePath.
 * - batchUpdatePaymentStatus (update-payment-status.ts): updates paymentStatus on multiple
 *   transfers, calls revalidatePath("/dashboard/balance-de-agencias").
 * - check-transferred-events.ts and get-management-close-data.ts are read-only.
 * - canCurrentUserInteractPaths checks BOTH "/dashboard/traspasos" and "/dashboard/navegacion-traspasos" — admin passes.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import {
  cancelTransfer,
  deleteTransfer,
  updateTransfer,
} from "@/project/transfers/actions/transfer.actions"
import { batchUpdatePaymentStatus } from "@/project/transfers/actions/update-payment-status"
import { cancelTransferExecutor } from "@/project/transfers/executors/cancel-transfer.executor"
import { deleteTransferExecutor } from "@/project/transfers/executors/delete-transfer.executor"

// batchUpdatePaymentStatus signature:
// type BatchUpdatePaymentStatusParams = {
//   type: "RECEPTION" | "TRANSFER"
//   vouchers: number[]          ← voucher numbers, NOT IDs
//   status: "PENDING" | "ENTRANCE_ONLY" | "TOUR_ONLY" | "FULLY_PAID"
//   proofOfPayment?: string
// }
import { loginAs, logout } from "../../helpers/auth"
import { truncateAll, disconnect } from "../../helpers/db"
import { createUser, createTransfer, createTransferAgency, createApproval } from "../../helpers/factories"

describe("transfer.actions integration", () => {
  beforeEach(async () => {
    await truncateAll()
    vi.mocked(revalidatePath).mockClear()
  })

  afterAll(async () => {
    await disconnect()
  })

  // ─── cancelTransfer (approval gate) ─────────────────────────────────────────
  //
  // cancelTransfer now routes through the async approvals system:
  // - The action creates an ApprovalRequest (PENDING) and returns { success, approvalRequired, requestId }.
  // - The actual status mutation (CANCELLED + AuditLog + revalidatePath) is performed by
  //   cancelTransferExecutor once the admin approves. The transfer row is NOT mutated by the action.

  describe("cancelTransfer", () => {
    it("creates a PENDING ApprovalRequest and leaves the transfer status unchanged", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const transfer = await createTransfer({ createdById: admin.id })

      const result = await cancelTransfer(transfer.id, "Test cancel reason")

      // Action creates an approval request — cancellation is deferred
      expect(result.success).toBe(true)
      if (!result.success) throw new Error("unreachable")
      expect(result.approvalRequired).toBe(true)
      expect(result.requestId).toBeTruthy()

      // Transfer status is still ACTIVE (not yet cancelled)
      const updated = await prisma.agencyTransfer.findUnique({ where: { id: transfer.id } })
      expect(updated?.status).toBe("ACTIVE")

      // ApprovalRequest row exists with PENDING status
      const request = await prisma.approvalRequest.findUnique({
        where: { id: result.requestId },
      })
      expect(request).not.toBeNull()
      expect(request?.status).toBe("PENDING")
      expect(request?.action).toBe("CANCEL_TRANSFER")
      expect(request?.targetId).toBe(transfer.id)

      // No revalidatePath called — that happens in the executor, not the action
      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled()
    })

    it("returns success:false when transfer is already CANCELLED", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const transfer = await createTransfer({ createdById: admin.id, status: "CANCELLED" })

      const result = await cancelTransfer(transfer.id)

      expect(result.success).toBe(false)
      expect(result.error).toContain("cancelado")
    })

    it("returns success:false when transfer does not exist", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const result = await cancelTransfer("non-existent-id")

      expect(result.success).toBe(false)
    })

    it("returns success:false when unauthenticated", async () => {
      logout()
      const transfer = await createTransfer()

      const result = await cancelTransfer(transfer.id)

      expect(result.success).toBe(false)
    })
  })

  // ─── deleteTransfer (approval gate) ─────────────────────────────────────────
  //
  // deleteTransfer now routes through the async approvals system:
  // - The action creates an ApprovalRequest (PENDING) and returns { success, approvalRequired, requestId }.
  // - The actual hard-delete is performed by deleteTransferExecutor once the admin approves.
  // - The transfer row is NOT deleted during the action call.

  describe("deleteTransfer", () => {
    it("creates a PENDING ApprovalRequest and leaves the transfer row intact", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const transfer = await createTransfer({ createdById: admin.id })

      const result = await deleteTransfer(transfer.id, "Test deletion reason")

      // Action creates an approval request — does NOT hard-delete immediately
      expect(result.success).toBe(true)
      if (!result.success) throw new Error("unreachable")
      expect(result.approvalRequired).toBe(true)
      expect(result.requestId).toBeTruthy()

      // Transfer row still exists
      const row = await prisma.agencyTransfer.findUnique({ where: { id: transfer.id } })
      expect(row).not.toBeNull()

      // ApprovalRequest row exists with PENDING status
      const request = await prisma.approvalRequest.findUnique({
        where: { id: result.requestId },
      })
      expect(request).not.toBeNull()
      expect(request?.status).toBe("PENDING")
      expect(request?.action).toBe("DELETE_TRANSFER")
      expect(request?.targetId).toBe(transfer.id)
    })

    it("returns success:false when transfer does not exist", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const result = await deleteTransfer("non-existent-id", "reason")

      expect(result.success).toBe(false)
    })

    it("returns success:false when unauthenticated", async () => {
      logout()
      const transfer = await createTransfer()

      const result = await deleteTransfer(transfer.id, "reason")

      expect(result.success).toBe(false)
    })
  })

  // ─── updateTransfer (guard tests) ────────────────────────────────────────────

  describe("updateTransfer", () => {
    it("returns success:false when transfer is CANCELLED (cannot update cancelled)", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const agency = await createTransferAgency()
      const transfer = await createTransfer({ createdById: admin.id, status: "CANCELLED" })

      // Minimal TransferFormData to hit the guard early
      const minimalData = {
        saleRecordId: "non-existent",
        agencyId: agency.id,
        date: new Date(),
        type: "OUTGOING" as const,
        paymentStatus: "PENDING" as const,
        comments: undefined,
        eventTransfers: [],
        payments: [],
      }

      const result = await updateTransfer(transfer.id, minimalData)

      expect(result.success).toBe(false)
      expect(result.error).toContain("cancelado")
    })

    it("returns success:false when transfer does not exist", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const agency = await createTransferAgency()

      const minimalData = {
        saleRecordId: "non-existent",
        agencyId: agency.id,
        date: new Date(),
        type: "OUTGOING" as const,
        paymentStatus: "PENDING" as const,
        comments: undefined,
        eventTransfers: [],
        payments: [],
      }

      const result = await updateTransfer("non-existent-id", minimalData)

      expect(result.success).toBe(false)
      expect(result.error).toContain("encontrado")
    })

    it("returns success:false when unauthenticated", async () => {
      logout()

      const minimalData = {
        saleRecordId: "any",
        agencyId: "any",
        date: new Date(),
        type: "OUTGOING" as const,
        paymentStatus: "PENDING" as const,
        comments: undefined,
        eventTransfers: [],
        payments: [],
      }

      const result = await updateTransfer("any-id", minimalData)

      expect(result.success).toBe(false)
    })
  })

  // ─── batchUpdatePaymentStatus ────────────────────────────────────────────────
  // Actual signature: { type: "RECEPTION"|"TRANSFER", vouchers: number[], status, proofOfPayment? }
  // Matches by voucher number (not ID), filters by transfer type (INCOMING/OUTGOING).
  // No getAuthUser() call — uses canCurrentUserInteractPath only (permission check).

  describe("batchUpdatePaymentStatus", () => {
    it("updates paymentStatus on OUTGOING transfers by voucher number and calls revalidatePath", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const agency = await createTransferAgency()
      const t1 = await createTransfer({ createdById: admin.id, agencyId: agency.id })
      const t2 = await createTransfer({ createdById: admin.id, agencyId: agency.id })

      const result = await batchUpdatePaymentStatus({
        type: "TRANSFER",
        vouchers: [t1.voucher, t2.voucher],
        status: "FULLY_PAID",
      })

      expect(result.success).toBe(true)

      const updated1 = await prisma.agencyTransfer.findUnique({ where: { id: t1.id } })
      const updated2 = await prisma.agencyTransfer.findUnique({ where: { id: t2.id } })
      expect(updated1?.paymentStatus).toBe("FULLY_PAID")
      expect(updated2?.paymentStatus).toBe("FULLY_PAID")

      expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/dashboard/balance-de-agencias")
    })

    it("throws when unauthenticated (canCurrentUserInteractPath calls getAuthUser which throws)", async () => {
      // batchUpdatePaymentStatus → canCurrentUserInteractPath → getAuthUser → throws "No autenticado"
      // when session is null. The error propagates as a thrown Error (not {success:false}).
      logout()

      await expect(
        batchUpdatePaymentStatus({
          type: "TRANSFER",
          vouchers: [700001],
          status: "FULLY_PAID",
        }),
      ).rejects.toThrow("No autenticado")
    })
  })

  // ─── cancelTransferExecutor (happy-path end-to-end) ─────────────────────
  //
  // Proves the cancellation path works when an approval is executed.

  describe("cancelTransferExecutor", () => {
    it("sets status to CANCELLED on the transfer and writes an AuditLog", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })

      const transfer = await createTransfer({ createdById: admin.id })

      const approval = await createApproval({
        requestedById: admin.id,
        action: "CANCEL_TRANSFER",
        domain: "transfers",
        targetType: "agency-transfer",
        targetId: transfer.id,
        targetFingerprint: transfer.updatedAt.toISOString(),
        status: "APPROVED",
      })

      const result = await prisma.$transaction((tx) =>
        cancelTransferExecutor({
          request: approval,
          payload: { reason: "Executor integration test" },
          requestedById: admin.id,
          resolvedById: admin.id,
          targetId: transfer.id,
          tx,
        }),
      )

      expect(result.ok).toBe(true)

      const updated = await prisma.agencyTransfer.findUnique({ where: { id: transfer.id } })
      expect(updated?.status).toBe("CANCELLED")
      expect(updated?.cancelledById).toBe(admin.id)

      const auditLog = await prisma.auditLog.findFirst({
        where: { entityType: "AgencyTransfer", entityId: transfer.id, action: "UPDATE" },
      })
      expect(auditLog).not.toBeNull()
    })
  })

  // ─── deleteTransferExecutor (happy-path end-to-end) ─────────────────────
  //
  // Proves the hard-delete path works when an approval is executed.

  describe("deleteTransferExecutor", () => {
    it("hard-deletes the AgencyTransfer row when called with a valid ApprovalRequest context", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })

      const transfer = await createTransfer({ createdById: admin.id })

      const approval = await createApproval({
        requestedById: admin.id,
        action: "DELETE_TRANSFER",
        domain: "transfers",
        targetType: "agency-transfer",
        targetId: transfer.id,
        targetFingerprint: transfer.updatedAt.toISOString(),
        status: "APPROVED",
      })

      const result = await prisma.$transaction((tx) =>
        deleteTransferExecutor({
          request: approval,
          payload: { reason: "Executor integration test" },
          requestedById: admin.id,
          resolvedById: admin.id,
          targetId: transfer.id,
          tx,
        }),
      )

      expect(result.ok).toBe(true)

      // Row should be gone
      const row = await prisma.agencyTransfer.findUnique({ where: { id: transfer.id } })
      expect(row).toBeNull()
    })
  })
})
