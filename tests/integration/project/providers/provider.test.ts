/**
 * T-C12 — Providers integration tests
 * Production code: src/project/providers/actions/provider.actions.ts
 *
 * Key observations about the production code:
 * - createProvider: validates via providerSchema. Returns {success, data}. No audit, no revalidatePath.
 * - updateProvider: validates via providerSchema. Returns {success, data}. No audit, no revalidatePath.
 * - deleteProvider: HARD DELETE via prisma.provider.delete. Returns {success}.
 *   FK behavior: migration 20251203215545 set Event→Provider FKs to ON DELETE SET NULL.
 *   Deleting a provider that is assigned as guide/driver/vehicle NULLs Event.guideId etc.
 *   deleteProvider always returns {success: true} for existing providers (no guard).
 * - toggleProviderStatus: flips isActive. Returns {success, data}.
 * - Permission path: "/control-de-proveedores" — admin passes canCurrentUserInteractPath.
 * - No AuditLog writes in any provider action.
 * - No revalidatePath calls in any provider action.
 * - ProviderCatering is deleted on cascade (FK onDelete: Cascade in schema).
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import {
  createProvider as createProviderAction,
  updateProvider,
  deleteProvider,
  toggleProviderStatus,
} from "@/project/providers/actions/provider.actions"
import { deleteProviderExecutor } from "@/project/providers/executors/delete-provider.executor"
import { loginAs, logout } from "../../helpers/auth"
import { truncateAll, disconnect } from "../../helpers/db"
import { createUser, createProvider, createEvent, createApproval } from "../../helpers/factories"

let rutCounter = 0
/** Minimal valid ProviderFormData for createProvider / updateProvider.
 * NATURAL type requires: fullName, address, phone, birthDate.
 * RUT must match /^\d{1,2}\.\d{3}\.\d{3}-[0-9kK]$/ (dots notation).
 */
function validProviderPayload(overrides?: { rut?: string }) {
  rutCounter++
  return {
    type: "NATURAL" as const,
    rut: overrides?.rut ?? `12.345.${String(600 + rutCounter).padStart(3, "0")}-9`,
    isActive: true,
    fullName: "Test Provider",
    address: "Test Address 123",
    phone: "+56912345678",
    birthDate: new Date("1990-05-15"),
    services: {
      conductor: false,
      maquina: false,
      transferOut: false,
      cocteleria: false,
      conductorMaquina: false,
      transferIn: false,
      guia: true,
      otros: false,
    },
  }
}

describe("provider.actions integration", () => {
  beforeEach(async () => {
    await truncateAll()
    vi.mocked(revalidatePath).mockClear()
  })

  afterAll(async () => {
    await disconnect()
  })

  // ─── createProvider ───────────────────────────────────────────────────────────

  describe("createProvider", () => {
    it("admin can create a provider and DB row is persisted", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const payload = validProviderPayload()
      const result = await createProviderAction(payload)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data!.rut).toBe(payload.rut)
      expect(result.data!.isActive).toBe(true)

      // Verify DB row
      const row = await prisma.provider.findUnique({ where: { id: result.data!.id } })
      expect(row).not.toBeNull()
      expect(row?.fullName).toBe("Test Provider")
    })

    it("returns success:false when RUT is missing (Zod validation fails)", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const result = await createProviderAction({
        ...validProviderPayload(),
        rut: "", // invalid: required
      })

      expect(result.success).toBe(false)
    })

    it("returns success:false when unauthenticated", async () => {
      logout()

      const result = await createProviderAction(validProviderPayload())

      expect(result.success).toBe(false)
    })

    it("does NOT write AuditLog (provider actions have no audit integration)", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      await createProviderAction(validProviderPayload({ rut: "11111111-1" }))

      const auditCount = await prisma.auditLog.count({ where: { entityType: "Provider" } })
      expect(auditCount).toBe(0)
    })

    it("does NOT call revalidatePath (provider actions have no path revalidation)", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      await createProviderAction(validProviderPayload({ rut: "22222222-2" }))

      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled()
    })
  })

  // ─── updateProvider ───────────────────────────────────────────────────────────

  describe("updateProvider", () => {
    it("admin can update a provider's fullName and isActive", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      // Create provider via action (so RUT is in correct format for subsequent update)
      const createPayload = validProviderPayload()
      const created = await createProviderAction(createPayload)
      expect(created.success).toBe(true)

      const updatePayload = { ...createPayload, fullName: "Updated Provider Name", isActive: false }
      const result = await updateProvider(created.data!.id, updatePayload)

      expect(result.success).toBe(true)
      expect(result.data!.fullName).toBe("Updated Provider Name")
      expect(result.data!.isActive).toBe(false)

      const row = await prisma.provider.findUnique({ where: { id: created.data!.id } })
      expect(row?.fullName).toBe("Updated Provider Name")
      expect(row?.isActive).toBe(false)
    })

    it("returns success:false when unauthenticated", async () => {
      logout()
      const provider = await createProvider()

      const result = await updateProvider(provider.id, validProviderPayload())

      expect(result.success).toBe(false)
    })
  })

  // ─── deleteProvider (approval gate) ──────────────────────────────────────────
  //
  // deleteProvider now routes through the async approvals system:
  // - The action creates an ApprovalRequest (PENDING) and returns { success, approvalRequired, requestId }.
  // - The actual hard-delete is performed by deleteProviderExecutor once the admin approves.
  // - The provider row is NOT deleted during the action call.

  describe("deleteProvider", () => {
    it("creates a PENDING ApprovalRequest and leaves the provider row intact", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const provider = await createProvider()

      const result = await deleteProvider(provider.id, "Test deletion reason")

      // Action creates an approval request — does NOT hard-delete immediately
      expect(result.success).toBe(true)
      if (!result.success) throw new Error("unreachable")
      expect(result.approvalRequired).toBe(true)
      expect(result.requestId).toBeTruthy()

      // Provider row still exists
      const row = await prisma.provider.findUnique({ where: { id: provider.id } })
      expect(row).not.toBeNull()

      // ApprovalRequest row exists with PENDING status
      const request = await prisma.approvalRequest.findUnique({
        where: { id: result.requestId },
      })
      expect(request).not.toBeNull()
      expect(request?.status).toBe("PENDING")
      expect(request?.action).toBe("DELETE_PROVIDER")
      expect(request?.targetId).toBe(provider.id)
    })

    it("creates a PENDING ApprovalRequest even when provider is assigned as guide to an Event", async () => {
      // The approval system defers the delete — no FK concern until the executor runs.
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const provider = await createProvider()
      const event = await createEvent({ guideId: provider.id })

      const result = await deleteProvider(provider.id, "Assigned guide removal")

      // Request created successfully — executor will handle FK nullification when approved
      expect(result.success).toBe(true)
      if (!result.success) throw new Error("unreachable")
      expect(result.approvalRequired).toBe(true)

      // Provider still exists (not yet deleted)
      const row = await prisma.provider.findUnique({ where: { id: provider.id } })
      expect(row).not.toBeNull()

      // Event is unchanged
      const unchanged = await prisma.event.findUnique({ where: { id: event.id } })
      expect(unchanged?.guideId).toBe(provider.id)
    })

    it("returns success:false when unauthenticated", async () => {
      logout()
      const provider = await createProvider()

      const result = await deleteProvider(provider.id, "reason")

      expect(result.success).toBe(false)
    })
  })

  // ─── toggleProviderStatus ─────────────────────────────────────────────────────

  describe("toggleProviderStatus", () => {
    it("sets isActive to false for an active provider", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const provider = await createProvider({ isActive: true })

      const result = await toggleProviderStatus(provider.id, false)

      expect(result.success).toBe(true)
      expect(result.data!.isActive).toBe(false)

      const row = await prisma.provider.findUnique({ where: { id: provider.id } })
      expect(row?.isActive).toBe(false)
    })

    it("sets isActive to true for an inactive provider", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const provider = await createProvider({ isActive: false })

      const result = await toggleProviderStatus(provider.id, true)

      expect(result.success).toBe(true)
      expect(result.data!.isActive).toBe(true)
    })

    it("returns success:false when unauthenticated", async () => {
      logout()
      const provider = await createProvider()

      const result = await toggleProviderStatus(provider.id, false)

      expect(result.success).toBe(false)
    })
  })

  // ─── deleteProviderExecutor (happy-path end-to-end) ──────────────────────
  //
  // Proves the hard-delete path works when an approval is executed.

  describe("deleteProviderExecutor", () => {
    it("hard-deletes the provider row when called with a valid ApprovalRequest context", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })

      const provider = await createProvider({ isActive: true })

      const approval = await createApproval({
        requestedById: admin.id,
        action: "DELETE_PROVIDER",
        domain: "providers",
        targetType: "provider",
        targetId: provider.id,
        targetFingerprint: provider.updatedAt.toISOString(),
        status: "APPROVED",
      })

      const result = await prisma.$transaction((tx) =>
        deleteProviderExecutor({
          request: approval,
          payload: { reason: "Executor integration test" },
          requestedById: admin.id,
          resolvedById: admin.id,
          targetId: provider.id,
          tx,
        }),
      )

      expect(result.ok).toBe(true)

      // Provider row should be gone
      const row = await prisma.provider.findUnique({ where: { id: provider.id } })
      expect(row).toBeNull()
    })
  })
})
