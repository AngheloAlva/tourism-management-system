/**
 * T-EXEC-INT — updateInvoicedSaleExecutor integration tests
 * Production code: src/project/sales/executors/update-invoiced-sale.executor.ts
 *
 * REQ-5: Executor applies stored payload with:
 * - audit log (Slice 2 buildSaleAuditSnapshot + AuditService.logUpdate)
 * - cash-flow recalc inside the executor's transaction
 * - fingerprint staleness rejection
 * - idempotency via resolveApproval PENDING-guard
 *
 * NOTE: These tests require a running Docker environment (PostgreSQL testcontainer).
 *       Run with: pnpm test:integration (requires Docker running)
 */

import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import {
  createSaleRecord as createSaleRecordAction,
  updateSaleRecord as updateSaleRecordAction,
} from "@/project/sales/actions/sale-record.actions"
import { resolveApproval } from "@/project/approvals/actions/approval.actions"
import { loginAs } from "../../helpers/auth"
import { truncateAll, disconnect } from "../../helpers/db"
import { createUser, createTour, createInvoice } from "../../helpers/factories"

// ── Helpers ──────────────────────────────────────────────────────────────────

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
        name: "Executor Test Passenger",
        age: 30,
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
        priceEntries: [] as unknown[],
        entrySnapshots: [] as unknown[],
        excludedPassengers: [] as unknown[],
      },
    ],
  }
}

async function attachInvoiceLine(saleRecordId: string) {
  const invoice = await createInvoice()
  return prisma.wholesaleInvoiceLine.create({
    data: {
      invoiceId: invoice.id,
      saleRecordId,
      description: "Test invoice line",
      grossAmount: 80000,
      discountAmount: 0,
      netAmount: 80000,
    },
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("updateInvoicedSaleExecutor (integration)", () => {
  beforeEach(async () => {
    await truncateAll()
    vi.mocked(revalidatePath).mockClear()
  })

  afterAll(async () => {
    await disconnect()
  })

  // ── T-EXEC-INT-1: full happy path ─────────────────────────────────────────

  it("T-EXEC-INT-1: admin approves → SaleRecord updated, audit row written with sale:update-invoiced subtype", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    const operadora = await createUser({ role: "operadora", mustChangePassword: false })

    loginAs(admin)
    const tour = await createTour()

    const created = await createSaleRecordAction(baseSalePayload(tour.id))
    expect(created.success).toBe(true)
    const saleId = created.data!.id

    await attachInvoiceLine(saleId)

    // Non-admin submits edit with reason → creates ApprovalRequest
    loginAs(operadora)
    const editPayload = {
      ...baseSalePayload(tour.id),
      comments: "executor integration test edit",
    }
    const { updateSaleRecord } = await import("@/project/sales/actions/sale-record.actions")
    const updateResult = await updateSaleRecord(saleId, editPayload, "Corrección necesaria")
    expect(updateResult.success).toBe(true)
    expect((updateResult as { approvalRequired?: boolean }).approvalRequired).toBe(true)

    const requestId = (updateResult as { requestId?: string }).requestId
    expect(requestId).toBeTruthy()

    // Admin approves the request
    loginAs(admin)
    const resolveResult = await resolveApproval({
      requestId: requestId!,
      decision: "APPROVE",
    })

    expect(resolveResult.status).toBe("EXECUTED")

    // SaleRecord should be updated
    const updatedSale = await prisma.saleRecord.findUniqueOrThrow({
      where: { id: saleId },
      include: { passengers: true, paymentRecords: true },
    })
    expect(updatedSale.comments).toBe("executor integration test edit")

    // Audit log should have an UPDATE row with subtype sale:update-invoiced
    const auditRows = await prisma.auditLog.findMany({
      where: { entityType: "SaleRecord", entityId: saleId },
      orderBy: { createdAt: "asc" },
    })

    const executorAuditRow = auditRows.find((r) => {
      const metadata = r.metadata as Record<string, unknown>
      return r.action === "UPDATE" && metadata?.subtype === "sale:update-invoiced"
    })

    expect(executorAuditRow).toBeTruthy()
    const metadata = executorAuditRow!.metadata as Record<string, unknown>
    expect(metadata.approvalRequestId).toBe(requestId)
    expect(metadata.subtype).toBe("sale:update-invoiced")
  })

  // ── T-EXEC-INT-2: fingerprint mismatch → INVALIDATED ─────────────────────

  it("T-EXEC-INT-2: fingerprint mismatch → ApprovalRequest INVALIDATED, SaleRecord unchanged", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    const operadora = await createUser({ role: "operadora", mustChangePassword: false })

    loginAs(admin)
    const tour = await createTour()

    const created = await createSaleRecordAction(baseSalePayload(tour.id))
    expect(created.success).toBe(true)
    const saleId = created.data!.id

    await attachInvoiceLine(saleId)

    // Non-admin creates approval request
    loginAs(operadora)
    const editPayload = {
      ...baseSalePayload(tour.id),
      comments: "mismatch test edit",
    }
    const { updateSaleRecord } = await import("@/project/sales/actions/sale-record.actions")
    const updateResult = await updateSaleRecord(saleId, editPayload, "Corrección")
    expect(updateResult.success).toBe(true)
    const requestId = (updateResult as { requestId?: string }).requestId
    expect(requestId).toBeTruthy()

    // Mutate the sale directly to change updatedAt (fingerprint change)
    await prisma.saleRecord.update({
      where: { id: saleId },
      data: { comments: "mutated after approval request created" },
    })

    // Admin tries to approve — fingerprint should mismatch
    loginAs(admin)
    const resolveResult = await resolveApproval({
      requestId: requestId!,
      decision: "APPROVE",
    })

    expect(resolveResult.status).toBe("INVALIDATED")

    // SaleRecord should have the intermediate mutation, NOT the executor's payload
    const sale = await prisma.saleRecord.findUniqueOrThrow({ where: { id: saleId } })
    expect(sale.comments).toBe("mutated after approval request created")
  })

  // ── T-EXEC-INT-3: idempotency — double resolve → second is a no-op ────────

  it("T-EXEC-INT-3: approval already EXECUTED → resolveApproval returns error on double-resolve", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    const operadora = await createUser({ role: "operadora", mustChangePassword: false })

    loginAs(admin)
    const tour = await createTour()

    const created = await createSaleRecordAction(baseSalePayload(tour.id))
    expect(created.success).toBe(true)
    const saleId = created.data!.id

    await attachInvoiceLine(saleId)

    loginAs(operadora)
    const editPayload = {
      ...baseSalePayload(tour.id),
      comments: "idempotency test edit",
    }
    const { updateSaleRecord } = await import("@/project/sales/actions/sale-record.actions")
    const updateResult = await updateSaleRecord(saleId, editPayload, "Corrección")
    expect(updateResult.success).toBe(true)
    const requestId = (updateResult as { requestId?: string }).requestId!

    loginAs(admin)
    // First resolve
    const first = await resolveApproval({ requestId, decision: "APPROVE" })
    expect(first.status).toBe("EXECUTED")

    // Second resolve should fail (PENDING guard blocks it)
    await expect(
      resolveApproval({ requestId, decision: "APPROVE" })
    ).rejects.toThrow("La solicitud ya fue resuelta o no existe")

    // No duplicate audit rows for the executor
    const executorAuditRows = await prisma.auditLog.findMany({
      where: {
        entityType: "SaleRecord",
        entityId: saleId,
      },
    })
    const invoicedUpdateRows = executorAuditRows.filter((r) => {
      const metadata = r.metadata as Record<string, unknown>
      return metadata?.subtype === "sale:update-invoiced"
    })
    expect(invoicedUpdateRows).toHaveLength(1) // only one executor audit row
  })
})
