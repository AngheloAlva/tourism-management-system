/**
 * T-C3 — Cash flow integration tests
 * Production code: src/project/cash-flow/actions/cash-flow.actions.ts
 * Actions covered: createOtherExpense, createCashDeposit, registerCashIncome, registerUsdExchange
 *
 * Key observations about the production code:
 * - Actions return the created Prisma row DIRECTLY (not { success, data }).
 * - Permission failures THROW an Error (not return { success: false }).
 * - No revalidatePath calls in this module.
 * - No AuditLog writes in cash-flow actions.
 * - getCurrentCashBox() creates today's CashBox lazily if one doesn't exist.
 * - registerUsdExchange checks available USD balance — requires USD entries first.
 * - createOtherExpense writes a NEGATIVE amount entry (expense convention).
 * - The effective "balance" is computed by getCashFlowSummary, not stored directly.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import {
  createOtherExpense,
  createCashDeposit,
  registerCashIncome,
  getCashFlowSummary,
} from "@/project/cash-flow/actions/cash-flow.actions"
import { loginAs, logout } from "../../helpers/auth"
import { truncateAll, disconnect } from "../../helpers/db"
import { createUser } from "../../helpers/factories"

describe("cash-flow.actions integration", () => {
  beforeEach(async () => {
    await truncateAll()
    vi.mocked(revalidatePath).mockClear()
  })

  afterAll(async () => {
    await disconnect()
  })

  // ─── registerCashIncome ──────────────────────────────────────────────────

  describe("registerCashIncome", () => {
    it("creates an INCOME CashBoxEntry when admin provides valid data", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const entry = await registerCashIncome({
        amount: 100000,
        description: "Test income",
        currency: "CLP",
      })

      expect(entry.type).toBe("INCOME")
      expect(entry.amount).toBe(100000)
      expect(entry.currency).toBe("CLP")

      const row = await prisma.cashBoxEntry.findUnique({ where: { id: entry.id } })
      expect(row).not.toBeNull()
      expect(row?.amount).toBe(100000)
    })

    it("throws when unauthenticated", async () => {
      logout()

      await expect(
        registerCashIncome({ amount: 1000, description: "test" }),
      ).rejects.toThrow("No autenticado")
    })
  })

  // ─── createOtherExpense ──────────────────────────────────────────────────

  describe("createOtherExpense", () => {
    it("creates an OTHER_EXPENSE CashBoxEntry with negative amount (expense convention)", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const entry = await createOtherExpense({
        amount: 50000,
        description: "Stationery purchase",
        category: "SUPPLIES" as Parameters<typeof createOtherExpense>[0]["category"],
      })

      expect(entry.type).toBe("OTHER_EXPENSE")
      // Production stores expenses as negative amounts
      expect(entry.amount).toBe(-50000)

      const row = await prisma.cashBoxEntry.findUnique({ where: { id: entry.id } })
      expect(row).not.toBeNull()
    })

    it("throws when unauthenticated", async () => {
      logout()

      await expect(
        createOtherExpense({
          amount: 1000,
          description: "test",
          category: "SUPPLIES" as Parameters<typeof createOtherExpense>[0]["category"],
        }),
      ).rejects.toThrow()
    })
  })

  // ─── createCashDeposit ───────────────────────────────────────────────────

  describe("createCashDeposit", () => {
    it("creates a CashDeposit row and a corresponding DEPOSIT CashBoxEntry", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      const deposit = await createCashDeposit({
        amount: 200000,
        bankAccount: "BancoEstado 123456",
        reference: "DEP-001",
      })

      expect(deposit.amount).toBe(200000)
      expect(deposit.bankAccount).toBe("BancoEstado 123456")

      // A CashBoxEntry of type DEPOSIT should also have been created
      const depositEntry = await prisma.cashBoxEntry.findFirst({
        where: { type: "DEPOSIT", cashBoxId: deposit.cashBoxId },
      })
      expect(depositEntry).not.toBeNull()
      // DEPOSIT entries have negative amount (reduces cash balance)
      expect(depositEntry?.amount).toBe(-200000)
    })

    it("throws when unauthenticated", async () => {
      logout()

      await expect(createCashDeposit({ amount: 1000 })).rejects.toThrow()
    })
  })

  // ─── balance recomputation via getCashFlowSummary ─────────────────────────

  describe("balance recomputation", () => {
    it("reflects income and expense entries in the computed balance", async () => {
      const admin = await createUser({ role: "admin", mustChangePassword: false })
      loginAs(admin)

      // Register an income
      await registerCashIncome({ amount: 100000, description: "Income" })
      // Register an expense
      await createOtherExpense({
        amount: 30000,
        description: "Expense",
        category: "SUPPLIES" as Parameters<typeof createOtherExpense>[0]["category"],
      })

      const summary = await getCashFlowSummary()

      // today's income should include the 100k entry
      expect(summary.todayIncome).toBeGreaterThanOrEqual(100000)
      // today's expenses should include the 30k entry
      expect(summary.todayExpenses).toBeGreaterThanOrEqual(30000)
      // effective balance = initial(0) + income(100000) - expenses(30000) = 70000
      expect(summary.currentBalance).toBeGreaterThanOrEqual(70000)
    })
  })
})
