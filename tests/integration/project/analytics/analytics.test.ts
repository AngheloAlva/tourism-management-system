/**
 * Analytics integration tests — getAnalyticsSummary
 *
 * Validates that cancelled sales and fully-cancelled bookings are excluded
 * from analytics KPIs (totalRevenue, totalSales), matching the behaviour
 * already enforced by the commissions module.
 *
 * Production code: src/project/analytics/actions/analytics.actions.ts
 *   - buildWhereClause: adds status: { not: "CANCELLED" } and
 *     eventBookings: { some: { cancelled: false } } to every query.
 *   - getAnalyticsSummary: sums payment amounts and counts eligible sales.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { getAnalyticsSummary } from "@/project/analytics/actions/analytics.actions"
import { loginAs } from "../../helpers/auth"
import { truncateAll, disconnect } from "../../helpers/db"
import { createUser, createEvent, createSaleRecord } from "../../helpers/factories"

describe("getAnalyticsSummary — cancelled exclusion", () => {
  const START = new Date("2025-01-01T00:00:00.000Z")
  const END = new Date("2025-01-31T23:59:59.999Z")
  const IN_RANGE = new Date("2025-01-15T12:00:00.000Z")

  beforeEach(async () => {
    await truncateAll()
  })

  afterAll(async () => {
    await disconnect()
  })

  it("counts an active sale with a non-cancelled booking and a payment", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    loginAs(admin)

    // Create a SALE that is active (status: TO_BE_DONE), with a non-cancelled booking and a payment.
    const event = await createEvent()
    const sale = await createSaleRecord({
      sellerId: admin.id,
      status: "TO_BE_DONE",
      createdAt: IN_RANGE,
    })

    await prisma.eventBooking.create({
      data: {
        passengerCount: 1,
        eventId: event.id,
        saleRecordId: sale.id,
        cancelled: false,
      },
    })

    await prisma.paymentRecord.create({
      data: {
        amount: 100000,
        method: "CASH",
        refund: false,
        date: IN_RANGE,
        saleRecordId: sale.id,
      },
    })

    const result = await getAnalyticsSummary({ startDate: START, endDate: END })

    expect(result.totalSales).toBe(1)
    expect(result.totalRevenue).toBe(100000)
  })

  it("excludes a CANCELLED sale even when it has a payment in range", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    loginAs(admin)

    const event = await createEvent()
    const cancelledSale = await createSaleRecord({
      sellerId: admin.id,
      status: "CANCELLED",
      createdAt: IN_RANGE,
    })

    await prisma.eventBooking.create({
      data: {
        passengerCount: 1,
        eventId: event.id,
        saleRecordId: cancelledSale.id,
        cancelled: false,
      },
    })

    await prisma.paymentRecord.create({
      data: {
        amount: 50000,
        method: "CASH",
        refund: false,
        date: IN_RANGE,
        saleRecordId: cancelledSale.id,
      },
    })

    const result = await getAnalyticsSummary({ startDate: START, endDate: END })

    expect(result.totalSales).toBe(0)
    expect(result.totalRevenue).toBe(0)
  })

  it("excludes an active sale whose only booking has cancelled: true", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    loginAs(admin)

    const event = await createEvent()
    const sale = await createSaleRecord({
      sellerId: admin.id,
      status: "TO_BE_DONE",
      createdAt: IN_RANGE,
    })

    // All bookings cancelled — no non-cancelled booking exists
    await prisma.eventBooking.create({
      data: {
        passengerCount: 1,
        eventId: event.id,
        saleRecordId: sale.id,
        cancelled: true,
      },
    })

    await prisma.paymentRecord.create({
      data: {
        amount: 75000,
        method: "CASH",
        refund: false,
        date: IN_RANGE,
        saleRecordId: sale.id,
      },
    })

    const result = await getAnalyticsSummary({ startDate: START, endDate: END })

    expect(result.totalSales).toBe(0)
    expect(result.totalRevenue).toBe(0)
  })

  it("counts only the active sale when both active and cancelled sales exist in range", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    loginAs(admin)

    const event = await createEvent()

    // Active sale — should be counted
    const activeSale = await createSaleRecord({
      sellerId: admin.id,
      status: "TO_BE_DONE",
      createdAt: IN_RANGE,
    })
    await prisma.eventBooking.create({
      data: { passengerCount: 1, eventId: event.id, saleRecordId: activeSale.id, cancelled: false },
    })
    await prisma.paymentRecord.create({
      data: { amount: 100000, method: "CASH", refund: false, date: IN_RANGE, saleRecordId: activeSale.id },
    })

    // Cancelled sale — should be excluded
    const cancelledSale = await createSaleRecord({
      sellerId: admin.id,
      status: "CANCELLED",
      createdAt: IN_RANGE,
    })
    await prisma.eventBooking.create({
      data: { passengerCount: 1, eventId: event.id, saleRecordId: cancelledSale.id, cancelled: false },
    })
    await prisma.paymentRecord.create({
      data: { amount: 50000, method: "CASH", refund: false, date: IN_RANGE, saleRecordId: cancelledSale.id },
    })

    const result = await getAnalyticsSummary({ startDate: START, endDate: END })

    expect(result.totalSales).toBe(1)
    expect(result.totalRevenue).toBe(100000)
  })
})
