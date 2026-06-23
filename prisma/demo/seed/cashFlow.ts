/**
 * Seed: cash flow (star domain — ≥30 entries).
 *
 * Creates CashBox records (one per day around center date),
 * CashBoxEntry records linked to sales cash payments,
 * CashCount (opening/closing) and CashDeposit records.
 *
 * Must run after sales (cash amounts come from SaleContext).
 */

import { faker } from "@faker-js/faker"
// Direct relative path — @generated/* alias is resolved by Next/tsc but not by tsx at runtime.
import type { PrismaClient } from "../../../../src/generated/prisma/client"
import type { SaleContext } from "./sales"

faker.seed(48)

const CENTER = new Date("2026-06-23")

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

function toDate(d: Date): Date {
  return new Date(`${d.toISOString().substring(0, 10)}T00:00:00.000Z`)
}

interface CashFlowInput {
  sales: SaleContext[]
  adminUserId: string
}

export async function seedCashFlow(
  prisma: PrismaClient,
  input: CashFlowInput,
): Promise<void> {
  console.log("  Seeding cash flow...")

  const { sales, adminUserId } = input

  // Create 30 days of cash boxes: 15 past + present + 14 future
  const days = Array.from({ length: 30 }, (_, i) => addDays(CENTER, i - 15))

  let totalEntries = 0

  for (let di = 0; di < days.length; di++) {
    const day = days[di]
    const initialBalance = faker.number.int({ min: 50000, max: 200000 })

    const cashBox = await prisma.cashBox.create({
      data: {
        date: toDate(day),
        initialBalance,
        initialUsdBalance: 0,
        status: di < 15 ? "CLOSED" : "OPEN",
        finalBalance: di < 15 ? initialBalance + faker.number.int({ min: 10000, max: 100000 }) : null,
      },
    })

    // Opening count
    await prisma.cashCount.create({
      data: {
        cashBoxId: cashBox.id,
        type: "OPENING",
        countedAmount: initialBalance,
        expectedAmount: initialBalance,
        difference: 0,
        createdById: adminUserId,
      },
    })

    // Closing count for past days
    if (di < 15) {
      await prisma.cashCount.create({
        data: {
          cashBoxId: cashBox.id,
          type: "CLOSING",
          countedAmount: cashBox.finalBalance!,
          expectedAmount: cashBox.finalBalance!,
          difference: 0,
          createdById: adminUserId,
        },
      })
    }

    // Cash entries: INCOME entries from sales that have cash payments on this day
    const daySales = sales.filter(
      (s) =>
        s.cashPaymentAmount > 0 &&
        faker.datatype.boolean(), // random selection to distribute
    )
    for (const sale of daySales.slice(0, 3)) {
      if (sale.cashPaymentAmount <= 0) continue
      await prisma.cashBoxEntry.create({
        data: {
          cashBoxId: cashBox.id,
          type: "INCOME",
          amount: sale.cashPaymentAmount,
          currency: "CLP",
          description: `Venta voucher #${sale.voucher}`,
          reference: String(sale.voucher),
          paymentMethod: "CASH",
          createdById: adminUserId,
          paymentRecordId: null,
        },
      })
      totalEntries++
    }

    // Additional INCOME entry (non-sale)
    await prisma.cashBoxEntry.create({
      data: {
        cashBoxId: cashBox.id,
        type: "INCOME",
        amount: faker.number.int({ min: 10000, max: 80000 }),
        currency: "CLP",
        description: "Pago de cliente en caja",
        paymentMethod: "CASH",
        createdById: adminUserId,
      },
    })
    totalEntries++

    // DEPOSIT entry (bank withdrawal)
    if (di % 3 === 0) {
      const depositAmount = faker.number.int({ min: 50000, max: 200000 })
      await prisma.cashBoxEntry.create({
        data: {
          cashBoxId: cashBox.id,
          type: "DEPOSIT",
          amount: -depositAmount,
          currency: "CLP",
          description: "Depósito a cuenta bancaria",
          paymentMethod: "TRANSFER",
          createdById: adminUserId,
        },
      })
      await prisma.cashDeposit.create({
        data: {
          cashBoxId: cashBox.id,
          amount: depositAmount,
          bankAccount: "Cuenta Corriente Demo Bank",
          reference: `DEP-${faker.string.numeric(6)}`,
          createdById: adminUserId,
        },
      })
      totalEntries++
    }

    // SUPPLIER_PAYMENT entry
    if (di % 5 === 0) {
      const supplierAmount = faker.number.int({ min: 30000, max: 80000 })
      await prisma.cashBoxEntry.create({
        data: {
          cashBoxId: cashBox.id,
          type: "SUPPLIER_PAYMENT",
          amount: -supplierAmount,
          currency: "CLP",
          description: "Pago a proveedor de tours",
          paymentMethod: "CASH",
          createdById: adminUserId,
        },
      })
      await prisma.supplierPayment.create({
        data: {
          cashBoxId: cashBox.id,
          amount: supplierAmount,
          supplier: faker.company.name(),
          concept: "Servicios de guía y transporte",
          createdById: adminUserId,
        },
      })
      totalEntries++
    }
  }

  console.log(`    Created 30 cash boxes with ${totalEntries}+ entries.`)
}
