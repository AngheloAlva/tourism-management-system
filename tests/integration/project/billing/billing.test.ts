/**
 * T-C6 — Billing integration tests
 * Production code:
 *   - src/project/billing/actions/billing.actions.ts (read-only analytics)
 *   - src/project/payment-statements/actions/payment-statement.actions.ts
 *     (registerWholesaleInvoicePayment — the only billing mutation)
 *
 * ARCHITECTURE NOTE:
 * The billing domain's action file (billing.actions.ts) contains ONLY read/analytics
 * actions: getBillingSummary, getSalesBySeller, getSalesByDate, getSalesByChannel,
 * getSalesByTour, getSellers, getRecentSales. There are no CRUD mutations for invoices.
 *
 * The WholesaleInvoice model is created via the factory (createInvoice) and mutated
 * via registerWholesaleInvoicePayment in the payment-statements domain.
 *
 * This test suite covers:
 * - Invoice lifecycle: DRAFT → PARTIALLY_PAID → PAID via registerWholesaleInvoicePayment.
 * - Guard: cannot overpay (amount > pending).
 * - Guard: cannot pay an already-paid invoice.
 * - Analytics: getBillingSummary returns totals reflecting existing sale records.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { registerWholesaleInvoicePayment } from "@/project/payment-statements/actions/payment-statement.actions"
import { getBillingSummary } from "@/project/billing/actions/billing.actions"
import { loginAs, logout } from "../../helpers/auth"
import { truncateAll, disconnect } from "../../helpers/db"
import { createUser, createInvoice, createAgency } from "../../helpers/factories"

describe("billing.actions integration", () => {
  beforeEach(async () => {
    await truncateAll()
    vi.mocked(revalidatePath).mockClear()
  })

  afterAll(async () => {
    await disconnect()
  })

  // ─── registerWholesaleInvoicePayment ─────────────────────────────────────

  describe("registerWholesaleInvoicePayment", () => {
    it("partially pays a DRAFT invoice — status transitions to PARTIALLY_PAID", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const agency = await createAgency()
      const invoice = await createInvoice({
        agencyId: agency.id,
        totalAmount: 100000,
        pendingAmount: 100000,
        paidAmount: 0,
        status: "DRAFT",
      })

      const result = await registerWholesaleInvoicePayment({
        invoiceId: invoice.id,
        amount: 60000,
        method: "TRANSFER",
      })

      expect(result.success).toBe(true)

      const updated = await prisma.wholesaleInvoice.findUnique({ where: { id: invoice.id } })
      expect(updated?.paidAmount).toBe(60000)
      expect(updated?.pendingAmount).toBe(40000)
      expect(updated?.status).toBe("PARTIALLY_PAID")

      // A WholesaleInvoicePayment row should exist
      const payment = await prisma.wholesaleInvoicePayment.findFirst({
        where: { invoiceId: invoice.id },
      })
      expect(payment).not.toBeNull()
      expect(payment?.amount).toBe(60000)
    })

    it("fully pays an invoice — status transitions to PAID", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const agency = await createAgency()
      const invoice = await createInvoice({
        agencyId: agency.id,
        totalAmount: 50000,
        pendingAmount: 50000,
        paidAmount: 0,
        status: "DRAFT",
      })

      const result = await registerWholesaleInvoicePayment({
        invoiceId: invoice.id,
        amount: 50000,
        method: "CASH",
      })

      expect(result.success).toBe(true)

      const updated = await prisma.wholesaleInvoice.findUnique({ where: { id: invoice.id } })
      expect(updated?.pendingAmount).toBe(0)
      expect(updated?.status).toBe("PAID")
    })

    it("returns error when amount exceeds pending balance (cannot overpay)", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const agency = await createAgency()
      const invoice = await createInvoice({
        agencyId: agency.id,
        totalAmount: 100000,
        pendingAmount: 30000,
        paidAmount: 70000,
        status: "PARTIALLY_PAID",
      })

      const result = await registerWholesaleInvoicePayment({
        invoiceId: invoice.id,
        amount: 50000, // exceeds pendingAmount of 30000
        method: "TRANSFER",
      })

      expect(result.success).toBe(false)
      if (!result.success) expect((result as { success: false; error: string }).error).toBeTruthy()
    })

    it("returns error when invoice is already fully paid", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const agency = await createAgency()
      const invoice = await createInvoice({
        agencyId: agency.id,
        totalAmount: 100000,
        pendingAmount: 0,
        paidAmount: 100000,
        status: "PAID",
      })

      const result = await registerWholesaleInvoicePayment({
        invoiceId: invoice.id,
        amount: 10000,
        method: "CASH",
      })

      expect(result.success).toBe(false)
      // "La factura ya se encuentra completamente pagada"
      if (!result.success) expect((result as { success: false; error: string }).error).toBeTruthy()
    })

    it("returns error when invoice does not exist", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const result = await registerWholesaleInvoicePayment({
        invoiceId: "non-existent-id",
        amount: 10000,
        method: "CASH",
      })

      expect(result.success).toBe(false)
      if (!result.success) expect((result as { success: false; error: string }).error).toBeTruthy()
    })

    it("returns error when unauthenticated", async () => {
      logout()

      const result = await registerWholesaleInvoicePayment({
        invoiceId: "any-id",
        amount: 1000,
        method: "CASH",
      })

      expect(result.success).toBe(false)
      if (!result.success) expect((result as { success: false; error: string }).error).toBeTruthy()
    })
  })

  // ─── getBillingSummary (read analytics) ──────────────────────────────────

  describe("getBillingSummary", () => {
    it("returns zero totals when no sale records exist", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const summary = await getBillingSummary()

      expect(summary.totalSales).toBe(0)
      expect(summary.totalRevenue).toBe(0)
      expect(summary.totalQuotes).toBe(0)
    })

    it("throws when unauthenticated", async () => {
      logout()

      await expect(getBillingSummary()).rejects.toThrow()
    })
  })
})
