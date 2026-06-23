/**
 * T-C2 — Events integration tests
 * Production code: src/project/events/actions/event.actions.ts
 * Actions covered: updateEvent, rescheduleEvent, cancelEventWithApproval
 *
 * Key observations about the production code:
 * - No createEvent action — events are created via createSaleRecord (implicit) or factory.
 * - updateEvent: updates event fields, writes AuditLog only when provider (guide/driver/vehicle) changes.
 *   Returns { success, data } or { success: false, error }.
 *   Calls revalidatePath("/dashboard/calendario").
 *   Cannot set status to CANCELLED via updateEvent (guard exists).
 * - rescheduleEvent: validates eventId must be a CUID. Updates date/time, marks linked saleRecords
 *   with voucherOutdatedAt=now(), writes AuditLog. Returns { success, data } or { success: false, error }.
 *   Calls revalidatePath for /dashboard/calendario + /dashboard/registro-de-ventas + /dashboard/navegacion-ventas.
 * - cancelEventWithApproval: admin can cancel directly without approval code. Returns { success, data }.
 *   No AuditLog written in this action (event status updated only).
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import {
  updateEvent as updateEventAction,
  rescheduleEvent as rescheduleEventAction,
  cancelEventWithApproval,
} from "@/project/events/actions/event.actions"
import { formatCalendarDay, parseCalendarDay } from "@/shared/utils/calendar-day"
import { cancelEventExecutor } from "@/project/events/executors/cancel-event.executor"
import { loginAs, logout } from "../../helpers/auth"
import { truncateAll, disconnect } from "../../helpers/db"
import { createUser, createEvent, createSaleRecord, createApproval } from "../../helpers/factories"

describe("event.actions integration", () => {
  beforeEach(async () => {
    await truncateAll()
    vi.mocked(revalidatePath).mockClear()
  })

  afterAll(async () => {
    await disconnect()
  })

  // ─── updateEvent ────────────────────────────────────────────────────────

  describe("updateEvent", () => {
    it("updates event status to CONFIRMED and calls revalidatePath for calendario", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)
      const event = await createEvent({ status: "SCHEDULED" })

      const result = await updateEventAction(event.id, {
        status: "CONFIRMED",
        isCompleted: false,
      })

      expect(result.success).toBe(true)
      const updatedEvent = await prisma.event.findUnique({ where: { id: event.id } })
      expect(updatedEvent?.status).toBe("CONFIRMED")
      expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/dashboard/calendario")
    })

    it("blocks setting status to CANCELLED — Zod rejects it before the runtime guard", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)
      const event = await createEvent({ status: "SCHEDULED" })

      // "CANCELLED" is not in the enum [SCHEDULED|CONFIRMED|IN_PROGRESS|COMPLETED|TRANSFERRED]
      // Zod rejects it before the runtime guard even runs.
      const result = await updateEventAction(event.id, {
        status: "CANCELLED" as "CONFIRMED",
        isCompleted: false,
      })

      expect(result.success).toBe(false)
      // Either Zod validation error or the runtime guard message — both indicate failure
      expect(result.error).toBeTruthy()
    })

    it("returns success:false when event does not exist", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const result = await updateEventAction("non-existent-id", {
        status: "CONFIRMED",
        isCompleted: false,
      })

      expect(result.success).toBe(false)
    })

    it("returns success:false when unauthenticated", async () => {
      logout()
      const event = await createEvent()

      const result = await updateEventAction(event.id, { isCompleted: false })

      expect(result.success).toBe(false)
    })
  })

  // ─── rescheduleEvent ─────────────────────────────────────────────────────

  describe("rescheduleEvent", () => {
    it("reschedules event, sets voucherOutdatedAt on linked sale records, writes AuditLog, and revalidates", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      // Create an event (factory creates Tour implicitly)
      const event = await createEvent({ status: "SCHEDULED" })

      // Create a sale record linked to the event via an EventBooking
      const saleRecord = await createSaleRecord({ sellerId: admin.id })
      await prisma.eventBooking.create({
        data: {
          eventId: event.id,
          saleRecordId: saleRecord.id,
          passengerCount: 1,
        },
      })

      const tomorrowStr = formatCalendarDay(new Date(Date.now() + 86400000), "yyyy-MM-dd")
      const tomorrow = parseCalendarDay(tomorrowStr)

      const result = await rescheduleEventAction({
        eventId: event.id,
        newDate: tomorrow,
        reason: "Integration test reschedule",
        overrideProviderConflict: true,
      })

      expect(result.success).toBe(true)

      // Event date updated
      const updatedEvent = await prisma.event.findUnique({ where: { id: event.id } })
      expect(formatCalendarDay(updatedEvent!.date, "yyyy-MM-dd")).toBe(tomorrowStr)

      // voucherOutdatedAt set on linked sale record
      const updatedSale = await prisma.saleRecord.findUnique({ where: { id: saleRecord.id } })
      expect(updatedSale?.voucherOutdatedAt).not.toBeNull()

      // AuditLog written
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          entityType: "Event",
          entityId: event.id,
          action: "UPDATE",
        },
      })
      expect(auditLog).not.toBeNull()

      // revalidatePath called for all three paths
      expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/dashboard/calendario")
      expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/dashboard/registro-de-ventas")
    })

    it("returns success:false when trying to reschedule to a past date", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)
      const event = await createEvent({ status: "SCHEDULED" })

      // Use parseCalendarDay so the past date is a fixed UTC midnight value guaranteed
      // to be in the past regardless of the test machine's local timezone.
      const yesterday = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      const pastDate = parseCalendarDay(formatCalendarDay(yesterday, "yyyy-MM-dd"))

      const result = await rescheduleEventAction({
        eventId: event.id,
        newDate: pastDate,
        reason: "Test",
      })

      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toBeTruthy()
    })

    it("returns success:false for a non-existent event", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      // rescheduleEvent validates eventId as CUID — use a fake but cuid-looking id
      const result = await rescheduleEventAction({
        eventId: "clxxxxxxxxxxxxxxxxxxxxxxxxxx",
        newDate: tomorrow,
        reason: "Test",
      })

      expect(result.success).toBe(false)
    })
  })

  // ─── cancelEventWithApproval (approval gate) ─────────────────────────────
  //
  // cancelEventWithApproval now routes through the async approvals system:
  // - The action creates an ApprovalRequest (PENDING) and returns { success, approvalRequired, requestId }.
  // - The actual cancellation (status → CANCELLED + AuditLog) is performed by
  //   cancelEventExecutor once the admin approves. The event is NOT mutated by the action.

  describe("cancelEventWithApproval", () => {
    it("creates a PENDING ApprovalRequest and leaves the event status unchanged", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)
      const event = await createEvent({ status: "SCHEDULED" })

      const result = await cancelEventWithApproval({
        eventId: event.id,
        reason: "Test cancellation by admin",
      })

      // Action creates an approval request — cancellation is deferred
      expect(result.success).toBe(true)
      if (!result.success) throw new Error("unreachable")
      expect(result.approvalRequired).toBe(true)
      expect(result.requestId).toBeTruthy()

      // Event status is unchanged (still SCHEDULED)
      const unchanged = await prisma.event.findUnique({ where: { id: event.id } })
      expect(unchanged?.status).toBe("SCHEDULED")

      // ApprovalRequest row exists with PENDING status
      const request = await prisma.approvalRequest.findUnique({
        where: { id: result.requestId },
      })
      expect(request).not.toBeNull()
      expect(request?.status).toBe("PENDING")
      expect(request?.action).toBe("CANCEL_EVENT")
      expect(request?.targetId).toBe(event.id)
    })

    it("returns error when event is already cancelled", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)
      const event = await createEvent({ status: "CANCELLED" })

      const result = await cancelEventWithApproval({
        eventId: event.id,
        reason: "Double cancel attempt",
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("anulado")
    })

    it("returns error when reason is empty", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)
      const event = await createEvent({ status: "SCHEDULED" })

      const result = await cancelEventWithApproval({
        eventId: event.id,
        reason: "   ",
      })

      expect(result.success).toBe(false)
    })
  })

  // ─── cancelEventExecutor (happy-path end-to-end) ──────────────────────────
  //
  // Proves the cancellation path works when an approval is executed.
  // The executor runs inside a transaction and sets event.status = CANCELLED.

  describe("cancelEventExecutor", () => {
    it("sets status to CANCELLED on the event and writes an AuditLog", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })

      const event = await createEvent({ status: "SCHEDULED" })

      const approval = await createApproval({
        requestedById: admin.id,
        action: "CANCEL_EVENT",
        domain: "events",
        targetType: "event",
        targetId: event.id,
        targetFingerprint: event.updatedAt.toISOString(),
        status: "APPROVED",
      })

      const result = await prisma.$transaction((tx) =>
        cancelEventExecutor({
          request: approval,
          payload: { reason: "Executor integration test" },
          requestedById: admin.id,
          resolvedById: admin.id,
          targetId: event.id,
          tx,
        }),
      )

      expect(result.ok).toBe(true)

      // Event should now be CANCELLED
      const cancelled = await prisma.event.findUnique({ where: { id: event.id } })
      expect(cancelled?.status).toBe("CANCELLED")
      expect(cancelled?.cancelReason).toBe("Executor integration test")

      // AuditLog should be written
      const auditLog = await prisma.auditLog.findFirst({
        where: { entityType: "Event", entityId: event.id, action: "UPDATE" },
      })
      expect(auditLog).not.toBeNull()
    })
  })
})
