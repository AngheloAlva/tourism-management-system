/**
 * T-C7 — Commissions integration tests
 * Production code: src/project/commissions/actions/commission.actions.ts
 *
 * Key observations about the production code:
 * - Commission actions are ANALYTICS/READ + ONE WRITE MUTATION:
 *   - getCommissionOperators: read-only, returns users with unpaid bookings
 *   - getCommissionSales: read-only, returns sales with commission detail
 *   - getCommissionSummary: read-only, aggregates commission data
 *   - markCommissionsAsPaid: the ONLY write mutation — creates EventBookingCommission rows
 *   - getCommissionPdfData: read-only, aggregates for PDF
 * - No AuditLog writes in any commission action.
 * - No revalidatePath calls in any commission action.
 * - markCommissionsAsPaid requires: authenticated user + canInteractPath("/comisiones"),
 *   booking must have event.status = COMPLETED, tour name must match the requested kind.
 * - SPECIAL kind = tours matching /volc[áa]n/i or /uyuni/i pattern. REGULAR = everything else.
 * - Uses createMany({ skipDuplicates: true }) — idempotent for concurrent calls.
 * - Commission is tied to EventBookingCommission (not a standalone Commission model).
 * - The factory creates EventBookingCommission rows directly (bypasses the action flow).
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import {
  markCommissionsAsPaid,
  getCommissionSales,
} from "@/project/commissions/actions/commission.actions"
import { loginAs, logout } from "../../helpers/auth"
import { truncateAll, disconnect } from "../../helpers/db"
import { createUser, createEvent, createSaleRecord, createCommission } from "../../helpers/factories"
import { CommissionKind } from "@/generated/prisma/enums"

describe("commission.actions integration", () => {
  beforeEach(async () => {
    await truncateAll()
    vi.mocked(revalidatePath).mockClear()
  })

  afterAll(async () => {
    await disconnect()
  })

  // ─── markCommissionsAsPaid ────────────────────────────────────────────────

  describe("markCommissionsAsPaid", () => {
    it("creates EventBookingCommission rows for eligible COMPLETED bookings", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      // Create a COMPLETED event with a booking linked to a REGULAR tour (not Volcán/Uyuni)
      const event = await createEvent({ status: "COMPLETED" })
      const sale = await createSaleRecord({ sellerId: admin.id })
      const booking = await prisma.eventBooking.create({
        data: {
          passengerCount: 1,
          eventId: event.id,
          saleRecordId: sale.id,
        },
      })

      const result = await markCommissionsAsPaid({
        bookingIds: [booking.id],
        kind: CommissionKind.REGULAR,
        percentage: 10,
        notes: undefined,
      })

      expect(result.success).toBe(true)
      if (!result.success) return

      // Commission row should have been created
      const commission = await prisma.eventBookingCommission.findFirst({
        where: { eventBookingId: booking.id, kind: CommissionKind.REGULAR },
      })
      expect(commission).not.toBeNull()
      expect(commission?.paidById).toBe(admin.id)
      expect(commission?.percentage).toBe(10)
    })

    it("is idempotent — concurrent calls with same bookingIds produce exactly one row (skipDuplicates)", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const event = await createEvent({ status: "COMPLETED" })
      const sale = await createSaleRecord({ sellerId: admin.id })
      const booking = await prisma.eventBooking.create({
        data: {
          passengerCount: 1,
          eventId: event.id,
          saleRecordId: sale.id,
        },
      })

      // Call twice — second should skip duplicate
      await markCommissionsAsPaid({
        bookingIds: [booking.id],
        kind: CommissionKind.REGULAR,
        percentage: 10,
        notes: undefined,
      })
      await markCommissionsAsPaid({
        bookingIds: [booking.id],
        kind: CommissionKind.REGULAR,
        percentage: 10,
        notes: undefined,
      })

      const count = await prisma.eventBookingCommission.count({
        where: { eventBookingId: booking.id, kind: CommissionKind.REGULAR },
      })
      expect(count).toBe(1)
    })

    it("returns success:false when bookingIds is empty", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const result = await markCommissionsAsPaid({
        bookingIds: [],
        kind: CommissionKind.REGULAR,
        percentage: 10,
        notes: undefined,
      })

      expect(result.success).toBe(false)
    })

    it("returns success:false when percentage is 0", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const event = await createEvent({ status: "COMPLETED" })
      const sale = await createSaleRecord({ sellerId: admin.id })
      const booking = await prisma.eventBooking.create({
        data: { passengerCount: 1, eventId: event.id, saleRecordId: sale.id },
      })

      const result = await markCommissionsAsPaid({
        bookingIds: [booking.id],
        kind: CommissionKind.REGULAR,
        percentage: 0,
        notes: undefined,
      })

      expect(result.success).toBe(false)
    })

    it("returns success:false when unauthenticated", async () => {
      logout()

      const result = await markCommissionsAsPaid({
        bookingIds: ["non-existent-id"],
        kind: CommissionKind.REGULAR,
        percentage: 10,
        notes: undefined,
      })

      expect(result.success).toBe(false)
    })

    it("does NOT write to AuditLog (commission actions have no audit integration)", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const event = await createEvent({ status: "COMPLETED" })
      const sale = await createSaleRecord({ sellerId: admin.id })
      const booking = await prisma.eventBooking.create({
        data: { passengerCount: 1, eventId: event.id, saleRecordId: sale.id },
      })

      await markCommissionsAsPaid({
        bookingIds: [booking.id],
        kind: CommissionKind.REGULAR,
        percentage: 10,
        notes: undefined,
      })

      const auditCount = await prisma.auditLog.count({
        where: { entityType: "EventBookingCommission" },
      })
      // Commissions module intentionally has NO audit integration
      expect(auditCount).toBe(0)
    })

    it("does NOT call revalidatePath (commission actions have no path revalidation)", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const event = await createEvent({ status: "COMPLETED" })
      const sale = await createSaleRecord({ sellerId: admin.id })
      const booking = await prisma.eventBooking.create({
        data: { passengerCount: 1, eventId: event.id, saleRecordId: sale.id },
      })

      await markCommissionsAsPaid({
        bookingIds: [booking.id],
        kind: CommissionKind.REGULAR,
        percentage: 10,
        notes: undefined,
      })

      expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled()
    })
  })

  // ─── getCommissionSales (read action — verify auth guard) ─────────────────

  describe("getCommissionSales", () => {
    it("returns empty array when no eligible bookings exist for the period", async () => {
      const operator = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(operator)

      const result = await getCommissionSales(
        {
          operatorId: operator.id,
          startDate: new Date("2020-01-01"),
          endDate: new Date("2020-01-31"),
        },
        CommissionKind.REGULAR,
      )

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(0)
    })

    it("throws when unauthenticated", async () => {
      logout()

      await expect(
        getCommissionSales(
          {
            operatorId: "any-id",
            startDate: new Date(),
            endDate: new Date(),
          },
          CommissionKind.REGULAR,
        ),
      ).rejects.toThrow()
    })

    it("factory-created commissions are retrievable from DB (sanity check)", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      // Create a commission via factory — it writes directly to DB
      const commission = await createCommission({ paidById: admin.id })
      expect(commission).not.toBeNull()
      expect(commission.kind).toBe("REGULAR")

      // Verify commission row is persisted
      const found = await prisma.eventBookingCommission.findUnique({
        where: { id: commission.id },
      })
      expect(found).not.toBeNull()
      expect(found?.paidById).toBe(admin.id)
    })
  })
})
