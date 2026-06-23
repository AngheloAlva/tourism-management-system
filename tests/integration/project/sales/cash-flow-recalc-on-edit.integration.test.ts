/**
 * T-CF1 — Cash-flow recalculation on sale edit (integration tests)
 * Production code: src/project/sales/actions/sale-record.actions.ts (updateSaleRecord)
 *                  src/project/cash-flow/utils/cash-flow-internal.ts (recalculateSaleCashFlowOnEdit)
 *
 * NOTE: These tests require a running Docker environment (PostgreSQL testcontainer).
 *       They were written as part of fix/cash-flow-recalc-on-sale-edit but CANNOT be run
 *       locally without Docker. They will run in CI automatically.
 *       Run with: pnpm test:integration (requires Docker running)
 *
 * Key invariants verified:
 * - Creating a SALE with a CASH payment registers a net income in cash flow.
 * - Editing the payment amount updates the cash-flow net to match the new amount.
 * - Re-editing again (idempotent recalculation) lands on the correct new net.
 * - Editing a non-payment field (e.g. comments) does NOT create new CashBoxEntry rows.
 * - Legacy self-heal: if existing entries are stale (amount mismatch), an edit that
 *   changes payments corrects the net to match the new total.
 * - USD sale: BOTH the CLP income total and the USD originalAmount balance heal
 *   correctly after an edit — no overstatement, no compounding (C1 regression guard).
 */

import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import {
  createSaleRecord as createSaleRecordAction,
  updateSaleRecord as updateSaleRecordAction,
} from "@/project/sales/actions/sale-record.actions"
import { loginAs, logout } from "../../helpers/auth"
import { truncateAll, disconnect } from "../../helpers/db"
import { createUser, createTour } from "../../helpers/factories"

/** Builds a valid updateSaleRecord payload for a sale with one payment. */
function salePayloadWithPayment(
  tourId: string,
  paymentAmount: number,
  overrides: Record<string, unknown> = {}
) {
  return {
    type: "SALE" as const,
    channel: "PHYSICAL" as const,
    isWholesale: false,
    paymentPending: false,
    fileNumberPending: false,
    discount: 0,
    passengerArray: [
      {
        name: "Test Passenger",
        age: 30,
        nacionality: "CL",
        allergies: [],
        hotels: [],
      },
    ],
    paymentArray: [
      {
        refund: false,
        method: "CASH" as const,
        currency: "CLP" as const,
        amount: paymentAmount,
        movement_date: new Date(),
      },
    ],
    eventBookings: [
      {
        mode: "REGULAR" as const,
        date: new Date(),
        tourId,
        startTime: "",
        endTime: "",
        priceEntries: [],
        entrySnapshots: [],
        excludedPassengers: [],
      },
    ],
    ...overrides,
  }
}

/** Sums all INCOME CashBoxEntry amounts for a given voucher reference "V-{n}". */
async function getCashNetForVoucher(voucher: number): Promise<number> {
  const entries = await prisma.cashBoxEntry.findMany({
    where: { reference: `V-${voucher}`, type: "INCOME" },
    select: { amount: true },
  })
  return entries.reduce((sum, e) => sum + e.amount, 0)
}

/** Returns all INCOME CashBoxEntry rows for a given voucher reference. */
async function getCashEntriesForVoucher(voucher: number) {
  return prisma.cashBoxEntry.findMany({
    where: { reference: `V-${voucher}`, type: "INCOME" },
    orderBy: { createdAt: "asc" },
  })
}

/**
 * Sums originalAmount for all INCOME entries with currency === "USD" for a voucher.
 * This mirrors getUsdNetMovement in cash-flow.actions.ts, which drives the displayed
 * USD balance.
 */
async function getUsdNetForVoucher(voucher: number): Promise<number> {
  const entries = await prisma.cashBoxEntry.findMany({
    where: { reference: `V-${voucher}`, type: "INCOME", currency: "USD" },
    select: { originalAmount: true },
  })
  return entries.reduce((sum, e) => sum + (e.originalAmount ?? 0), 0)
}

describe("cash-flow recalculation on sale edit (integration)", () => {
  beforeEach(async () => {
    await truncateAll()
    vi.mocked(revalidatePath).mockClear()
  })

  afterAll(async () => {
    await disconnect()
  })

  // ─── T-CF1-1: create then edit payment amount ────────────────────────────

  it("creates a SALE with payment=100, cash net is 100; edit to 150, net becomes 150", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    loginAs(admin)

    const tour = await createTour()

    // Create sale with 100 CLP payment
    const created = await createSaleRecordAction(salePayloadWithPayment(tour.id, 100))
    expect(created.success).toBe(true)
    const sale = created.data!
    const voucher = sale.voucher

    // Verify initial net
    const initialNet = await getCashNetForVoucher(voucher)
    expect(initialNet).toBeCloseTo(100, 5)

    // Edit: change payment to 150
    const updated = await updateSaleRecordAction(sale.id, salePayloadWithPayment(tour.id, 150))
    expect(updated.success).toBe(true)

    // Net must now be 150 (original +100, reversal -100, new +150 = net 150)
    const updatedNet = await getCashNetForVoucher(voucher)
    expect(updatedNet).toBeCloseTo(150, 5)

    // Original entry (the first +100) must still exist — we never mutate past entries
    const entries = await getCashEntriesForVoucher(voucher)
    const originalEntry = entries.find((e) => Math.abs(e.amount - 100) < 0.01)
    expect(originalEntry).toBeDefined()
  })

  // ─── T-CF1-2: idempotent recalculation (edit again) ──────────────────────

  it("edit to 150 then edit again to 80: net becomes 80 (idempotent across re-edits)", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    loginAs(admin)

    const tour = await createTour()

    const created = await createSaleRecordAction(salePayloadWithPayment(tour.id, 100))
    expect(created.success).toBe(true)
    const sale = created.data!
    const voucher = sale.voucher

    // First edit: 100 → 150
    const updated1 = await updateSaleRecordAction(sale.id, salePayloadWithPayment(tour.id, 150))
    expect(updated1.success).toBe(true)

    // Second edit: 150 → 80
    const updated2 = await updateSaleRecordAction(sale.id, salePayloadWithPayment(tour.id, 80))
    expect(updated2.success).toBe(true)

    const finalNet = await getCashNetForVoucher(voucher)
    expect(finalNet).toBeCloseTo(80, 5)
  })

  // ─── T-CF1-3: diff guard — no new rows when payments unchanged ───────────

  it("editing comments only (no payment change) does NOT create new CashBoxEntry rows", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    loginAs(admin)

    const tour = await createTour()

    const created = await createSaleRecordAction(salePayloadWithPayment(tour.id, 100))
    expect(created.success).toBe(true)
    const sale = created.data!
    const voucher = sale.voucher

    const entriesBefore = await getCashEntriesForVoucher(voucher)

    // Edit: change only comments, keep the same payment
    const updated = await updateSaleRecordAction(
      sale.id,
      salePayloadWithPayment(tour.id, 100, { comments: "solo un comentario sin cambiar pago" })
    )
    expect(updated.success).toBe(true)

    const entriesAfter = await getCashEntriesForVoucher(voucher)
    expect(entriesAfter.length).toBe(entriesBefore.length)

    // Net is still 100
    const net = await getCashNetForVoucher(voucher)
    expect(net).toBeCloseTo(100, 5)
  })

  // ─── T-CF1-4: legacy self-heal ───────────────────────────────────────────

  it("self-heals stale state: manually injected stale entry is corrected after an edit that changes payments", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    loginAs(admin)

    const tour = await createTour()

    const created = await createSaleRecordAction(salePayloadWithPayment(tour.id, 100))
    expect(created.success).toBe(true)
    const sale = created.data!
    const voucher = sale.voucher

    // Simulate legacy stale state: inject an extra orphan INCOME entry with wrong amount
    // (as if a previous buggy code path registered a second entry without reversing)
    const cashBox = await prisma.cashBox.findFirst({ where: { status: "OPEN" } })
    expect(cashBox).toBeDefined()
    await prisma.cashBoxEntry.create({
      data: {
        type: "INCOME",
        amount: 200, // stale/orphaned entry
        currency: "CLP",
        originalAmount: 200,
        description: "Entrada huérfana simulada (legacy stale)",
        reference: `V-${voucher}`,
        cashBoxId: cashBox!.id,
        createdById: admin.id,
      },
    })

    // Before edit: net is 100 + 200 = 300 (stale)
    const staleNet = await getCashNetForVoucher(voucher)
    expect(staleNet).toBeCloseTo(300, 5)

    // Edit payment to 120 → should reverse all 300 and re-register 120
    const updated = await updateSaleRecordAction(sale.id, salePayloadWithPayment(tour.id, 120))
    expect(updated.success).toBe(true)

    const healedNet = await getCashNetForVoucher(voucher)
    expect(healedNet).toBeCloseTo(120, 5)
  })

  // ─── T-CF1-5: QUOTE type — cash flow NOT registered ─────────────────────

  it("editing a QUOTE does not register any cash-flow entries", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    loginAs(admin)

    const tour = await createTour()

    // Create as QUOTE
    const created = await createSaleRecordAction({
      ...salePayloadWithPayment(tour.id, 100),
      type: "QUOTE" as const,
    })
    expect(created.success).toBe(true)
    const sale = created.data!
    const voucher = sale.voucher

    // Edit QUOTE — no cash flow should be touched
    const updated = await updateSaleRecordAction(sale.id, {
      ...salePayloadWithPayment(tour.id, 200),
      type: "QUOTE" as const,
    })
    expect(updated.success).toBe(true)

    const net = await getCashNetForVoucher(voucher)
    expect(net).toBeCloseTo(0, 5) // no cash flow entries at all
  })

  // ─── T-CF1-6: USD sale — both CLP income and USD balance heal on edit ─────
  //
  // REGRESSION GUARD for C1 (bug: reversal hardcoded currency:"CLP" ignoring
  // the USD originalAmount dimension).
  //
  // Before the fix, editing a USD sale would post a CLP-only reversal, leaving
  // the USD balance permanently overstated — and compounding on every subsequent edit.
  //
  // This test WOULD FAIL on the pre-fix code.

  it("USD sale: both CLP income and USD balance heal correctly after edit; no compounding on second edit", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    loginAs(admin)

    const tour = await createTour()

    // ── Step 1: Create sale with a USD payment ───────────────────────────────
    // 100 USD at rate 950 → 95 000 CLP-equivalent stored in `amount`
    const createPayload = {
      type: "SALE" as const,
      channel: "PHYSICAL" as const,
      isWholesale: false,
      paymentPending: false,
      fileNumberPending: false,
      discount: 0,
      passengerArray: [{ name: "USD Passenger", age: 30, nacionality: "US", allergies: [], hotels: [] }],
      paymentArray: [
        {
          refund: false,
          method: "CASH" as const,
          currency: "USD" as const,
          amount: 100,           // USD face value (form input)
          exchange_rate: 950,    // rate used by getNormalizedPaymentAmounts
          movement_date: new Date(),
        },
      ],
      eventBookings: [
        {
          mode: "REGULAR" as const,
          date: new Date(),
          tourId: tour.id,
          startTime: "",
          endTime: "",
          priceEntries: [],
          entrySnapshots: [],
          excludedPassengers: [],
        },
      ],
    }

    const created = await createSaleRecordAction(createPayload)
    expect(created.success).toBe(true)
    const sale = created.data!
    const voucher = sale.voucher

    // After creation: CLP income = 95 000, USD balance = 100
    const clpAfterCreate = await getCashNetForVoucher(voucher)
    expect(clpAfterCreate).toBeCloseTo(95_000, 1)

    const usdAfterCreate = await getUsdNetForVoucher(voucher)
    expect(usdAfterCreate).toBeCloseTo(100, 5)

    // ── Step 2: Edit — change to 120 USD at rate 950 (= 114 000 CLP) ─────────
    const editPayload1 = {
      ...createPayload,
      paymentArray: [
        {
          refund: false,
          method: "CASH" as const,
          currency: "USD" as const,
          amount: 120,
          exchange_rate: 950,
          movement_date: new Date(),
        },
      ],
    }

    const updated1 = await updateSaleRecordAction(sale.id, editPayload1)
    expect(updated1.success).toBe(true)

    // After edit 1: CLP income = 114 000, USD balance = 120 (no overstatement)
    const clpAfterEdit1 = await getCashNetForVoucher(voucher)
    expect(clpAfterEdit1).toBeCloseTo(114_000, 1)

    const usdAfterEdit1 = await getUsdNetForVoucher(voucher)
    expect(usdAfterEdit1).toBeCloseTo(120, 5)

    // ── Step 3: Second edit — change to 80 USD at rate 950 (= 76 000 CLP) ────
    //    Validates no compounding: if C1 were unfixed, USD would be 120 + 80 = 200.
    const editPayload2 = {
      ...createPayload,
      paymentArray: [
        {
          refund: false,
          method: "CASH" as const,
          currency: "USD" as const,
          amount: 80,
          exchange_rate: 950,
          movement_date: new Date(),
        },
      ],
    }

    const updated2 = await updateSaleRecordAction(sale.id, editPayload2)
    expect(updated2.success).toBe(true)

    // After edit 2: CLP income = 76 000, USD balance = 80
    const clpAfterEdit2 = await getCashNetForVoucher(voucher)
    expect(clpAfterEdit2).toBeCloseTo(76_000, 1)

    const usdAfterEdit2 = await getUsdNetForVoucher(voucher)
    expect(usdAfterEdit2).toBeCloseTo(80, 5)
  })
})
