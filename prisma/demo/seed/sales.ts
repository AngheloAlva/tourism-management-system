/**
 * Seed: sale records + passengers + payment records (star domain — ≥30 records).
 *
 * Business rules (from README):
 *   - SaleRecord has Passengers and PaymentRecords whose sum == sale total.
 *   - Channel: ONLINE | AGENCY | PHYSICAL | WHOLESALE
 *   - Type: SALE | QUOTE
 *   - Payments: CASH | TRANSFER | CREDIT_CARD | DEBIT_CARD | PAYMENT_LINK_DEBIT | PAYMENT_LINK_CREDIT
 *
 * Returns a map: saleId → { total, tourId, eventId? } for bookings + cash flow.
 */

import { faker } from "@faker-js/faker"
// Direct relative path — @generated/* alias is resolved by Next/tsc but not by tsx at runtime.
import type { PrismaClient } from "../../../../src/generated/prisma/client"
import { SALE_SCENARIOS } from "./constants"

faker.seed(46)

const NATIONALITIES = [
  "Chilena", "Argentina", "Brasileña", "Francesa", "Alemana",
  "Italiana", "Española", "Estadounidense", "Australiana", "Peruana",
]

const HOTELS = [
  "Hotel Jardín de Atacama",
  "Casa Corona Boutique",
  "Altiplanico Sur",
  "Tierra Atacama",
  "Hotel Cumbres",
  "Hostal Sonchek",
]

const DIET_TYPES = ["NORMAL", "VEGETARIAN", "VEGAN", "CELIAC", "OTHER"] as const

export interface SaleContext {
  saleId: string
  voucher: number
  total: number
  tourId: string
  agencyId?: string
  eventId?: string
  sellerId: string
  cashPaymentAmount: number // Amount paid via CASH (for cash flow)
}

interface SalesInput {
  sellerUserIds: string[]
  agencyIds: string[]
  tourIds: string[]
  eventIds: string[]
}

export async function seedSales(
  prisma: PrismaClient,
  input: SalesInput,
): Promise<SaleContext[]> {
  console.log("  Seeding sales records...")

  const { sellerUserIds, agencyIds, tourIds, eventIds } = input
  const results: SaleContext[] = []

  // --- Batch A: use SALE_SCENARIOS constants (10 scenarios, unit-tested) ---
  for (let i = 0; i < SALE_SCENARIOS.length; i++) {
    const scenario = SALE_SCENARIOS[i]
    const sellerId = sellerUserIds[i % sellerUserIds.length]
    const tourId = tourIds[i % tourIds.length]
    const isAgency = i % 4 === 0
    const agencyId = isAgency ? agencyIds[i % agencyIds.length] : undefined
    const eventId = eventIds[i % eventIds.length]

    const centerDate = new Date("2026-06-23")
    const saleDate = new Date(centerDate)
    saleDate.setDate(saleDate.getDate() - i * 2)

    const sale = await prisma.saleRecord.create({
      data: {
        voucher: scenario.voucher,
        type: "SALE",
        channel: isAgency ? "AGENCY" : (i % 3 === 0 ? "ONLINE" : "PHYSICAL"),
        status: i < 7 ? "COMPLETED" : "IN_PROGRESS",
        sellerId,
        agencyId,
        clientEmail: `cliente${i + 1}@example.com`,
        fileNumber: `F-${String(scenario.voucher).padStart(5, "0")}`,
        discount: 0,
        isWholesale: false,
        firstEventDate: new Date(`${saleDate.toISOString().substring(0, 10)}T00:00:00.000Z`),
        createdAt: saleDate,
      },
    })

    // Passengers (2 per sale)
    const hotel = HOTELS[i % HOTELS.length]
    for (let p = 0; p < 2; p++) {
      await prisma.passenger.create({
        data: {
          saleRecordId: sale.id,
          name: faker.person.fullName(),
          document: `${faker.string.numeric(8)}-${faker.string.numeric(1)}`,
          age: faker.number.int({ min: 18, max: 75 }),
          nationality: NATIONALITIES[faker.number.int({ min: 0, max: NATIONALITIES.length - 1 })],
          diet: DIET_TYPES[faker.number.int({ min: 0, max: DIET_TYPES.length - 1 })],
          phone: `+569${faker.string.numeric(8)}`,
          email: faker.internet.email(),
          hotels: {
            create: [
              {
                hotelName: hotel,
                checkIn: new Date(`${saleDate.toISOString().substring(0, 10)}T00:00:00.000Z`),
                checkOut: new Date(new Date(saleDate.getTime() + 3 * 86400000).toISOString().substring(0, 10) + "T00:00:00.000Z"),
              },
            ],
          },
        },
      })
    }

    // Payment records (from scenario)
    let cashAmount = 0
    for (const payment of scenario.payments) {
      const payDate = new Date(saleDate)
      await prisma.paymentRecord.create({
        data: {
          saleRecordId: sale.id,
          refund: false,
          method: payment.method as "CASH" | "TRANSFER" | "CREDIT_CARD" | "DEBIT_CARD" | "PAYMENT_LINK_DEBIT" | "PAYMENT_LINK_CREDIT",
          amount: payment.amount,
          currency: "CLP",
          date: payDate,
          documentNumber: `DOC-${faker.string.numeric(6)}`,
        },
      })
      if (payment.method === "CASH") cashAmount += payment.amount
    }

    results.push({
      saleId: sale.id,
      voucher: scenario.voucher,
      total: scenario.saleTotal,
      tourId,
      agencyId,
      eventId,
      sellerId,
      cashPaymentAmount: cashAmount,
    })
  }

  // --- Batch B: additional faker-based sales to reach ≥30 total ---
  const extraCount = 22 // 10 + 22 = 32 total
  const extraVoucherStart = 2000

  for (let i = 0; i < extraCount; i++) {
    const sellerId = sellerUserIds[i % sellerUserIds.length]
    const tourId = tourIds[(i + 3) % tourIds.length]
    const isAgency = i % 5 === 0
    const agencyId = isAgency ? agencyIds[i % agencyIds.length] : undefined
    const eventId = eventIds[(i + 5) % eventIds.length]

    const centerDate = new Date("2026-06-23")
    const saleDate = new Date(centerDate)
    saleDate.setDate(saleDate.getDate() - (20 + i))

    const saleTotal = faker.number.int({ min: 50000, max: 300000 })
    const voucher = extraVoucherStart + i

    const sale = await prisma.saleRecord.create({
      data: {
        voucher,
        type: i % 6 === 0 ? "QUOTE" : "SALE",
        channel: isAgency ? "AGENCY" : faker.helpers.arrayElement(["ONLINE", "PHYSICAL"] as const),
        status: faker.helpers.arrayElement(["TO_BE_DONE", "COMPLETED", "IN_PROGRESS"] as const),
        sellerId,
        agencyId,
        clientEmail: faker.internet.email(),
        fileNumber: `F-${String(voucher).padStart(5, "0")}`,
        discount: 0,
        isWholesale: false,
        firstEventDate: new Date(`${saleDate.toISOString().substring(0, 10)}T00:00:00.000Z`),
        createdAt: saleDate,
      },
    })

    // Single passenger
    await prisma.passenger.create({
      data: {
        saleRecordId: sale.id,
        name: faker.person.fullName(),
        age: faker.number.int({ min: 18, max: 70 }),
        nationality: NATIONALITIES[i % NATIONALITIES.length],
        diet: "NORMAL",
        phone: `+569${faker.string.numeric(8)}`,
      },
    })

    // Single payment
    const method = faker.helpers.arrayElement(["CASH", "TRANSFER", "CREDIT_CARD"] as const)
    await prisma.paymentRecord.create({
      data: {
        saleRecordId: sale.id,
        refund: false,
        method,
        amount: saleTotal,
        currency: "CLP",
        date: saleDate,
        documentNumber: `DOC-${faker.string.numeric(6)}`,
      },
    })

    results.push({
      saleId: sale.id,
      voucher,
      total: saleTotal,
      tourId,
      agencyId,
      eventId,
      sellerId,
      cashPaymentAmount: method === "CASH" ? saleTotal : 0,
    })
  }

  console.log(`    Created ${results.length} sale records with passengers and payments.`)
  return results
}
