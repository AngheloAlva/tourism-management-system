/**
 * T-C1 — Sales integration tests
 * Production code: src/project/sales/actions/sale-record.actions.ts
 * Actions covered: createSaleRecord, updateSaleRecord, deleteSaleRecord
 *
 * Key observations about the production code:
 * - createSaleRecord: does NOT write to AuditLog. Returns { success, data } or { success: false, error }.
 * - updateSaleRecord: writes to AuditLog only if fields changed. Returns { success, data } or { success: false, error }.
 * - deleteSaleRecord: sets status=CANCELLED (soft delete), writes to AuditLog. Returns { success: true } or { success: false, error }.
 * - revalidatePath is NOT called in createSaleRecord/updateSaleRecord/deleteSaleRecord directly.
 *   (revalidatePath is only called in updateBookingPassengerExclusions)
 * - createSaleRecord requires type, channel, eventBookings (at least one booking with tourId + date + mode + passengerArray).
 * - canCurrentUserInteractPaths checks admin role → admin bypasses all permission checks.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import {
  createSaleRecord as createSaleRecordAction,
  updateSaleRecord as updateSaleRecordAction,
  deleteSaleRecord as deleteSaleRecordAction,
} from "@/project/sales/actions/sale-record.actions"
import { deleteSaleRecordExecutor } from "@/project/sales/executors/delete-sale-record.executor"
import { loginAs, logout } from "../../helpers/auth"
import { truncateAll, disconnect } from "../../helpers/db"
import { createUser, createTour, createSaleRecord, createApproval } from "../../helpers/factories"

/** Minimal valid payload for createSaleRecord / updateSaleRecord. */
function validSalePayload(tourId: string) {
  return {
    type: "SALE" as const,
    channel: "PHYSICAL" as const,
    isWholesale: false,
    paymentPending: false,
    fileNumberPending: false,
    discount: 0,
    passengerArray: [
      {
        name: "Test Passenger",
        age: 30,
        nacionality: "CL",
        allergies: [],
        hotels: [],
      },
    ],
    paymentArray: [
      {
        refund: false,
        method: "CASH" as const,
        currency: "CLP" as const,
        amount: 50000,
        movement_date: new Date(),
      },
    ],
    eventBookings: [
      {
        mode: "REGULAR" as const,
        date: new Date(),
        tourId,
        startTime: "",
        endTime: "",
        priceEntries: [],
        entrySnapshots: [],
        excludedPassengers: [],
      },
    ],
  }
}

describe("sale-record.actions integration", () => {
  beforeEach(async () => {
    await truncateAll()
    vi.mocked(revalidatePath).mockClear()
  })

  afterAll(async () => {
    await disconnect()
  })

  // ─── createSaleRecord ────────────────────────────────────────────────────

  describe("createSaleRecord", () => {
    it("creates a SaleRecord row with a passenger and payment when admin calls with valid data", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)
      const tour = await createTour()

      const result = await createSaleRecordAction(validSalePayload(tour.id))

      expect(result.success).toBe(true)
      const row = await prisma.saleRecord.findFirst({ where: { type: "SALE" } })
      expect(row).not.toBeNull()
      expect(row?.channel).toBe("PHYSICAL")
      // Verify passenger was created
      const passenger = await prisma.passenger.findFirst({ where: { saleRecordId: row!.id } })
      expect(passenger).not.toBeNull()
      // Verify payment record was created
      const payment = await prisma.paymentRecord.findFirst({ where: { saleRecordId: row!.id } })
      expect(payment).not.toBeNull()
      expect(payment?.amount).toBe(50000)
    })

    it("returns success:false and no DB row when type is missing (Zod validation fails)", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)
      const tour = await createTour()

      const invalidPayload = {
        ...validSalePayload(tour.id),
        type: undefined as unknown as "SALE",
      }

      const result = await createSaleRecordAction(invalidPayload)

      expect(result.success).toBe(false)
      const count = await prisma.saleRecord.count()
      expect(count).toBe(0)
    })

    it("returns success:false when unauthenticated (no session)", async () => {
      logout()
      const tour = await createTour()

      const result = await createSaleRecordAction(validSalePayload(tour.id))

      expect(result.success).toBe(false)
      expect(result.error).toContain("autenticado")
    })

    it("returns success:false when no eventBookings provided", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)
      const tour = await createTour()

      const payload = { ...validSalePayload(tour.id), eventBookings: [] }
      const result = await createSaleRecordAction(payload)

      expect(result.success).toBe(false)
    })
  })

  // ─── updateSaleRecord ────────────────────────────────────────────────────

  describe("updateSaleRecord", () => {
    it("updates channel on existing SaleRecord and writes an AuditLog row when field changes", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)
      const tour = await createTour()

      // First create so the record exists
      const createResult = await createSaleRecordAction(validSalePayload(tour.id))
      expect(createResult.success).toBe(true)
      const recordId = createResult.data!.id

      const updatedPayload = {
        ...validSalePayload(tour.id),
        channel: "ONLINE" as const,
      }

      const updateResult = await updateSaleRecordAction(recordId, updatedPayload)

      expect(updateResult.success).toBe(true)
      const updatedRow = await prisma.saleRecord.findUnique({ where: { id: recordId } })
      expect(updatedRow?.channel).toBe("ONLINE")

      // AuditLog should be written because channel changed (PHYSICAL → ONLINE)
      const auditLogs = await prisma.auditLog.findMany({
        where: { entityType: "SaleRecord", entityId: recordId, action: "UPDATE" },
      })
      expect(auditLogs.length).toBeGreaterThan(0)
    })

    it("returns success:false when the record does not exist", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)
      const tour = await createTour()

      const result = await updateSaleRecordAction("non-existent-id", validSalePayload(tour.id))

      expect(result.success).toBe(false)
    })

    it("returns success:false when unauthenticated", async () => {
      logout()
      const tour = await createTour()

      const result = await updateSaleRecordAction("any-id", validSalePayload(tour.id))

      expect(result.success).toBe(false)
    })
  })

  // ─── deleteSaleRecord (approval gate) ─────────────────────────────────────
  //
  // deleteSaleRecord now routes through the async approvals system:
  // - The action creates an ApprovalRequest (PENDING) and returns { success, approvalRequired, requestId }.
  // - The actual soft-delete (status → CANCELLED + AuditLog) is performed by
  //   deleteSaleRecordExecutor once the admin approves. The record is NOT mutated by the action.

  describe("deleteSaleRecord", () => {
    it("creates a PENDING ApprovalRequest and leaves the SaleRecord status unchanged", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)
      // Use factory for setup (bypasses voucher counter collision risk)
      const record = await createSaleRecord({ sellerId: admin.id })

      const result = await deleteSaleRecordAction(record.id, "Test deletion reason")

      // Action creates an approval request — does NOT soft-delete immediately
      expect(result.success).toBe(true)
      if (!result.success) throw new Error("unreachable")
      expect(result.approvalRequired).toBe(true)
      expect(result.requestId).toBeTruthy()

      // Record status is unchanged (still ACTIVE or PENDING, not CANCELLED)
      const row = await prisma.saleRecord.findUnique({ where: { id: record.id } })
      expect(row).not.toBeNull()
      expect(row?.status).not.toBe("CANCELLED")

      // ApprovalRequest row exists with PENDING status
      const request = await prisma.approvalRequest.findUnique({
        where: { id: result.requestId },
      })
      expect(request).not.toBeNull()
      expect(request?.status).toBe("PENDING")
      expect(request?.action).toBe("DELETE_SALE_RECORD")
      expect(request?.targetId).toBe(record.id)
    })

    it("returns success:false when the record does not exist", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const result = await deleteSaleRecordAction("non-existent-id", "reason")

      expect(result.success).toBe(false)
    })

    it("returns success:false when unauthenticated", async () => {
      logout()

      const result = await deleteSaleRecordAction("any-id", "reason")

      expect(result.success).toBe(false)
    })
  })

  // ─── deleteSaleRecordExecutor (happy-path end-to-end) ────────────────────
  //
  // Proves the soft-delete path works when an approval is executed.

  describe("deleteSaleRecordExecutor", () => {
    it("sets status to CANCELLED on the SaleRecord and writes an AuditLog", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })

      const record = await createSaleRecord({ sellerId: admin.id })

      const approval = await createApproval({
        requestedById: admin.id,
        action: "DELETE_SALE_RECORD",
        domain: "sales",
        targetType: "sale-record",
        targetId: record.id,
        targetFingerprint: record.updatedAt.toISOString(),
        status: "APPROVED",
      })

      const result = await prisma.$transaction((tx) =>
        deleteSaleRecordExecutor({
          request: approval,
          payload: { reason: "Executor integration test" },
          requestedById: admin.id,
          resolvedById: admin.id,
          targetId: record.id,
          tx,
        }),
      )

      expect(result.ok).toBe(true)

      // Record is soft-deleted: status → CANCELLED, row still exists
      const row = await prisma.saleRecord.findUnique({ where: { id: record.id } })
      expect(row).not.toBeNull()
      expect(row?.status).toBe("CANCELLED")

      // AuditLog must be written
      const auditLog = await prisma.auditLog.findFirst({
        where: { entityType: "SaleRecord", entityId: record.id, action: "DELETE" },
      })
      expect(auditLog).not.toBeNull()
    })
  })
})
