/**
 * T-C11 — Agency integration tests
 * Production code: src/project/agency/actions/create-agency.ts
 *                  src/project/agency/actions/update-agency.ts
 *                  src/project/agency/actions/delete-agency.ts
 *                  src/project/agency/actions/toggle-agency-status.ts
 *
 * Key observations about the production code:
 * - Agency is a WHOLESALE agency (not TransferAgency which is for receptions/transfers).
 * - createAgency: validates via agencySchema (requires name + contactEmails[].email min 1).
 *   Throws on auth failure or permission failure. No audit, no revalidatePath.
 * - updateAgency: throws if not found; throws on auth/permission failure.
 *   replaces tourPricing (deleteMany + create). No audit, no revalidatePath.
 * - deleteAgency: SOFT DELETE — sets active:false. Throws on auth/permission.
 *   No audit, no hard delete.
 * - toggleAgencyStatus: flips active field. Throws on auth/permission.
 * - Permission path: "/dashboard/gestion-de-agencias" — admin passes canCurrentUserInteractPath.
 * - No AuditLog writes in any agency action.
 * - No revalidatePath calls in any agency action.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { createAgency as createAgencyAction } from "@/project/agency/actions/create-agency"
import { updateAgency } from "@/project/agency/actions/update-agency"
import { deleteAgency } from "@/project/agency/actions/delete-agency"
import { toggleAgencyStatus } from "@/project/agency/actions/toggle-agency-status"
import { deleteAgencyExecutor } from "@/project/agency/executors/delete-agency.executor"
import { loginAs, logout } from "../../helpers/auth"
import { truncateAll, disconnect } from "../../helpers/db"
import { createUser, createAgency, createApproval } from "../../helpers/factories"

/** Minimal valid payload for createAgency / updateAgency. */
function validAgencyPayload(name: string) {
  return {
    name,
    contactEmails: [{ email: "agency@test.com" }],
    phone: null,
    country: null,
    address: null,
    website: null,
    taxId: null,
    codePrefix: null,
    codeLength: null,
    active: true,
    tourPricing: [],
  }
}

describe("agency.actions integration", () => {
  beforeEach(async () => {
    await truncateAll()
    vi.mocked(revalidatePath).mockClear()
  })

  afterAll(async () => {
    await disconnect()
  })

  // ─── createAgency ─────────────────────────────────────────────────────────────

  describe("createAgency", () => {
    it("admin can create an agency with valid data", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const result = await createAgencyAction(validAgencyPayload("Test Agency"))

      expect(result).toBeDefined()
      expect(result.name).toBe("Test Agency")
      expect(result.active).toBe(true)

      // Verify DB row was created
      const row = await prisma.agency.findUnique({ where: { id: result.id } })
      expect(row).not.toBeNull()
      expect(row?.name).toBe("Test Agency")
    })

    it("throws when name is too short (Zod validation fails)", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      await expect(
        createAgencyAction({
          ...validAgencyPayload("X"), // min 2 chars
        }),
      ).rejects.toThrow()
    })

    it("throws when unauthenticated", async () => {
      logout()

      await expect(createAgencyAction(validAgencyPayload("Any Agency"))).rejects.toThrow(
        "No autorizado",
      )
    })

    it("does NOT write AuditLog (agency actions have no audit integration)", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      await createAgencyAction(validAgencyPayload("Audit Test Agency"))

      const auditCount = await prisma.auditLog.count({ where: { entityType: "Agency" } })
      expect(auditCount).toBe(0)
    })

    it("does NOT call revalidatePath (agency actions have no path revalidation)", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      await createAgencyAction(validAgencyPayload("RevalidatePath Test"))

      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled()
    })
  })

  // ─── updateAgency ─────────────────────────────────────────────────────────────

  describe("updateAgency", () => {
    it("admin can update an existing agency's name and contact emails", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const agency = await createAgency({ name: "Original Name" })

      const updated = await updateAgency({
        id: agency.id,
        name: "Updated Name",
        contactEmails: [{ email: "updated@test.com" }],
        tourPricing: [],
      })

      expect(updated.name).toBe("Updated Name")
      expect(updated.contactEmails).toContain("updated@test.com")

      const row = await prisma.agency.findUnique({ where: { id: agency.id } })
      expect(row?.name).toBe("Updated Name")
    })

    it("throws when the agency does not exist", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      await expect(
        updateAgency({
          id: "non-existent-id",
          name: "Updated",
          contactEmails: [{ email: "x@test.com" }],
          tourPricing: [],
        }),
      ).rejects.toThrow()
    })

    it("throws when unauthenticated", async () => {
      logout()

      await expect(
        updateAgency({
          id: "any-id",
          name: "Updated",
          contactEmails: [{ email: "x@test.com" }],
          tourPricing: [],
        }),
      ).rejects.toThrow("No autorizado")
    })
  })

  // ─── deleteAgency (approval gate) ────────────────────────────────────────────
  //
  // deleteAgency now routes through the async approvals system:
  // - The action creates an ApprovalRequest (PENDING) and returns { success, approvalRequired, requestId }.
  // - The actual soft-delete (active: false) is performed by deleteAgencyExecutor once the
  //   approval is resolved by an admin. The agency row is NOT mutated during the action call.

  describe("deleteAgency", () => {
    it("creates a PENDING ApprovalRequest and leaves the agency active (approval pending)", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const agency = await createAgency({ active: true })

      const result = await deleteAgency(agency.id, "Test deletion reason")

      // Action creates an approval request — does NOT delete immediately
      expect(result.success).toBe(true)
      if (!result.success) throw new Error("unreachable")
      expect(result.approvalRequired).toBe(true)
      expect(result.requestId).toBeTruthy()

      // Agency is still active — the executor hasn't run yet
      const row = await prisma.agency.findUnique({ where: { id: agency.id } })
      expect(row).not.toBeNull()
      expect(row?.active).toBe(true)

      // An ApprovalRequest row must exist with PENDING status
      const request = await prisma.approvalRequest.findUnique({
        where: { id: result.requestId },
      })
      expect(request).not.toBeNull()
      expect(request?.status).toBe("PENDING")
      expect(request?.action).toBe("DELETE_AGENCY")
      expect(request?.targetId).toBe(agency.id)
    })

    it("returns success:false when unauthenticated", async () => {
      logout()
      const agency = await createAgency()

      const result = await deleteAgency(agency.id, "reason")

      expect(result.success).toBe(false)
    })
  })

  // ─── toggleAgencyStatus ───────────────────────────────────────────────────────

  describe("toggleAgencyStatus", () => {
    it("flips active from true to false", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const agency = await createAgency({ active: true })

      const result = await toggleAgencyStatus(agency.id)

      expect(result.active).toBe(false)

      const row = await prisma.agency.findUnique({ where: { id: agency.id } })
      expect(row?.active).toBe(false)
    })

    it("flips active from false to true", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const agency = await createAgency({ active: false })

      const result = await toggleAgencyStatus(agency.id)

      expect(result.active).toBe(true)
    })

    it("throws when agency does not exist", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      await expect(toggleAgencyStatus("non-existent-id")).rejects.toThrow()
    })

    it("throws when unauthenticated", async () => {
      logout()
      const agency = await createAgency()

      await expect(toggleAgencyStatus(agency.id)).rejects.toThrow("No autorizado")
    })
  })

  // ─── deleteAgencyExecutor (happy-path end-to-end) ─────────────────────────
  //
  // Proves the deletion path works when an approval is approved.
  // The executor runs inside a transaction and sets active: false on the agency.

  describe("deleteAgencyExecutor", () => {
    it("sets active:false on the agency when called with a valid ApprovalRequest context", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })

      const agency = await createAgency({ active: true })

      // Build a minimal ApprovalRequest that matches the agency fingerprint
      const approval = await createApproval({
        requestedById: admin.id,
        action: "DELETE_AGENCY",
        domain: "agencies",
        targetType: "agency",
        targetId: agency.id,
        targetFingerprint: agency.updatedAt.toISOString(),
        status: "APPROVED",
      })

      const result = await prisma.$transaction((tx) =>
        deleteAgencyExecutor({
          request: approval,
          payload: { reason: "Executor integration test" },
          requestedById: admin.id,
          resolvedById: admin.id,
          targetId: agency.id,
          tx,
        }),
      )

      expect(result.ok).toBe(true)

      // Agency row should now be inactive
      const row = await prisma.agency.findUnique({ where: { id: agency.id } })
      expect(row).not.toBeNull()
      expect(row?.active).toBe(false)
    })
  })
})
