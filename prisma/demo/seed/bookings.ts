/**
 * Seed: event bookings + commissions.
 *
 * Links sales to events via EventBooking. Each booking derives one commission
 * row at COMMISSION_RATE (10%) of the sale total.
 *
 * Must run after sales and calendar.
 */

import { faker } from "@faker-js/faker"
// Direct relative path — @generated/* alias is resolved by Next/tsc but not by tsx at runtime.
import type { PrismaClient } from "../../../../src/generated/prisma/client"
import { COMMISSION_RATE, SALE_SCENARIOS } from "./constants"
import type { SaleContext } from "./sales"

faker.seed(47)

export interface BookingContext {
  bookingId: string
  saleId: string
  eventId: string
  commissionAmount: number
}

interface BookingsInput {
  sales: SaleContext[]
  adminUserId: string
  defaultCategoryByTour: Map<string, string>
}

export async function seedBookings(
  prisma: PrismaClient,
  input: BookingsInput,
): Promise<BookingContext[]> {
  console.log("  Seeding event bookings and commissions...")

  const { sales, adminUserId, defaultCategoryByTour } = input
  const results: BookingContext[] = []

  // Create bookings only for the scenario-based sales (first 10)
  // to keep commissions referentially anchored to known amounts
  const bookableSales = sales.slice(0, SALE_SCENARIOS.length)

  for (let i = 0; i < bookableSales.length; i++) {
    const sale = bookableSales[i]
    if (!sale.eventId) continue

    const passengerCount = faker.number.int({ min: 1, max: 4 })

    const booking = await prisma.eventBooking.create({
      data: {
        eventId: sale.eventId,
        saleRecordId: sale.saleId,
        passengerCount,
        cancelled: false,
      },
    })

    // Price entry
    const catId = defaultCategoryByTour.get(sale.tourId)
    if (catId) {
      await prisma.bookingPriceEntry.create({
        data: {
          eventBookingId: booking.id,
          tourPriceCategoryId: catId,
          count: passengerCount,
          priceSnapshot: sale.total / passengerCount,
          categoryName: "Adulto",
        },
      })
    }

    // Commission (REGULAR kind, one per booking)
    const commissionAmount =
      Math.round(sale.total * COMMISSION_RATE * 100) / 100

    await prisma.eventBookingCommission.create({
      data: {
        eventBookingId: booking.id,
        paidById: adminUserId,
        kind: "REGULAR",
        percentage: COMMISSION_RATE * 100,
        baseAmount: sale.total,
        commissionAmount,
        totalPaid: commissionAmount,
        paidAt: new Date(),
      },
    })

    results.push({
      bookingId: booking.id,
      saleId: sale.saleId,
      eventId: sale.eventId,
      commissionAmount,
    })
  }

  console.log(`    Created ${results.length} event bookings with commissions.`)
  return results
}
