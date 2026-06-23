/**
 * Spec: "Referential chain is intact" (unit-scope)
 *
 * Tests that the seed's monetary constants are internally coherent:
 *   - Sale total equals the sum of its payment record amounts.
 *   - Commission amount is a deterministic percentage of the base amount.
 *   - Invoice total equals sum of lines minus discounts.
 *
 * This is a pure unit test — no database, no Prisma. It validates the constant
 * definitions that the seed modules use so a bad merge doesn't silently break
 * referential integrity.
 */

import { describe, it, expect } from "vitest"
import {
  SALE_SCENARIOS,
  COMMISSION_RATE,
  INVOICE_SCENARIOS,
} from "../../../prisma/demo/seed/constants"

describe("Demo seed — monetary reconciliation", () => {
  it("each sale scenario: payment amounts sum to the sale total", () => {
    for (const scenario of SALE_SCENARIOS) {
      const paymentSum = scenario.payments.reduce(
        (acc, p) => acc + p.amount,
        0,
      )
      expect(paymentSum).toBeCloseTo(scenario.saleTotal, 2)
    }
  })

  it("SALE_SCENARIOS has at least 5 entries", () => {
    expect(SALE_SCENARIOS.length).toBeGreaterThanOrEqual(5)
  })

  it("commission amount = percentage * base amount for every scenario", () => {
    for (const scenario of SALE_SCENARIOS) {
      const expected = Math.round(scenario.saleTotal * COMMISSION_RATE * 100) / 100
      expect(scenario.commissionAmount).toBeCloseTo(expected, 2)
    }
  })

  it("each invoice scenario: line net amounts sum to the invoice total", () => {
    for (const inv of INVOICE_SCENARIOS) {
      const lineSum = inv.lines.reduce((acc, l) => acc + l.netAmount, 0)
      expect(lineSum).toBeCloseTo(inv.totalAmount, 2)
    }
  })

  it("INVOICE_SCENARIOS has at least 3 entries", () => {
    expect(INVOICE_SCENARIOS.length).toBeGreaterThanOrEqual(3)
  })
})
