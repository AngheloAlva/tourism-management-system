/**
 * Seed: wholesale invoices + lines + payments (≥10 invoices).
 *
 * Invoice total = sum of line netAmounts.
 * Each invoice is linked to an agency and optionally a sale.
 *
 * Must run after agencies and sales (WholesaleInvoiceLine references SaleRecord).
 * Note: WholesaleInvoiceLine has a @unique on saleRecordId — only one line per sale.
 */

import { faker } from "@faker-js/faker"
// Direct relative path — @generated/* alias is resolved by Next/tsc but not by tsx at runtime.
import type { PrismaClient } from "../../../../src/generated/prisma/client"
import { INVOICE_SCENARIOS } from "./constants"
import type { SaleContext } from "./sales"

faker.seed(49)

const CENTER = new Date("2026-06-23")

function toDate(d: Date): Date {
  return new Date(`${d.toISOString().substring(0, 10)}T00:00:00.000Z`)
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

interface InvoicesInput {
  agencyIds: string[]
  sales: SaleContext[]
}

export async function seedInvoices(
  prisma: PrismaClient,
  input: InvoicesInput,
): Promise<void> {
  console.log("  Seeding wholesale invoices...")

  const { agencyIds, sales } = input

  // Agency sales (from the constant scenarios) — find ones with agencyId
  const agencySales = sales.filter((s) => s.agencyId)

  let invoiceCount = 0

  // --- Scenario-based invoices (unit-tested) ---
  for (let i = 0; i < INVOICE_SCENARIOS.length; i++) {
    const inv = INVOICE_SCENARIOS[i]
    const agencyId = agencyIds[i % agencyIds.length]
    const periodStart = addDays(CENTER, -(30 - i * 5))
    const periodEnd = addDays(CENTER, -(25 - i * 5))

    const invoice = await prisma.wholesaleInvoice.create({
      data: {
        number: inv.number,
        agencyId,
        status: i < 3 ? "PAID" : "ISSUED",
        documentStatus: "GENERATED",
        currency: "CLP",
        subtotal: inv.lines.reduce((s, l) => s + l.grossAmount, 0),
        discountAmount: inv.lines.reduce((s, l) => s + l.discountAmount, 0),
        taxAmount: 0,
        totalAmount: inv.totalAmount,
        paidAmount: i < 3 ? inv.totalAmount : 0,
        pendingAmount: i < 3 ? 0 : inv.totalAmount,
        periodStart: toDate(periodStart) as unknown as Date,
        periodEnd: toDate(periodEnd) as unknown as Date,
        issuedAt: periodStart,
        dueAt: toDate(addDays(periodEnd, 30)) as unknown as Date,
      },
    })

    // Lines (attach to agency sales if available, else standalone)
    for (let li = 0; li < inv.lines.length; li++) {
      const line = inv.lines[li]
      const saleCtx = agencySales[(i * 2 + li) % Math.max(agencySales.length, 1)]

      if (saleCtx) {
        // Check if this saleRecord already has a WholesaleInvoiceLine
        const existing = await prisma.wholesaleInvoiceLine.findUnique({
          where: { saleRecordId: saleCtx.saleId },
        })
        if (!existing) {
          await prisma.wholesaleInvoiceLine.create({
            data: {
              invoiceId: invoice.id,
              saleRecordId: saleCtx.saleId,
              description: line.description,
              grossAmount: line.grossAmount,
              discountAmount: line.discountAmount,
              netAmount: line.netAmount,
            },
          })
        }
      }
    }

    // Payment for paid invoices
    if (i < 3) {
      await prisma.wholesaleInvoicePayment.create({
        data: {
          invoiceId: invoice.id,
          method: "TRANSFER",
          currency: "CLP",
          amount: inv.totalAmount,
          paymentDate: toDate(addDays(periodEnd, 5)),
          reference: `PAG-${faker.string.numeric(6)}`,
        },
      })
    }

    invoiceCount++
  }

  // --- Additional invoices to reach ≥10 ---
  for (let i = 0; i < 5; i++) {
    const agencyId = agencyIds[(i + 2) % agencyIds.length]
    const periodStart = addDays(CENTER, -(60 + i * 7))
    const periodEnd = addDays(CENTER, -(53 + i * 7))
    const totalAmount = faker.number.int({ min: 100000, max: 500000 })

    await prisma.wholesaleInvoice.create({
      data: {
        number: `F-EXT-${String(i + 1).padStart(3, "0")}`,
        agencyId,
        status: "PAID",
        documentStatus: "SENT",
        currency: "CLP",
        subtotal: totalAmount,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount,
        paidAmount: totalAmount,
        pendingAmount: 0,
        periodStart: toDate(periodStart) as unknown as Date,
        periodEnd: toDate(periodEnd) as unknown as Date,
        issuedAt: periodStart,
        dueAt: toDate(addDays(periodEnd, 30)) as unknown as Date,
      },
    })
    invoiceCount++
  }

  console.log(`    Created ${invoiceCount} wholesale invoices.`)
}
