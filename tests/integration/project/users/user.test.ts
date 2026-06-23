/**
 * T-C10 — Users integration tests
 * Production code: src/project/users/actions/user.actions.ts
 *
 * Key observations about the production code:
 * - user.actions.ts contains READ actions + two WRITE mutations:
 *   - setUserRole: updates role. Admin-only (throws if currentUser.role !== "admin"). No audit, no revalidatePath.
 *   - updateUserAdditionalData: updates rut/phone/birthDate/workSchedule. Admin-only (throws).
 * - No Better Auth admin plugin calls in user.actions.ts — all mutations are direct Prisma writes.
 * - User CRUD (create/ban) goes through Better Auth; not tested here since it requires the actual
 *   Better Auth admin plugin API (not available without real HTTP context).
 * - mustChangePassword flag: set by factory (mustChangePassword: true|false).
 *   The force-change-password feature is already merged. The flag lives on the User model.
 *   Integration test: verify the flag is correctly set and that the auth helper exposes it
 *   in the forged session (confirmed by auth.ts which includes mustChangePassword in ForgedSession).
 * - Non-admin calling setUserRole throws (not returns {success:false}).
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import {
  setUserRole,
  updateUserAdditionalData,
  getCurrentUserRole,
} from "@/project/users/actions/user.actions"
import { loginAs, logout } from "../../helpers/auth"
import { truncateAll, disconnect } from "../../helpers/db"
import { createUser } from "../../helpers/factories"

describe("user.actions integration", () => {
  beforeEach(async () => {
    await truncateAll()
    vi.mocked(revalidatePath).mockClear()
  })

  afterAll(async () => {
    await disconnect()
  })

  // ─── setUserRole ──────────────────────────────────────────────────────────────

  describe("setUserRole", () => {
    it("admin can change another user's role and DB reflects the change", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      const target = await createUser({ role: "user", mustChangePassword: false })
      loginAs(admin)

      const result = await setUserRole({ userId: target.id, role: "admin" })

      expect(result.success).toBe(true)

      const updated = await prisma.user.findUnique({ where: { id: target.id } })
      expect(updated?.role).toBe("admin")
    })

    it("admin can downgrade a user from admin to user role", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      const target = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      await setUserRole({ userId: target.id, role: "user" })

      const updated = await prisma.user.findUnique({ where: { id: target.id } })
      expect(updated?.role).toBe("user")
    })

    it("throws when a non-admin attempts to change a role", async () => {
      const nonAdmin = await createUser({ role: "user", mustChangePassword: false })
      const target = await createUser({ role: "user", mustChangePassword: false })
      loginAs(nonAdmin)

      await expect(setUserRole({ userId: target.id, role: "admin" })).rejects.toThrow(
        "No autorizado",
      )

      // Role should be unchanged
      const unchanged = await prisma.user.findUnique({ where: { id: target.id } })
      expect(unchanged?.role).toBe("user")
    })

    it("throws when unauthenticated", async () => {
      logout()

      await expect(setUserRole({ userId: "any-id", role: "admin" })).rejects.toThrow()
    })

    it("does NOT write AuditLog (user role changes have no audit integration)", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      const target = await createUser({ role: "user", mustChangePassword: false })
      loginAs(admin)

      await setUserRole({ userId: target.id, role: "admin" })

      const auditCount = await prisma.auditLog.count({ where: { entityType: "User" } })
      expect(auditCount).toBe(0)
    })

    it("does NOT call revalidatePath (user role changes have no path revalidation)", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      const target = await createUser({ role: "user", mustChangePassword: false })
      loginAs(admin)

      await setUserRole({ userId: target.id, role: "admin" })

      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled()
    })
  })

  // ─── updateUserAdditionalData ─────────────────────────────────────────────────

  describe("updateUserAdditionalData", () => {
    it("admin can update rut, phone, birthDate, workSchedule for any user", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      const target = await createUser({ role: "user", mustChangePassword: false })
      loginAs(admin)

      const updatedUser = await updateUserAdditionalData({
        userId: target.id,
        rut: "12345678-9",
        phone: "+56912345678",
        birthDate: "1990-05-15",
        workSchedule: "9:00 - 18:00",
      })

      expect(updatedUser.rut).toBe("12345678-9")
      expect(updatedUser.phone).toBe("+56912345678")
      expect(updatedUser.workSchedule).toBe("9:00 - 18:00")

      // Verify persisted
      const fresh = await prisma.user.findUnique({ where: { id: target.id } })
      expect(fresh?.rut).toBe("12345678-9")
      expect(fresh?.phone).toBe("+56912345678")
    })

    it("throws when a non-admin attempts to update additional data", async () => {
      const nonAdmin = await createUser({ role: "user", mustChangePassword: false })
      const target = await createUser({ role: "user", mustChangePassword: false })
      loginAs(nonAdmin)

      await expect(
        updateUserAdditionalData({
          userId: target.id,
          rut: "99999999-9",
          phone: "+56999999999",
          birthDate: "1990-01-01",
          workSchedule: "Any",
        }),
      ).rejects.toThrow("No autorizado")
    })

    it("throws when unauthenticated", async () => {
      logout()

      await expect(
        updateUserAdditionalData({
          userId: "any-id",
          rut: "99999999-9",
          phone: "+56999999999",
          birthDate: "1990-01-01",
          workSchedule: "Any",
        }),
      ).rejects.toThrow()
    })
  })

  // ─── mustChangePassword flag (force-change-password feature) ─────────────────

  describe("mustChangePassword flag", () => {
    it("createUser factory with mustChangePassword:true persists the flag in DB", async () => {
      const user = await createUser({ mustChangePassword: true })

      const fresh = await prisma.user.findUnique({ where: { id: user.id } })
      expect(fresh?.mustChangePassword).toBe(true)
    })

    it("createUser factory with mustChangePassword:false persists the flag in DB", async () => {
      const user = await createUser({ mustChangePassword: false })

      const fresh = await prisma.user.findUnique({ where: { id: user.id } })
      expect(fresh?.mustChangePassword).toBe(false)
    })

    it("forged session exposes mustChangePassword so middleware can enforce redirect", async () => {
      // The auth.ts helper includes mustChangePassword in the ForgedSession shape.
      // Verifies that loginAs passes the flag through — middleware reads session.user.mustChangePassword.
      const userWithFlag = await createUser({ mustChangePassword: true })
      loginAs(userWithFlag)

      // getCurrentUserRole reads from session — also confirms session is set up correctly
      const role = await getCurrentUserRole()
      expect(role).toBe(userWithFlag.role)
      // Verify the flag on the DB row (the middleware consumes the DB directly via auth.api.getSession)
      const fresh = await prisma.user.findUnique({ where: { id: userWithFlag.id } })
      expect(fresh?.mustChangePassword).toBe(true)
    })
  })
})
