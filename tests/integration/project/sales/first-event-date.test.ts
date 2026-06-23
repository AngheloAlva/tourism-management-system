/**
 * T-D1 — syncFirstEventDate (applyFirstEventDate) integration tests
 *
 * Verifies that applyFirstEventDate correctly computes the MIN(event.date) of
 * active bookings and writes it to SaleRecord.firstEventDate. This helper is
 * the canonical write path for firstEventDate across all server actions.
 *
 * Covered scenarios:
 * - Returns null when sale has no bookings
 * - Returns the single active event date when there is exactly one booking
 * - Returns the earliest date when multiple bookings with different dates exist
 * - Ignores bookings where EventBooking.cancelled = true
 * - Ignores bookings where Event.status = "CANCELLED"
 * - Updates correctly after an event date changes (idempotent re-call)
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { parseCalendarDay } from "@/shared/utils/calendar-day"
import {
  applyFirstEventDate,
  computeFirstEventDate,
} from "@/project/sales/server/first-event-date"
import { createEvent, createSaleRecord, createUser } from "../../helpers/factories"
import { truncateAll, disconnect } from "../../helpers/db"

describe("applyFirstEventDate (syncFirstEventDate)", () => {
  beforeEach(async () => {
    await truncateAll()
  })

  afterAll(async () => {
    await disconnect()
  })

  it("sets firstEventDate to null when sale has no bookings", async () => {
    const seller = await createUser()
    const sale = await createSaleRecord({ sellerId: seller.id })

    await prisma.$transaction(async (tx) => {
      await applyFirstEventDate(sale.id, tx)
    })

    const updated = await prisma.saleRecord.findUniqueOrThrow({ where: { id: sale.id } })
    expect(updated.firstEventDate).toBeNull()
  })

  it("sets firstEventDate to the single active event date", async () => {
    const seller = await createUser()
    const sale = await createSaleRecord({ sellerId: seller.id })
    const day = parseCalendarDay("2025-10-15")
    const event = await createEvent({ date: day })

    await prisma.eventBooking.create({
      data: { saleRecordId: sale.id, eventId: event.id, passengerCount: 1 },
    })

    await prisma.$transaction(async (tx) => {
      await applyFirstEventDate(sale.id, tx)
    })

    const updated = await prisma.saleRecord.findUniqueOrThrow({ where: { id: sale.id } })
    // @db.Date round-trips as UTC midnight — compare via ISO date string
    expect(updated.firstEventDate?.toISOString().slice(0, 10)).toBe("2025-10-15")
  })

  it("sets firstEventDate to the earliest date across multiple bookings", async () => {
    const seller = await createUser()
    const sale = await createSaleRecord({ sellerId: seller.id })

    const earlyDay = parseCalendarDay("2025-09-01")
    const lateDay = parseCalendarDay("2025-11-20")
    const midDay = parseCalendarDay("2025-10-10")

    const [e1, e2, e3] = await Promise.all([
      createEvent({ date: lateDay }),
      createEvent({ date: earlyDay }),
      createEvent({ date: midDay }),
    ])

    await prisma.eventBooking.createMany({
      data: [
        { saleRecordId: sale.id, eventId: e1.id, passengerCount: 1 },
        { saleRecordId: sale.id, eventId: e2.id, passengerCount: 1 },
        { saleRecordId: sale.id, eventId: e3.id, passengerCount: 1 },
      ],
    })

    await prisma.$transaction(async (tx) => {
      await applyFirstEventDate(sale.id, tx)
    })

    const updated = await prisma.saleRecord.findUniqueOrThrow({ where: { id: sale.id } })
    expect(updated.firstEventDate?.toISOString().slice(0, 10)).toBe("2025-09-01")
  })

  it("ignores cancelled EventBooking rows", async () => {
    const seller = await createUser()
    const sale = await createSaleRecord({ sellerId: seller.id })

    const cancelledDay = parseCalendarDay("2025-08-01")
    const activeDay = parseCalendarDay("2025-10-15")

    const [cancelledEvent, activeEvent] = await Promise.all([
      createEvent({ date: cancelledDay }),
      createEvent({ date: activeDay }),
    ])

    await prisma.eventBooking.createMany({
      data: [
        // cancelled booking — must be excluded
        { saleRecordId: sale.id, eventId: cancelledEvent.id, passengerCount: 1, cancelled: true },
        // active booking
        { saleRecordId: sale.id, eventId: activeEvent.id, passengerCount: 1, cancelled: false },
      ],
    })

    await prisma.$transaction(async (tx) => {
      await applyFirstEventDate(sale.id, tx)
    })

    const updated = await prisma.saleRecord.findUniqueOrThrow({ where: { id: sale.id } })
    expect(updated.firstEventDate?.toISOString().slice(0, 10)).toBe("2025-10-15")
  })

  it("ignores bookings whose event.status is CANCELLED", async () => {
    const seller = await createUser()
    const sale = await createSaleRecord({ sellerId: seller.id })

    const cancelledDay = parseCalendarDay("2025-07-01")
    const activeDay = parseCalendarDay("2025-12-05")

    const [cancelledEvent, activeEvent] = await Promise.all([
      createEvent({ date: cancelledDay, status: "CANCELLED" }),
      createEvent({ date: activeDay, status: "SCHEDULED" }),
    ])

    await prisma.eventBooking.createMany({
      data: [
        { saleRecordId: sale.id, eventId: cancelledEvent.id, passengerCount: 1 },
        { saleRecordId: sale.id, eventId: activeEvent.id, passengerCount: 1 },
      ],
    })

    await prisma.$transaction(async (tx) => {
      await applyFirstEventDate(sale.id, tx)
    })

    const updated = await prisma.saleRecord.findUniqueOrThrow({ where: { id: sale.id } })
    expect(updated.firstEventDate?.toISOString().slice(0, 10)).toBe("2025-12-05")
  })

  it("is idempotent: re-calling after an event date change updates firstEventDate", async () => {
    const seller = await createUser()
    const sale = await createSaleRecord({ sellerId: seller.id })

    const originalDay = parseCalendarDay("2025-10-15")
    const event = await createEvent({ date: originalDay })
    await prisma.eventBooking.create({
      data: { saleRecordId: sale.id, eventId: event.id, passengerCount: 1 },
    })

    // First apply
    await prisma.$transaction(async (tx) => {
      await applyFirstEventDate(sale.id, tx)
    })
    const after1 = await prisma.saleRecord.findUniqueOrThrow({ where: { id: sale.id } })
    expect(after1.firstEventDate?.toISOString().slice(0, 10)).toBe("2025-10-15")

    // Move event to a later date
    const newDay = parseCalendarDay("2025-11-20")
    await prisma.event.update({ where: { id: event.id }, data: { date: newDay } })

    // Re-apply
    await prisma.$transaction(async (tx) => {
      await applyFirstEventDate(sale.id, tx)
    })
    const after2 = await prisma.saleRecord.findUniqueOrThrow({ where: { id: sale.id } })
    expect(after2.firstEventDate?.toISOString().slice(0, 10)).toBe("2025-11-20")
  })

  it("computeFirstEventDate returns null when all bookings are cancelled", async () => {
    const seller = await createUser()
    const sale = await createSaleRecord({ sellerId: seller.id })
    const day = parseCalendarDay("2025-10-15")
    const event = await createEvent({ date: day })

    await prisma.eventBooking.create({
      data: { saleRecordId: sale.id, eventId: event.id, passengerCount: 1, cancelled: true },
    })

    const result = await prisma.$transaction(async (tx) => {
      return computeFirstEventDate(sale.id, tx)
    })
    expect(result).toBeNull()
  })
})
