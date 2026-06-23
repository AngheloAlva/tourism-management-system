/**
 * T-C4 — Approvals integration tests
 * Production code: src/project/approvals/actions/approval.actions.ts
 * Actions covered: requestActionApproval, verifyActionApprovalCode
 *
 * Key observations about the production code:
 * - requestActionApproval: creates ApprovalRequest row (PENDING), tries to send email
 *   (no-op when RESEND_API_KEY is empty). Returns { success, requestId, expiresAt }.
 *   Requires at least one admin user for the email recipient lookup — but the email
 *   is silently skipped if canSendEmails() returns false (which it does in tests
 *   because RESEND_API_KEY="").
 * - verifyActionApprovalCode: validates code hash, transitions PENDING → APPROVED.
 *   Returns { success, request } or { success: false, error }.
 * - Illegal transition: once APPROVED (or EXPIRED), calling verify again returns
 *   { success: false, error: "La solicitud ya no está pendiente" }.
 * - No revalidatePath calls in this module.
 * - AuditLog IS written in verifyActionApprovalCode via the approval UPDATE.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import { createHash } from "node:crypto"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import {
  requestActionApproval,
  verifyActionApprovalCode,
} from "@/project/approvals/actions/approval.actions"
import { loginAs, logout } from "../../helpers/auth"
import { truncateAll, disconnect } from "../../helpers/db"
import { createUser, createApproval } from "../../helpers/factories"

/** Hash a 6-digit code the same way the production code does. */
function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex")
}

describe("approval.actions integration", () => {
  beforeEach(async () => {
    await truncateAll()
    vi.mocked(revalidatePath).mockClear()
  })

  afterAll(async () => {
    await disconnect()
  })

  // ─── requestActionApproval ────────────────────────────────────────────────

  describe("requestActionApproval", () => {
    it("creates a PENDING ApprovalRequest and returns requestId when user is authenticated", async () => {
      // Need an admin user so email lookup finds at least one recipient
      // (even though email is no-op with empty RESEND_API_KEY)
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      const requester = await createUser({ mustChangePassword: false })
      loginAs(requester)

      const result = await requestActionApproval({
        action: "CANCEL_EVENT",
        targetType: "Event",
        targetId: "test-event-id",
        reason: "Test cancellation",
      })

      expect(result.success).toBe(true)
      expect(result.requestId).toBeTruthy()

      const request = await prisma.approvalRequest.findUnique({
        where: { id: result.requestId },
      })
      expect(request).not.toBeNull()
      expect(request?.status).toBe("PENDING")
      expect(request?.action).toBe("CANCEL_EVENT")
      expect(request?.requestedById).toBe(requester.id)

      // Suppress unused variable warning
      void admin
    })

    it("expires previous PENDING request for same target before creating a new one", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      const requester = await createUser({ mustChangePassword: false })
      loginAs(requester)

      // First request
      const first = await requestActionApproval({
        action: "CANCEL_EVENT",
        targetType: "Event",
        targetId: "same-target-id",
      })

      // Second request for same target
      const second = await requestActionApproval({
        action: "CANCEL_EVENT",
        targetType: "Event",
        targetId: "same-target-id",
      })

      expect(second.success).toBe(true)

      // First request should now be EXPIRED
      const firstRequest = await prisma.approvalRequest.findUnique({
        where: { id: first.requestId },
      })
      expect(firstRequest?.status).toBe("EXPIRED")

      // Suppress unused variable warning
      void admin
    })

    it("throws when unauthenticated", async () => {
      logout()

      await expect(
        requestActionApproval({
          action: "CANCEL_EVENT",
          targetType: "Event",
          targetId: "test-id",
        }),
      ).rejects.toThrow("No autenticado")
    })
  })

  // ─── verifyActionApprovalCode ─────────────────────────────────────────────

  describe("verifyActionApprovalCode", () => {
    it("transitions PENDING → APPROVED when code hash matches", async () => {
      const requester = await createUser({ mustChangePassword: false })
      loginAs(requester)

      // Create approval with a known code hash
      const testCode = "123456"
      const approval = await createApproval({
        requestedById: requester.id,
        codeHash: hashCode(testCode),
        codeLast4: testCode.slice(-4),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      })

      const result = await verifyActionApprovalCode({
        requestId: approval.id,
        code: testCode,
        action: approval.action as "CANCEL_EVENT",
        targetType: approval.targetType,
        targetId: approval.targetId,
      })

      expect(result.success).toBe(true)

      const updated = await prisma.approvalRequest.findUnique({ where: { id: approval.id } })
      expect(updated?.status).toBe("APPROVED")
      expect(updated?.usedAt).not.toBeNull()
    })

    it("returns error when code is wrong (hash mismatch)", async () => {
      const requester = await createUser({ mustChangePassword: false })
      loginAs(requester)

      const approval = await createApproval({
        requestedById: requester.id,
        codeHash: hashCode("111111"),
        codeLast4: "1111",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      })

      const result = await verifyActionApprovalCode({
        requestId: approval.id,
        code: "999999", // wrong code
        action: approval.action as "CANCEL_EVENT",
        targetType: approval.targetType,
        targetId: approval.targetId,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("inválido")
    })

    it("returns error when request is already APPROVED (illegal state transition)", async () => {
      const requester = await createUser({ mustChangePassword: false })
      loginAs(requester)

      // Create an already-APPROVED approval
      const approval = await createApproval({
        requestedById: requester.id,
        status: "APPROVED",
        codeHash: hashCode("123456"),
        codeLast4: "3456",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      })

      const result = await verifyActionApprovalCode({
        requestId: approval.id,
        code: "123456",
        action: approval.action as "CANCEL_EVENT",
        targetType: approval.targetType,
        targetId: approval.targetId,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("pendiente")
    })

    it("returns error when code is expired", async () => {
      const requester = await createUser({ mustChangePassword: false })
      loginAs(requester)

      const approval = await createApproval({
        requestedById: requester.id,
        codeHash: hashCode("123456"),
        codeLast4: "3456",
        expiresAt: new Date(Date.now() - 1000), // expired 1s ago
      })

      const result = await verifyActionApprovalCode({
        requestId: approval.id,
        code: "123456",
        action: approval.action as "CANCEL_EVENT",
        targetType: approval.targetType,
        targetId: approval.targetId,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("expiró")
    })

    it("throws when unauthenticated (no session)", async () => {
      logout()
      const approval = await createApproval()

      // verifyActionApprovalCode calls getAuthUser() which throws (not returns {success:false})
      await expect(
        verifyActionApprovalCode({
          requestId: approval.id,
          code: "123456",
          action: approval.action as "CANCEL_EVENT",
          targetType: approval.targetType,
          targetId: approval.targetId,
        }),
      ).rejects.toThrow("No autenticado")
    })
  })
})
