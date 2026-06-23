import { describe, expect, it } from "vitest"
import { paymentsAffectingCashChanged } from "@/project/sales/utils/payment-cash-diff"

describe("paymentsAffectingCashChanged", () => {
  it("returns false when both lists are empty", () => {
    expect(paymentsAffectingCashChanged([], [])).toBe(false)
  })

  it("returns false when payments are identical (same amounts/methods/currency)", () => {
    const payments = [
      { amount: 50000, method: "CASH", currency: "CLP", refund: false },
    ]
    expect(paymentsAffectingCashChanged(payments, payments)).toBe(false)
  })

  it("returns true when amount changes", () => {
    const old = [{ amount: 50000, method: "CASH", currency: "CLP", refund: false }]
    const next = [{ amount: 80000, method: "CASH", currency: "CLP", refund: false }]
    expect(paymentsAffectingCashChanged(old, next)).toBe(true)
  })

  it("returns true when method changes", () => {
    const old = [{ amount: 50000, method: "CASH", currency: "CLP", refund: false }]
    const next = [{ amount: 50000, method: "TRANSFER", currency: "CLP", refund: false }]
    expect(paymentsAffectingCashChanged(old, next)).toBe(true)
  })

  it("returns true when a payment is added", () => {
    const old = [{ amount: 50000, method: "CASH", currency: "CLP", refund: false }]
    const next = [
      { amount: 50000, method: "CASH", currency: "CLP", refund: false },
      { amount: 30000, method: "TRANSFER", currency: "CLP", refund: false },
    ]
    expect(paymentsAffectingCashChanged(old, next)).toBe(true)
  })

  it("returns true when a payment is removed", () => {
    const old = [
      { amount: 50000, method: "CASH", currency: "CLP", refund: false },
      { amount: 30000, method: "TRANSFER", currency: "CLP", refund: false },
    ]
    const next = [{ amount: 50000, method: "CASH", currency: "CLP", refund: false }]
    expect(paymentsAffectingCashChanged(old, next)).toBe(true)
  })

  it("returns false when only a refund flag is toggled on a zero-impact payment (refund=true)", () => {
    // A payment with refund=true is filtered out — changing it from false to true
    // removes it from the cash-affecting set on both sides equally
    const old = [
      { amount: 50000, method: "CASH", currency: "CLP", refund: false },
      { amount: 10000, method: "CASH", currency: "CLP", refund: true }, // this one is already a refund — not cash-affecting
    ]
    const next = [
      { amount: 50000, method: "CASH", currency: "CLP", refund: false },
      { amount: 10000, method: "CASH", currency: "CLP", refund: true }, // same refund — still not cash-affecting
    ]
    expect(paymentsAffectingCashChanged(old, next)).toBe(false)
  })

  it("returns true when a payment transitions from refund=false to refund=true (removes it from cash-affecting set)", () => {
    const old = [
      { amount: 50000, method: "CASH", currency: "CLP", refund: false },
      { amount: 10000, method: "CASH", currency: "CLP", refund: false },
    ]
    const next = [
      { amount: 50000, method: "CASH", currency: "CLP", refund: false },
      { amount: 10000, method: "CASH", currency: "CLP", refund: true }, // now a refund → removed from cash-affecting set
    ]
    expect(paymentsAffectingCashChanged(old, next)).toBe(true)
  })

  it("returns false when reordering identical payments (multiset, order-insensitive)", () => {
    const old = [
      { amount: 50000, method: "CASH", currency: "CLP", refund: false },
      { amount: 30000, method: "TRANSFER", currency: "CLP", refund: false },
    ]
    const next = [
      { amount: 30000, method: "TRANSFER", currency: "CLP", refund: false },
      { amount: 50000, method: "CASH", currency: "CLP", refund: false },
    ]
    expect(paymentsAffectingCashChanged(old, next)).toBe(false)
  })

  it("handles duplicate amounts correctly (multiset counting)", () => {
    const old = [
      { amount: 50000, method: "CASH", currency: "CLP", refund: false },
      { amount: 50000, method: "CASH", currency: "CLP", refund: false },
    ]
    const next = [
      { amount: 50000, method: "CASH", currency: "CLP", refund: false },
    ]
    expect(paymentsAffectingCashChanged(old, next)).toBe(true)
  })

  it("returns false when only a zero-amount payment changes (zero-amount is not cash-affecting)", () => {
    const old = [
      { amount: 50000, method: "CASH", currency: "CLP", refund: false },
      { amount: 0, method: "CASH", currency: "CLP", refund: false }, // zero-amount: not cash-affecting
    ]
    const next = [
      { amount: 50000, method: "CASH", currency: "CLP", refund: false },
    ]
    // Removing a zero-amount payment should NOT trigger recalc
    expect(paymentsAffectingCashChanged(old, next)).toBe(false)
  })

  it("handles USD currency in the canonical key", () => {
    const old = [{ amount: 100, method: "CASH", currency: "USD", refund: false }]
    const next = [{ amount: 200, method: "CASH", currency: "USD", refund: false }]
    expect(paymentsAffectingCashChanged(old, next)).toBe(true)
  })

  it("treats same amount in USD vs CLP as different (different canonical key)", () => {
    const old = [{ amount: 100, method: "CASH", currency: "USD", refund: false }]
    const next = [{ amount: 100, method: "CASH", currency: "CLP", refund: false }]
    expect(paymentsAffectingCashChanged(old, next)).toBe(true)
  })
})
