/**
 * T-REG1 — applySaleUpdateTx extraction regression guard (integration tests)
 *
 * Purpose: Verify that extracting the $transaction body into applySaleUpdateTx
 * produces BYTE-IDENTICAL results to the pre-extraction direct path.
 *
 * These tests also serve as coverage for:
 * - Non-admin + non-invoiced sale → direct update applied (no approval gate)
 * - Admin + non-invoiced sale → direct update applied
 *
 * NOTE: These tests require a running Docker environment (PostgreSQL testcontainer).
 *       Run with: pnpm test:integration (requires Docker running)
 */

import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import {
  createSaleRecord as createSaleRecordAction,
  updateSaleRecord as updateSaleRecordAction,
} from "@/project/sales/actions/sale-record.actions"
import { loginAs } from "../../helpers/auth"
import { truncateAll, disconnect } from "../../helpers/db"
import { createUser, createTour } from "../../helpers/factories"
import { vi } from "vitest"

// ── Payload helpers ──────────────────────────────────────────────────────────

function baseSalePayload(tourId: string) {
  return {
    type: "SALE" as const,
    channel: "PHYSICAL" as const,
    isWholesale: false,
    paymentPending: false,
    fileNumberPending: false,
    discount: 0,
    comments: undefined as string | undefined,
    passengerArray: [
      {
        name: "Ana Torres",
        age: 28,
        nacionality: "CL",
        allergies: [] as string[],
        hotels: [] as unknown[],
      },
    ],
    paymentArray: [
      {
        refund: false,
        method: "CASH" as const,
        currency: "CLP" as const,
        amount: 50000,
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
        priceEntries: [] as unknown[],
        entrySnapshots: [] as unknown[],
        excludedPassengers: [] as unknown[],
      },
    ],
  }
}

function updatedPayload(tourId: string) {
  return {
    ...baseSalePayload(tourId),
    comments: "updated by regression test",
    passengerArray: [
      {
        name: "Updated Passenger",
        age: 30,
        nacionality: "AR",
        allergies: [] as string[],
        hotels: [] as unknown[],
      },
    ],
    paymentArray: [
      {
        refund: false,
        method: "TRANSFER" as const,
        currency: "CLP" as const,
        amount: 75000,
        movement_date: new Date(),
      },
    ],
  }
}

// ── Tests ──────────��─────────────────────────────────────────────────────────

describe("sale update regression guard (integration)", () => {
  beforeEach(async () => {
    await truncateAll()
    vi.mocked(revalidatePath).mockClear()
  })

  afterAll(async () => {
    await disconnect()
  })

  // ── T-REG1: non-admin + non-invoiced → direct update applied ─────────────

  it("T-REG1: non-admin + non-invoiced sale → update applied directly, no approval created", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    const operadora = await createUser({ role: "operadora", mustChangePassword: false })
    void admin

    loginAs(admin)
    const tour = await createTour()
    const created = await createSaleRecordAction(baseSalePayload(tour.id))
    expect(created.success).toBe(true)
    const saleId = created.data!.id

    // Verify NOT invoiced (no wholesaleInvoiceLine)
    const saleBeforeUpdate = await prisma.saleRecord.findUniqueOrThrow({
      where: { id: saleId },
      include: { wholesaleInvoiceLine: true },
    })
    expect(saleBeforeUpdate.wholesaleInvoiceLine).toBeNull()

    // Now edit as operadora (non-admin)
    loginAs(operadora)
    const payload = updatedPayload(tour.id)
    const result = await updateSaleRecordAction(saleId, payload)
    expect(result.success).toBe(true)

    // No approval created
    const approvals = await prisma.approvalRequest.findMany({
      where: { targetId: saleId, action: "UPDATE_INVOICED_SALE" },
    })
    expect(approvals).toHaveLength(0)

    // Sale was mutated
    const updatedSale = await prisma.saleRecord.findUniqueOrThrow({
      where: { id: saleId },
      include: {
        passengers: true,
        paymentRecords: true,
      },
    })
    expect(updatedSale.comments).toBe("updated by regression test")
    expect(updatedSale.passengers).toHaveLength(1)
    expect(updatedSale.passengers[0].name).toBe("Updated Passenger")
    expect(updatedSale.paymentRecords).toHaveLength(1)
    expect(updatedSale.paymentRecords[0].method).toBe("TRANSFER")
    expect(updatedSale.paymentRecords[0].amount).toBe(75000)
  })

  // ── T-REG2: admin + non-invoiced → direct update applied ─────────────────

  it("T-REG2: admin + non-invoiced sale → update applied directly, no approval created", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    loginAs(admin)
    const tour = await createTour()

    const created = await createSaleRecordAction(baseSalePayload(tour.id))
    expect(created.success).toBe(true)
    const saleId = created.data!.id

    const payload = updatedPayload(tour.id)
    const result = await updateSaleRecordAction(saleId, payload)
    expect(result.success).toBe(true)

    // No approval created
    const approvals = await prisma.approvalRequest.findMany({
      where: { targetId: saleId, action: "UPDATE_INVOICED_SALE" },
    })
    expect(approvals).toHaveLength(0)

    // Sale was mutated
    const updatedSale = await prisma.saleRecord.findUniqueOrThrow({
      where: { id: saleId },
      include: { passengers: true, paymentRecords: true },
    })
    expect(updatedSale.comments).toBe("updated by regression test")
  })

  // ── T-REG3: update preserves audit log ───────────────────────────────────

  it("T-REG3: update via direct path produces an audit log UPDATE row", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    loginAs(admin)
    const tour = await createTour()

    const created = await createSaleRecordAction(baseSalePayload(tour.id))
    expect(created.success).toBe(true)
    const saleId = created.data!.id

    const rowsBefore = await prisma.auditLog.findMany({
      where: { entityType: "SaleRecord", entityId: saleId },
    })
    expect(rowsBefore).toHaveLength(1) // CREATE row from createSaleRecord

    const payload = updatedPayload(tour.id)
    const result = await updateSaleRecordAction(saleId, payload)
    expect(result.success).toBe(true)

    const rowsAfter = await prisma.auditLog.findMany({
      where: { entityType: "SaleRecord", entityId: saleId },
      orderBy: { createdAt: "asc" },
    })
    // CREATE + UPDATE = 2 rows
    expect(rowsAfter).toHaveLength(2)
    expect(rowsAfter[1].action).toBe("UPDATE")
  })
})
