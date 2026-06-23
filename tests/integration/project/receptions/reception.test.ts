/**
 * T-C8 — Receptions integration tests
 * Production code: src/project/receptions/actions/reception.actions.ts
 *
 * Key observations about the production code:
 * - Reception = AgencyTransfer with type: "INCOMING"
 * - createReception: complex transaction (requires agencyId + eventDetails + passengers).
 *   Does NOT call revalidatePath. No audit on create.
 * - updateReception: writes AuditLog, calls revalidatePath("/dashboard/navegacion-recepciones").
 *   Requires non-CANCELLED reception.
 * - deleteReception: hard delete via prisma.agencyTransfer.delete. No audit, no revalidatePath.
 * - cancelReception: sets status=CANCELLED, writes AuditLog via AuditService.logDelete,
 *   calls revalidatePath("/dashboard/navegacion-recepciones").
 * - requireReceptionInteraction checks canCurrentUserInteractPath("/recepcion") — admin passes.
 * - For integration tests we use the factory (bypasses complex eventDetails form payload)
 *   and test cancelReception + deleteReception + updateReception guards.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import {
  cancelReception,
  deleteReception,
  updateReception,
} from "@/project/receptions/actions/reception.actions"
import { cancelReceptionExecutor } from "@/project/receptions/executors/cancel-reception.executor"
import { deleteReceptionExecutor } from "@/project/receptions/executors/delete-reception.executor"
import { loginAs, logout } from "../../helpers/auth"
import { truncateAll, disconnect } from "../../helpers/db"
import { createUser, createReception, createApproval } from "../../helpers/factories"

describe("reception.actions integration", () => {
  beforeEach(async () => {
    await truncateAll()
    vi.mocked(revalidatePath).mockClear()
  })

  afterAll(async () => {
    await disconnect()
  })

  // ─── cancelReception (approval gate) ─────────────────────────────────────────
  //
  // cancelReception now routes through the async approvals system:
  // - The action creates an ApprovalRequest (PENDING) and returns { success, approvalRequired, requestId }.
  // - The actual status mutation (CANCELLED + AuditLog + revalidatePath) is performed by
  //   cancelReceptionExecutor once the admin approves. The reception row is NOT mutated by the action.

  describe("cancelReception", () => {
    it("creates a PENDING ApprovalRequest and leaves the reception status unchanged", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const reception = await createReception({ createdById: admin.id })

      const result = await cancelReception(reception.id, "Test cancellation reason")

      // Action creates an approval request — cancellation is deferred
      expect(result.success).toBe(true)
      if (!result.success) throw new Error("unreachable")
      expect(result.approvalRequired).toBe(true)
      expect(result.requestId).toBeTruthy()

      // Reception status is still ACTIVE (not yet cancelled)
      const updated = await prisma.agencyTransfer.findUnique({ where: { id: reception.id } })
      expect(updated?.status).toBe("ACTIVE")

      // ApprovalRequest row exists with PENDING status
      const request = await prisma.approvalRequest.findUnique({
        where: { id: result.requestId },
      })
      expect(request).not.toBeNull()
      expect(request?.status).toBe("PENDING")
      expect(request?.action).toBe("CANCEL_RECEPTION")
      expect(request?.targetId).toBe(reception.id)
    })

    it("does NOT call revalidatePath during the action (revalidation is in the executor)", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const reception = await createReception({ createdById: admin.id })

      await cancelReception(reception.id)

      // revalidatePath is NOT called in the action — only in the executor after admin approval
      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled()
    })

    it("returns success:false when reception is already CANCELLED", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      // Create already-cancelled reception
      const reception = await createReception({
        createdById: admin.id,
        status: "CANCELLED",
      })

      const result = await cancelReception(reception.id)

      expect(result.success).toBe(false)
      expect(result.error).toContain("cancelada")
    })

    it("returns success:false when reception does not exist", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const result = await cancelReception("non-existent-id")

      expect(result.success).toBe(false)
    })

    it("returns success:false when unauthenticated", async () => {
      logout()
      const reception = await createReception()

      const result = await cancelReception(reception.id)

      expect(result.success).toBe(false)
    })
  })

  // ─── deleteReception (approval gate) ─────────────────────────────────────────
  //
  // deleteReception now routes through the async approvals system:
  // - The action creates an ApprovalRequest (PENDING) and returns { success, approvalRequired, requestId }.
  // - The actual hard-delete is performed by deleteReceptionExecutor once the admin approves.
  // - The reception row is NOT deleted during the action call.

  describe("deleteReception", () => {
    it("creates a PENDING ApprovalRequest and leaves the reception row intact", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const reception = await createReception({ createdById: admin.id })

      const result = await deleteReception(reception.id, "Test deletion reason")

      // Action creates an approval request — does NOT hard-delete immediately
      expect(result.success).toBe(true)
      if (!result.success) throw new Error("unreachable")
      expect(result.approvalRequired).toBe(true)
      expect(result.requestId).toBeTruthy()

      // Reception row still exists
      const row = await prisma.agencyTransfer.findUnique({ where: { id: reception.id } })
      expect(row).not.toBeNull()

      // ApprovalRequest row exists with PENDING status
      const request = await prisma.approvalRequest.findUnique({
        where: { id: result.requestId },
      })
      expect(request).not.toBeNull()
      expect(request?.status).toBe("PENDING")
      expect(request?.action).toBe("DELETE_RECEPTION")
      expect(request?.targetId).toBe(reception.id)
    })

    it("returns success:false when the reception does not exist", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const result = await deleteReception("non-existent-id", "reason")

      expect(result.success).toBe(false)
    })

    it("returns success:false when unauthenticated", async () => {
      logout()
      const reception = await createReception()

      const result = await deleteReception(reception.id, "reason")

      expect(result.success).toBe(false)
    })
  })

  // ─── updateReception (guard tests) ────────────────────────────────────────

  describe("updateReception", () => {
    it("returns success:false when reception is CANCELLED (cannot edit cancelled)", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const reception = await createReception({
        createdById: admin.id,
        status: "CANCELLED",
      })

      // updateReception requires full ReceptionFormData — use minimal shape to hit the guard
      const minimalData = {
        agencyId: reception.agencyId,
        paymentStatus: "PENDING" as const,
        comments: undefined,
        passengers: [],
        eventDetails: [],
        date: new Date(),
        payments: [],
      }

      const result = await updateReception(reception.id, minimalData)

      expect(result.success).toBe(false)
      expect(result.error).toContain("cancelada")
    })

    it("returns success:false when reception does not exist", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const minimalData = {
        agencyId: "non-existent-agency",
        paymentStatus: "PENDING" as const,
        comments: undefined,
        passengers: [],
        eventDetails: [],
        date: new Date(),
        payments: [],
      }

      const result = await updateReception("non-existent-id", minimalData)

      expect(result.success).toBe(false)
      expect(result.error).toContain("encontrada")
    })

    it("returns success:false when unauthenticated", async () => {
      logout()

      const minimalData = {
        agencyId: "any-agency-id",
        paymentStatus: "PENDING" as const,
        comments: undefined,
        passengers: [],
        eventDetails: [],
        date: new Date(),
        payments: [],
      }

      const result = await updateReception("any-id", minimalData)

      expect(result.success).toBe(false)
    })
  })

  // ─── cancelReceptionExecutor (happy-path end-to-end) ─────────────────────
  //
  // Proves the cancellation path works when an approval is executed.

  describe("cancelReceptionExecutor", () => {
    it("sets status to CANCELLED on the reception and writes an AuditLog", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })

      const reception = await createReception({ createdById: admin.id })

      const approval = await createApproval({
        requestedById: admin.id,
        action: "CANCEL_RECEPTION",
        domain: "receptions",
        targetType: "agency-transfer",
        targetId: reception.id,
        targetFingerprint: reception.updatedAt.toISOString(),
        status: "APPROVED",
      })

      const result = await prisma.$transaction((tx) =>
        cancelReceptionExecutor({
          request: approval,
          payload: { reason: "Executor integration test" },
          requestedById: admin.id,
          resolvedById: admin.id,
          targetId: reception.id,
          tx,
        }),
      )

      expect(result.ok).toBe(true)

      const updated = await prisma.agencyTransfer.findUnique({ where: { id: reception.id } })
      expect(updated?.status).toBe("CANCELLED")
      expect(updated?.cancelledById).toBe(admin.id)

      const auditLog = await prisma.auditLog.findFirst({
        where: { entityType: "AgencyTransfer", entityId: reception.id, action: "UPDATE" },
      })
      expect(auditLog).not.toBeNull()
    })
  })

  // ─── deleteReceptionExecutor (happy-path end-to-end) ─────────────────────
  //
  // Proves the hard-delete path works when an approval is executed.

  describe("deleteReceptionExecutor", () => {
    it("hard-deletes the AgencyTransfer row when called with a valid ApprovalRequest context", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })

      const reception = await createReception({ createdById: admin.id })

      const approval = await createApproval({
        requestedById: admin.id,
        action: "DELETE_RECEPTION",
        domain: "receptions",
        targetType: "agency-transfer",
        targetId: reception.id,
        targetFingerprint: reception.updatedAt.toISOString(),
        status: "APPROVED",
      })

      const result = await prisma.$transaction((tx) =>
        deleteReceptionExecutor({
          request: approval,
          payload: { reason: "Executor integration test" },
          requestedById: admin.id,
          resolvedById: admin.id,
          targetId: reception.id,
          tx,
        }),
      )

      expect(result.ok).toBe(true)

      // Row should be gone
      const row = await prisma.agencyTransfer.findUnique({ where: { id: reception.id } })
      expect(row).toBeNull()
    })
  })
})
