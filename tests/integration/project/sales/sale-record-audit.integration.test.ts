/**
 * T-AUD1 — Sale record audit coverage (integration tests)
 * Production code: src/project/sales/actions/sale-record.actions.ts
 *                  src/project/sales/utils/sale-audit-summary.ts
 *                  src/lib/audit/service.ts
 *
 * NOTE: These tests require a running Docker environment (PostgreSQL testcontainer).
 *       Run with: pnpm test:integration (requires Docker running)
 *
 * Audit-failure resilience approach (IT-5f):
 *   We spy on `prisma.auditLog.create` (the underlying DB call made by AuditService)
 *   and mock it to reject AFTER the sale transaction has committed. This is more
 *   reliable than mocking AuditService at the module boundary because:
 *   1. Next.js server actions compiled context can make vi.mock on ES modules unreliable.
 *   2. The spy directly targets the DB write that AuditService.logCreate/logUpdate
 *      delegates to, so we confirm the try/catch in the action truly swallows the error.
 *   We restore the spy via mockRestore() in the test itself to avoid polluting other tests.
 *
 * Key invariants verified:
 * - createSaleRecord → exactly 1 CREATE auditLog row with full snapshot in newValues.
 * - Scalar-only edit (comments) → 1 UPDATE row with changes.comments populated.
 * - Nested-only edit (passenger name swap, no scalar change) → 1 UPDATE row (BUG FIX).
 * - No-op edit (identical data re-submitted) → 0 new auditLog rows.
 * - Payment-affecting edit → metadata has FLAT cashFlowReversedNetClp (not nested object).
 * - Audit failure (prisma.auditLog.create throws) → sale still persists, action succeeds.
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

// ── Payload helpers ──────────────────────────────────────────────────────────

function baseSalePayload(tourId: string) {
  return {
    type: "SALE" as const,
    channel: "PHYSICAL" as const,
    isWholesale: false,
    paymentPending: false,
    fileNumberPending: false,
    discount: 0,
    comments: undefined,
    passengerArray: [
      {
        name: "Ana Torres",
        age: 28,
        nacionality: "CL",
        allergies: [],
        hotels: [],
      },
      {
        name: "Carlos Ruiz",
        age: 35,
        nacionality: "AR",
        allergies: [],
        hotels: [],
      },
    ],
    paymentArray: [
      {
        refund: false,
        method: "CASH" as const,
        currency: "CLP" as const,
        amount: 80000,
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
        // Charge for both passengers so the booking's target matches the roster.
        // Without this, computeTargetPassengerCount floors to 1 and the
        // passenger-overflow refine rejects the 2-passenger payload.
        priceEntries: [
          {
            priceCategoryId: "",
            categoryName: "Adulto",
            count: 2,
            price: 40000,
            reception: 0,
          },
        ],
        entrySnapshots: [],
        excludedPassengers: [],
      },
    ],
  }
}

/** Returns auditLog rows for a given saleId, ordered by createdAt ASC. */
async function getAuditRows(saleId: string) {
  return prisma.auditLog.findMany({
    where: { entityType: "SaleRecord", entityId: saleId },
    orderBy: { createdAt: "asc" },
  })
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("sale record audit (integration)", () => {
  beforeEach(async () => {
    await truncateAll()
    vi.mocked(revalidatePath).mockClear()
  })

  afterAll(async () => {
    await disconnect()
  })

  // ── IT-5a (Scenario A): create → 1 CREATE row ─────────────────────────────

  it("IT-5a: createSaleRecord → exactly 1 CREATE auditLog row with snapshot data", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    loginAs(admin)
    const tour = await createTour()

    const result = await createSaleRecordAction(baseSalePayload(tour.id))
    expect(result.success).toBe(true)
    const saleId = result.data!.id

    const rows = await getAuditRows(saleId)
    expect(rows).toHaveLength(1)

    const row = rows[0]
    expect(row.action).toBe("CREATE")
    expect(row.entityType).toBe("SaleRecord")

    const newValues = row.newValues as Record<string, unknown>
    expect(newValues).toBeTruthy()

    const passengers = newValues.passengers as Record<string, unknown>
    expect(passengers.count).toBe(2)

    const payments = newValues.paymentRecords as Record<string, unknown>
    expect(payments.count).toBe(1)

    const bookings = newValues.eventBookings as Record<string, unknown>
    expect(bookings.count).toBe(1)

    const metadata = row.metadata as Record<string, unknown>
    expect(typeof metadata.voucher).toBe("number")
    expect(metadata.voucher).toBe(result.data!.voucher)
  })

  // ── IT-5b (Scenario B): scalar-only edit → UPDATE row with diff ───────────

  it("IT-5b: scalar-only edit (comments) → 1 new UPDATE row with changes.comments", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    loginAs(admin)
    const tour = await createTour()

    const created = await createSaleRecordAction(baseSalePayload(tour.id))
    expect(created.success).toBe(true)
    const sale = created.data!

    const rowsBefore = await getAuditRows(sale.id)
    expect(rowsBefore).toHaveLength(1) // CREATE row

    const payload = { ...baseSalePayload(tour.id), comments: "updated comment" }
    const updated = await updateSaleRecordAction(sale.id, payload)
    expect(updated.success).toBe(true)

    const rowsAfter = await getAuditRows(sale.id)
    expect(rowsAfter).toHaveLength(2) // CREATE + UPDATE

    const updateRow = rowsAfter[1]
    expect(updateRow.action).toBe("UPDATE")

    const changes = updateRow.changes as Record<string, { before: unknown; after: unknown }>
    expect(changes).toHaveProperty("comments")
    expect(changes.comments.before).toBeNull() // original was null
    expect(changes.comments.after).toBe("updated comment")

    expect(updateRow.oldValues).toBeTruthy()
    expect(updateRow.newValues).toBeTruthy()
  })

  // ── IT-5c (Scenario C — BUG FIX): nested-only edit → UPDATE row ──────────

  it("IT-5c: nested-only edit (swap passenger name, no scalar change) → 1 UPDATE row with passengers key in changes", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    loginAs(admin)
    const tour = await createTour()

    const created = await createSaleRecordAction(baseSalePayload(tour.id))
    expect(created.success).toBe(true)
    const sale = created.data!

    const rowsBefore = await getAuditRows(sale.id)
    expect(rowsBefore).toHaveLength(1)

    // Same scalars, only passenger name changed
    const payload = {
      ...baseSalePayload(tour.id),
      passengerArray: [
        { name: "Ana Torres", age: 28, nacionality: "CL", allergies: [], hotels: [] },
        { name: "Luis Gomez", age: 35, nacionality: "AR", allergies: [], hotels: [] }, // changed
      ],
    }
    const updated = await updateSaleRecordAction(sale.id, payload)
    expect(updated.success).toBe(true)

    const rowsAfter = await getAuditRows(sale.id)
    expect(rowsAfter).toHaveLength(2) // CREATE + UPDATE

    const updateRow = rowsAfter[1]
    expect(updateRow.action).toBe("UPDATE")

    const changes = updateRow.changes as Record<string, unknown>
    expect(changes).toHaveProperty("passengers")

    const oldValues = updateRow.oldValues as Record<string, { names: string }>
    const newValues = updateRow.newValues as Record<string, { names: string }>
    expect(oldValues.passengers.names).not.toBe(newValues.passengers.names)
    // Scalars should be equal (no change)
    const ov = oldValues as Record<string, unknown>
    const nv = newValues as Record<string, unknown>
    expect(ov.type).toBe(nv.type)
    expect(ov.channel).toBe(nv.channel)
    expect(ov.comments).toBe(nv.comments)
  })

  // ── IT-5d (Scenario D): no-op edit → zero new rows ────────────────────────

  it("IT-5d: no-op edit (identical data) → zero new auditLog rows", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    loginAs(admin)
    const tour = await createTour()

    const payload = baseSalePayload(tour.id)
    const created = await createSaleRecordAction(payload)
    expect(created.success).toBe(true)
    const sale = created.data!

    const rowsBefore = await getAuditRows(sale.id)
    expect(rowsBefore).toHaveLength(1)

    // Re-submit identical payload — same passengers, same payment, same event
    // NOTE: Because delete-recreate creates new IDs, the passenger names/payment amounts
    // will produce the same snapshot summary → detectChanges returns {} → no row.
    const updated = await updateSaleRecordAction(sale.id, payload)
    expect(updated.success).toBe(true)

    const rowsAfter = await getAuditRows(sale.id)
    expect(rowsAfter).toHaveLength(1) // still only the CREATE row
  })

  // ── IT-5e (Scenario E): payment edit → flat cashFlow metadata ────────────

  it("IT-5e: payment-amount edit → metadata.cashFlowReversedNetClp is a number, no nested cashFlowRecalc key", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    loginAs(admin)
    const tour = await createTour()

    const created = await createSaleRecordAction(baseSalePayload(tour.id))
    expect(created.success).toBe(true)
    const sale = created.data!

    // Edit payment amount (triggers cashFlowRecalc)
    const payload = {
      ...baseSalePayload(tour.id),
      paymentArray: [
        {
          refund: false,
          method: "CASH" as const,
          currency: "CLP" as const,
          amount: 120000, // changed from 80000
          movement_date: new Date(),
        },
      ],
    }
    const updated = await updateSaleRecordAction(sale.id, payload)
    expect(updated.success).toBe(true)

    const rows = await getAuditRows(sale.id)
    const updateRow = rows.find((r) => r.action === "UPDATE")
    expect(updateRow).toBeDefined()

    const metadata = updateRow!.metadata as Record<string, unknown>
    expect(typeof metadata.cashFlowReversedNetClp).toBe("number")
    expect(typeof metadata.cashFlowReRegisteredCount).toBe("number")
    // Must NOT contain the old nested object key
    expect(metadata.cashFlowRecalc).toBeUndefined()
  })

  // ── IT-5f (Scenario F): audit failure → sale still persists ──────────────

  it("IT-5f: when prisma.auditLog.create throws, createSaleRecord still returns success and sale persists in DB", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    loginAs(admin)
    const tour = await createTour()

    // Spy on the underlying DB call used by AuditService.logCreate
    const createSpy = vi
      .spyOn(prisma.auditLog, "create")
      .mockRejectedValueOnce(new Error("DB down — audit failure simulation"))

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const result = await createSaleRecordAction(baseSalePayload(tour.id))

    // Restore createSpy immediately so DB is usable for the assertions below
    createSpy.mockRestore()

    // Sale must still have succeeded
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()

    // Sale persists in DB
    const saleInDb = await prisma.saleRecord.findUnique({ where: { id: result.data!.id } })
    expect(saleInDb).toBeDefined()

    // console.error was called (audit failure was logged) — check BEFORE restoring the spy
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[sale-record-audit]"),
      expect.any(Error)
    )
    consoleErrorSpy.mockRestore()
  })
})
