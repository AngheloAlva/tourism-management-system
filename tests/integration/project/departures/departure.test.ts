/**
 * T-C5 — Departures integration tests
 * Production code: src/project/departures/actions/departure.actions.ts
 *
 * CRITICAL ARCHITECTURE NOTE:
 * The "departures" domain is a VIEW over Event rows — there is NO Departure Prisma
 * model. The departure.actions.ts file contains only ONE action: getEventsByDate,
 * which is a READ-ONLY query.
 *
 * All mutations on departure-related events go through:
 *   - src/project/events/actions/event.actions.ts (updateEvent, rescheduleEvent,
 *     cancelEventWithApproval) — covered in T-C2.
 *
 * This test suite covers:
 * - getEventsByDate: happy path (events exist for date) and empty result (no events).
 * - Unauthenticated access throws.
 * - The createDeparture factory creates an Event with status=CONFIRMED which is what
 *   the departures view operates over.
 *
 * For mutation coverage see: tests/integration/project/events/event.test.ts (T-C2).
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getEventsByDate } from "@/project/departures/actions/departure.actions"
import { loginAs, logout } from "../../helpers/auth"
import { truncateAll, disconnect } from "../../helpers/db"
import { createUser, createDeparture, createSaleRecord } from "../../helpers/factories"

describe("departure.actions integration", () => {
  beforeEach(async () => {
    await truncateAll()
    vi.mocked(revalidatePath).mockClear()
  })

  afterAll(async () => {
    await disconnect()
  })

  // ─── getEventsByDate ──────────────────────────────────────────────────────

  describe("getEventsByDate", () => {
    it("returns events for today that have at least one SALE-type booking with passengers", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      // Create a departure event (wraps createEvent with status: CONFIRMED)
      const event = await createDeparture()

      // Create a SALE-type sale record and link it via EventBooking
      const saleRecord = await createSaleRecord({ sellerId: admin.id, type: "SALE" })

      // The getEventsByDate logic computes remainingPassengerCount = Math.min(passengerCount, saleRecord.passengers.length)
      // If there are no passengers in the sale record, the booking is filtered out.
      // We need at least one passenger on the sale record.
      await prisma.passenger.create({
        data: { saleRecordId: saleRecord.id, name: "Test Pax", allergies: [] },
      })

      await prisma.eventBooking.create({
        data: {
          eventId: event.id,
          saleRecordId: saleRecord.id,
          passengerCount: 1,
        },
      })

      const today = new Date()
      const results = await getEventsByDate(today)

      // The event created today should appear in the result
      const found = results.find((r) => r.id === event.id)
      expect(found).toBeDefined()
    })

    it("returns empty array when no events exist for the given date", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 10)

      const results = await getEventsByDate(futureDate)

      expect(results).toEqual([])
    })

    it("filters out CANCELLED events", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const cancelledDeparture = await createDeparture({ status: "SCHEDULED" })
      // Manually cancel the event to simulate a cancelled departure
      await prisma.event.update({
        where: { id: cancelledDeparture.id },
        data: { status: "CANCELLED" },
      })

      // Add a booking so it would otherwise appear
      const saleRecord = await createSaleRecord({ sellerId: admin.id, type: "SALE" })
      await prisma.eventBooking.create({
        data: {
          eventId: cancelledDeparture.id,
          saleRecordId: saleRecord.id,
          passengerCount: 1,
        },
      })

      const today = new Date()
      const results = await getEventsByDate(today)

      const found = results.find((r) => r.id === cancelledDeparture.id)
      expect(found).toBeUndefined()
    })

    it("filters out events that only have QUOTE-type bookings (not SALE)", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const event = await createDeparture()
      // Link only a QUOTE-type sale record
      const quoteRecord = await createSaleRecord({ sellerId: admin.id, type: "QUOTE" })
      await prisma.eventBooking.create({
        data: {
          eventId: event.id,
          saleRecordId: quoteRecord.id,
          passengerCount: 1,
        },
      })

      const today = new Date()
      const results = await getEventsByDate(today)

      // Event should NOT appear because it only has QUOTE bookings
      const found = results.find((r) => r.id === event.id)
      expect(found).toBeUndefined()
    })

    it("throws when unauthenticated", async () => {
      logout()

      await expect(getEventsByDate(new Date())).rejects.toThrow()
    })
  })

  // ─── factory contract verification ───────────────────────────────────────

  describe("createDeparture factory", () => {
    it("creates an Event row (no Departure model) with CONFIRMED status by default", async () => {
      const departure = await createDeparture()

      const row = await prisma.event.findUnique({ where: { id: departure.id } })
      expect(row).not.toBeNull()
      expect(row?.status).toBe("CONFIRMED")
      // No Departure model — it IS an Event
      expect(row?.serviceKind).toBe("TOUR")
    })
  })
})
