/**
 * T-EVENT-DATE — applySaleUpdateTx event-date change regression guard
 *
 * Bug: When editing a sale and changing the date of an already-linked event
 * (bookingData.eventId is populated), the new date was silently discarded.
 * The fix detects param drift and re-resolves via findOrCreateEventForBookingTx.
 *
 * Cases:
 *   T-ED1: editing a private transfer booking and changing the date → the new
 *          Event row should use the new date (RED before fix, GREEN after).
 *   T-ED2: editing a sale WITHOUT changing the date/mode/startTime/endTime →
 *          the same Event row must be reused (no extra Event created).
 *
 * NOTE: Requires a running Docker environment (PostgreSQL testcontainer).
 *       Run with: pnpm test:integration
 */

import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import {
  createSaleRecord as createSaleRecordAction,
  updateSaleRecord as updateSaleRecordAction,
} from "@/project/sales/actions/sale-record.actions"
import { loginAs } from "../../helpers/auth"
import { truncateAll, disconnect } from "../../helpers/db"
import { createUser } from "../../helpers/factories"
import { parseCalendarDay } from "@/shared/utils/calendar-day"

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createTransferService(nameSuffix = "") {
  return prisma.transferService.create({
    data: {
      name: `Test Transfer IN${nameSuffix}-${Date.now()}`,
      direction: "IN",
      pricePerPassenger: 15000,
      receptionPricePerPassenger: 8000,
      active: true,
    },
  })
}

/** Build a minimal PRIVATE transfer sale payload for a given service and date. */
function transferSalePayload(transferServiceId: string, date: Date) {
  return {
    type: "SALE" as const,
    channel: "PHYSICAL" as const,
    isWholesale: false,
    paymentPending: false,
    fileNumberPending: false,
    discount: 0,
    passengerArray: [
      {
        name: "Transfer Passenger",
        age: 35,
        nacionality: "CL",
        allergies: [] as string[],
        hotels: [] as unknown[],
      },
    ],
    paymentArray: [
      {
        refund: false,
        method: "CASH" as const,
        currency: "CLP" as const,
        amount: 15000,
        movement_date: new Date(),
      },
    ],
    eventBookings: [
      {
        mode: "PRIVATE" as const,
        date,
        // For transfers, tourId field holds the transferServiceId (same field
        // used by findOrCreateEventForBookingTx via serviceId).
        tourId: transferServiceId,
        startTime: "" as string,
        endTime: "" as string,
        priceEntries: [] as unknown[],
        entrySnapshots: [] as unknown[],
        excludedPassengers: [] as unknown[],
      },
    ],
  }
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("sale update — event date change (integration)", () => {
  beforeEach(async () => {
    await truncateAll()
    vi.mocked(revalidatePath).mockClear()
  })

  afterAll(async () => {
    await disconnect()
  })

  // ── T-ED1: changing the event date persists the new date ──────────────────

  it("T-ED1: editing a sale and changing the booking date → Event.date reflects the new date", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    loginAs(admin)

    const svc = await createTransferService()

    // Day 1 — original date
    const day1 = parseCalendarDay("2026-06-01")
    const created = await createSaleRecordAction(transferSalePayload(svc.id, day1))
    expect(created.success).toBe(true)
    const saleId = created.data!.id

    // Verify the event was created with day1
    const bookingBefore = await prisma.eventBooking.findFirstOrThrow({
      where: { saleRecordId: saleId },
      include: { event: true },
    })
    expect(bookingBefore.event.date.getTime()).toBe(day1.getTime())
    const originalEventId = bookingBefore.event.id

    // Day 2 — new date; keep eventId populated (as the real form does)
    const day2 = parseCalendarDay("2026-06-02")
    const updatePayload = {
      ...transferSalePayload(svc.id, day2),
      eventBookings: [
        {
          ...transferSalePayload(svc.id, day2).eventBookings[0],
          date: day2,
          // Simulating what the form sends: eventId is still the OLD event
          eventId: originalEventId,
        },
      ],
    }

    const result = await updateSaleRecordAction(saleId, updatePayload)
    expect(result.success).toBe(true)

    // The booking must now point to an event with day2
    const bookingAfter = await prisma.eventBooking.findFirstOrThrow({
      where: { saleRecordId: saleId },
      include: { event: true },
    })

    expect(bookingAfter.event.date.getTime()).toBe(
      day2.getTime(),
      "Event.date should be the new date (day2), not the original (day1)"
    )
  })

  // ── T-ED2: no date change → same event is reused ─────────────────────────

  it("T-ED2: editing a sale without changing the booking date → same Event row is reused", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    loginAs(admin)

    const svc = await createTransferService("-B")

    const day1 = parseCalendarDay("2026-06-01")
    const created = await createSaleRecordAction(transferSalePayload(svc.id, day1))
    expect(created.success).toBe(true)
    const saleId = created.data!.id

    const bookingBefore = await prisma.eventBooking.findFirstOrThrow({
      where: { saleRecordId: saleId },
      include: { event: true },
    })
    const originalEventId = bookingBefore.event.id

    // Update with the SAME date and the SAME eventId — only comments change
    const updatePayload = {
      ...transferSalePayload(svc.id, day1),
      comments: "only comments changed",
      eventBookings: [
        {
          ...transferSalePayload(svc.id, day1).eventBookings[0],
          date: day1,
          eventId: originalEventId,
        },
      ],
    }

    const result = await updateSaleRecordAction(saleId, updatePayload)
    expect(result.success).toBe(true)

    const bookingAfter = await prisma.eventBooking.findFirstOrThrow({
      where: { saleRecordId: saleId },
      include: { event: true },
    })

    // Must reuse the exact same Event row
    expect(bookingAfter.event.id).toBe(
      originalEventId,
      "Same event must be reused when no booking params changed"
    )

    // Only one Event should exist for this service+date combination
    const eventsForService = await prisma.event.findMany({
      where: { transferServiceId: svc.id },
    })
    expect(eventsForService).toHaveLength(1)
  })
})
