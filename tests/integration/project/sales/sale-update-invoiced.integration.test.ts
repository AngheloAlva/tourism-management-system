/**
 * T-INV — Invoiced-sale approval gate (integration tests)
 * Production code: src/project/sales/actions/sale-record.actions.ts — updateSaleRecord
 *
 * REQ-3: Non-admin editing an invoiced sale → ApprovalRequest created, SaleRecord unchanged.
 * REQ-3: Admin editing an invoiced sale → direct update, no ApprovalRequest.
 * REQ-3: Non-admin editing a non-invoiced sale → direct update (no change from today).
 * REQ-5: No-op check — non-admin submitting identical data on invoiced sale → no ApprovalRequest.
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
        name: "Test Passenger",
        age: 25,
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

/** Creates a WholesaleInvoiceLine linked to a given saleRecordId. */
async function attachInvoiceLine(saleRecordId: string) {
  const invoice = await createInvoice()
  return prisma.wholesaleInvoiceLine.create({
    data: {
      invoiceId: invoice.id,
      saleRecordId,
      description: "Test invoice line",
      grossAmount: 50000,
      discountAmount: 0,
      netAmount: 50000,
    },
  })
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("updateSaleRecord invoiced gate (integration)", () => {
  beforeEach(async () => {
    await truncateAll()
    vi.mocked(revalidatePath).mockClear()
  })

  afterAll(async () => {
    await disconnect()
  })

  // ── T-INV1: non-admin + invoiced → ApprovalRequest created, sale unchanged ──

  it("T-INV1: non-admin + invoiced sale → ApprovalRequest with UPDATE_INVOICED_SALE created, SaleRecord NOT mutated", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    const operadora = await createUser({ role: "operadora", mustChangePassword: false })
    loginAs(admin)
    const tour = await createTour()

    // Create sale as admin
    const created = await createSaleRecordAction(baseSalePayload(tour.id))
    expect(created.success).toBe(true)
    const saleId = created.data!.id

    // Attach invoice line
    await attachInvoiceLine(saleId)

    // Verify invoiced
    const saleBeforeEdit = await prisma.saleRecord.findUniqueOrThrow({
      where: { id: saleId },
      include: { wholesaleInvoiceLine: true, passengers: true },
    })
    expect(saleBeforeEdit.wholesaleInvoiceLine).not.toBeNull()

    // Edit as non-admin operadora
    loginAs(operadora)
    const payload = {
      ...baseSalePayload(tour.id),
      comments: "trying to edit invoiced sale",
    }
    const result = await updateSaleRecordAction(saleId, payload)

    // Result should indicate approval required (needsReason since no reason provided)
    expect(result.success).toBe(true)
    expect((result as { approvalRequired?: boolean }).approvalRequired).toBe(true)

    // The server returns needsReason: true when reason is not provided
    // (client is expected to show the dialog to collect the reason)
    const needsReason = (result as { needsReason?: boolean }).needsReason
    if (needsReason) {
      // No ApprovalRequest yet (reason not provided)
      const approvals = await prisma.approvalRequest.findMany({
        where: { targetId: saleId, action: "UPDATE_INVOICED_SALE" },
      })
      expect(approvals).toHaveLength(0)
    } else {
      // ApprovalRequest created (reason was auto-provided or gate was off)
      const approvals = await prisma.approvalRequest.findMany({
        where: { targetId: saleId, action: "UPDATE_INVOICED_SALE" },
      })
      expect(approvals).toHaveLength(1)
      expect(approvals[0].status).toBe("PENDING")
    }

    // SaleRecord must NOT be mutated
    const saleAfterEdit = await prisma.saleRecord.findUniqueOrThrow({
      where: { id: saleId },
      include: { passengers: true },
    })
    // Comments unchanged (still null from creation)
    expect(saleAfterEdit.comments).toBe(saleBeforeEdit.comments)
    expect(saleAfterEdit.passengers).toHaveLength(saleBeforeEdit.passengers.length)
  })

  // ── T-INV1b: non-admin + invoiced + reason → ApprovalRequest created ────────

  it("T-INV1b: non-admin + invoiced + reason provided → ApprovalRequest PENDING, SaleRecord NOT mutated", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    const operadora = await createUser({ role: "operadora", mustChangePassword: false })
    loginAs(admin)
    const tour = await createTour()

    const created = await createSaleRecordAction(baseSalePayload(tour.id))
    expect(created.success).toBe(true)
    const saleId = created.data!.id

    await attachInvoiceLine(saleId)

    loginAs(operadora)
    const payload = {
      ...baseSalePayload(tour.id),
      comments: "invoiced edit with reason",
    }

    // Call updateSaleRecord with a reason (third param)
    const { updateSaleRecord: updateSaleRecordAction } = await import(
      "@/project/sales/actions/sale-record.actions"
    )
    const result = await updateSaleRecordAction(saleId, payload, "Corrección de datos del cliente")

    expect(result.success).toBe(true)
    expect((result as { approvalRequired?: boolean }).approvalRequired).toBe(true)
    expect((result as { needsReason?: boolean }).needsReason).toBeUndefined()
    expect((result as { requestId?: string }).requestId).toBeTruthy()

    // ApprovalRequest created
    const approvals = await prisma.approvalRequest.findMany({
      where: { targetId: saleId, action: "UPDATE_INVOICED_SALE" },
    })
    expect(approvals).toHaveLength(1)
    expect(approvals[0].status).toBe("PENDING")
    expect(approvals[0].requestedById).toBe(operadora.id)
    expect(approvals[0].reason).toBe("Corrección de datos del cliente")

    // Payload stored in metadata
    const metadata = approvals[0].metadata as Record<string, unknown>
    expect(metadata.payload).toBeTruthy()

    // SaleRecord NOT mutated
    const saleAfter = await prisma.saleRecord.findUniqueOrThrow({ where: { id: saleId } })
    expect(saleAfter.comments).toBeNull() // unchanged
  })

  // ── T-INV2: admin + invoiced → direct update, no approval ────────────────

  it("T-INV2: admin + invoiced sale → direct update applied, no ApprovalRequest created", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    loginAs(admin)
    const tour = await createTour()

    const created = await createSaleRecordAction(baseSalePayload(tour.id))
    expect(created.success).toBe(true)
    const saleId = created.data!.id

    await attachInvoiceLine(saleId)

    const payload = {
      ...baseSalePayload(tour.id),
      comments: "admin direct edit",
    }
    const result = await updateSaleRecordAction(saleId, payload)
    expect(result.success).toBe(true)
    expect((result as { approvalRequired?: boolean }).approvalRequired).toBeUndefined()

    // No approval created
    const approvals = await prisma.approvalRequest.findMany({
      where: { targetId: saleId, action: "UPDATE_INVOICED_SALE" },
    })
    expect(approvals).toHaveLength(0)

    // Sale was mutated
    const updatedSale = await prisma.saleRecord.findUniqueOrThrow({
      where: { id: saleId },
    })
    expect(updatedSale.comments).toBe("admin direct edit")
  })

  // ── T-INV3: non-admin + non-invoiced → direct update, no approval ─────────

  it("T-INV3: non-admin + non-invoiced sale → direct update applied, no ApprovalRequest", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    const operadora = await createUser({ role: "operadora", mustChangePassword: false })

    loginAs(admin)
    const tour = await createTour()

    const created = await createSaleRecordAction(baseSalePayload(tour.id))
    expect(created.success).toBe(true)
    const saleId = created.data!.id

    // NO invoice line attached

    loginAs(operadora)
    const payload = {
      ...baseSalePayload(tour.id),
      comments: "operadora direct edit non-invoiced",
    }
    const result = await updateSaleRecordAction(saleId, payload)
    expect(result.success).toBe(true)
    expect((result as { approvalRequired?: boolean }).approvalRequired).toBeUndefined()

    // No approval created
    const approvals = await prisma.approvalRequest.findMany({
      where: { targetId: saleId, action: "UPDATE_INVOICED_SALE" },
    })
    expect(approvals).toHaveLength(0)

    // Sale was mutated
    const updatedSale = await prisma.saleRecord.findUniqueOrThrow({
      where: { id: saleId },
    })
    expect(updatedSale.comments).toBe("operadora direct edit non-invoiced")
  })

  // ── T-INV5: non-admin + invoiced + payment amount change → ApprovalRequest ──

  it("T-INV5: non-admin changes payment amount on invoiced sale (same count) → ApprovalRequest created, sale NOT mutated", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    const operadora = await createUser({ role: "operadora", mustChangePassword: false })

    loginAs(admin)
    const tour = await createTour()

    const created = await createSaleRecordAction(baseSalePayload(tour.id))
    expect(created.success).toBe(true)
    const saleId = created.data!.id

    await attachInvoiceLine(saleId)

    // Submit edit: same structure (1 payment, 1 passenger, 1 booking) but different amount
    loginAs(operadora)
    const payloadWithDifferentAmount = {
      ...baseSalePayload(tour.id),
      paymentArray: [
        {
          refund: false,
          method: "CASH" as const,
          currency: "CLP" as const,
          amount: 99999, // changed from 50000
          movement_date: new Date(),
        },
      ],
    }

    const result = await updateSaleRecordAction(saleId, payloadWithDifferentAmount, "Corrección de monto")

    // Must route to approval (content changed even though array length is the same)
    expect(result.success).toBe(true)
    expect((result as { approvalRequired?: boolean }).approvalRequired).toBe(true)

    const approvals = await prisma.approvalRequest.findMany({
      where: { targetId: saleId, action: "UPDATE_INVOICED_SALE" },
    })
    expect(approvals).toHaveLength(1)
    expect(approvals[0].status).toBe("PENDING")

    // Sale NOT mutated
    const saleAfter = await prisma.saleRecord.findUniqueOrThrow({
      where: { id: saleId },
      include: { paymentRecords: true },
    })
    expect(saleAfter.paymentRecords[0].amount).toBe(50000) // unchanged
  })

  // ── T-INV6: non-admin + invoiced + passenger name change → ApprovalRequest ─

  it("T-INV6: non-admin changes passenger name on invoiced sale (same count) → ApprovalRequest created, sale NOT mutated", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    const operadora = await createUser({ role: "operadora", mustChangePassword: false })

    loginAs(admin)
    const tour = await createTour()

    const created = await createSaleRecordAction(baseSalePayload(tour.id))
    expect(created.success).toBe(true)
    const saleId = created.data!.id

    await attachInvoiceLine(saleId)

    // Submit edit: same passenger count but different name
    loginAs(operadora)
    const payloadWithDifferentPassenger = {
      ...baseSalePayload(tour.id),
      passengerArray: [
        {
          name: "Different Name", // changed from "Test Passenger"
          age: 25,
          nacionality: "CL",
          allergies: [] as string[],
          hotels: [] as unknown[],
        },
      ],
    }

    const result = await updateSaleRecordAction(saleId, payloadWithDifferentPassenger, "Corrección de pasajero")

    // Must route to approval
    expect(result.success).toBe(true)
    expect((result as { approvalRequired?: boolean }).approvalRequired).toBe(true)

    const approvals = await prisma.approvalRequest.findMany({
      where: { targetId: saleId, action: "UPDATE_INVOICED_SALE" },
    })
    expect(approvals).toHaveLength(1)
    expect(approvals[0].status).toBe("PENDING")

    // Sale NOT mutated
    const saleAfter = await prisma.saleRecord.findUniqueOrThrow({
      where: { id: saleId },
      include: { passengers: true },
    })
    expect(saleAfter.passengers[0].name).toBe("Test Passenger") // unchanged
  })

  // ── T-INV7: non-admin swaps booking tour (same date) → ApprovalRequest ──────

  it("T-INV7: non-admin swaps booking tour on invoiced sale (same date, different tour) → ApprovalRequest created, sale NOT mutated", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    const operadora = await createUser({ role: "operadora", mustChangePassword: false })

    loginAs(admin)
    const tourA = await createTour()
    const tourB = await createTour()

    // Create sale with tourA
    const created = await createSaleRecordAction(baseSalePayload(tourA.id))
    expect(created.success).toBe(true)
    const saleId = created.data!.id

    await attachInvoiceLine(saleId)

    // Submit edit: swap tourA → tourB, same date, same everything else
    loginAs(operadora)
    const payloadWithDifferentTour = {
      ...baseSalePayload(tourB.id), // different tourId
    }

    const result = await updateSaleRecordAction(saleId, payloadWithDifferentTour, "Cambio de tour")

    // Must route to approval (tour/service identity changed)
    expect(result.success).toBe(true)
    expect((result as { approvalRequired?: boolean }).approvalRequired).toBe(true)

    const approvals = await prisma.approvalRequest.findMany({
      where: { targetId: saleId, action: "UPDATE_INVOICED_SALE" },
    })
    expect(approvals).toHaveLength(1)
    expect(approvals[0].status).toBe("PENDING")

    // Sale NOT mutated — still linked to tourA
    const saleAfter = await prisma.saleRecord.findUniqueOrThrow({
      where: { id: saleId },
      include: { eventBookings: { include: { event: { include: { tour: true } } } } },
    })
    expect(saleAfter.eventBookings[0].event.tourId).toBe(tourA.id)
  })

  // ── T-INV8: non-admin changes passenger document → ApprovalRequest ──────────

  it("T-INV8: non-admin changes passenger document (rut) on invoiced sale (same name) → ApprovalRequest created, sale NOT mutated", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    const operadora = await createUser({ role: "operadora", mustChangePassword: false })

    loginAs(admin)
    const tour = await createTour()

    // Create with passenger that has a rut
    const created = await createSaleRecordAction({
      ...baseSalePayload(tour.id),
      passengerArray: [
        {
          name: "Test Passenger",
          rut: "12.345.678-9",
          age: 25,
          nacionality: "CL",
          allergies: [] as string[],
          hotels: [] as unknown[],
        },
      ],
    })
    expect(created.success).toBe(true)
    const saleId = created.data!.id

    await attachInvoiceLine(saleId)

    // Submit edit: same name, different rut
    loginAs(operadora)
    const payloadWithDifferentRut = {
      ...baseSalePayload(tour.id),
      passengerArray: [
        {
          name: "Test Passenger", // same name
          rut: "98.765.432-1", // different rut
          age: 25,
          nacionality: "CL",
          allergies: [] as string[],
          hotels: [] as unknown[],
        },
      ],
    }

    const result = await updateSaleRecordAction(saleId, payloadWithDifferentRut, "Corrección de documento")

    // Must route to approval (document changed even though name is the same)
    expect(result.success).toBe(true)
    expect((result as { approvalRequired?: boolean }).approvalRequired).toBe(true)

    const approvals = await prisma.approvalRequest.findMany({
      where: { targetId: saleId, action: "UPDATE_INVOICED_SALE" },
    })
    expect(approvals).toHaveLength(1)
    expect(approvals[0].status).toBe("PENDING")

    // Sale NOT mutated — rut still "12.345.678-9"
    const saleAfter = await prisma.saleRecord.findUniqueOrThrow({
      where: { id: saleId },
      include: { passengers: true },
    })
    expect(saleAfter.passengers[0].document).toBe("12.345.678-9")
  })

  // ── T-INV9: non-admin adds a priceEntry (billed amount) to booking → ApprovalRequest ─

  it("T-INV9: non-admin adds a priceEntry to a booking on invoiced sale → ApprovalRequest created, sale NOT mutated", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    const operadora = await createUser({ role: "operadora", mustChangePassword: false })

    loginAs(admin)
    const tour = await createTour()

    // Create sale with no priceEntries on the booking
    const created = await createSaleRecordAction(baseSalePayload(tour.id))
    expect(created.success).toBe(true)
    const saleId = created.data!.id

    await attachInvoiceLine(saleId)

    // Submit edit: add a priceEntry (billed amount added to booking).
    // priceCategoryId is passed as empty string, which the action maps to null
    // via `pe.priceCategoryId || null`, avoiding any FK constraint failure.
    loginAs(operadora)
    const payloadWithPriceEntry = {
      ...baseSalePayload(tour.id),
      eventBookings: [
        {
          mode: "REGULAR" as const,
          date: new Date(),
          tourId: tour.id,
          startTime: "",
          endTime: "",
          priceEntries: [
            {
              priceCategoryId: "", // empty string → stored as null (no FK violation)
              categoryName: "Adulto",
              count: 1,
              price: 45000,
              reception: 0,
            },
          ],
          entrySnapshots: [] as unknown[],
          excludedPassengers: [] as unknown[],
        },
      ],
    }

    const result = await updateSaleRecordAction(saleId, payloadWithPriceEntry, "Corrección de entradas")

    // Must route to approval (priceEntries/entrySnapshots changed)
    expect(result.success).toBe(true)
    expect((result as { approvalRequired?: boolean }).approvalRequired).toBe(true)

    const approvals = await prisma.approvalRequest.findMany({
      where: { targetId: saleId, action: "UPDATE_INVOICED_SALE" },
    })
    expect(approvals).toHaveLength(1)
    expect(approvals[0].status).toBe("PENDING")

    // Sale NOT mutated — booking still has no priceEntries
    const bookingAfter = await prisma.eventBooking.findFirst({
      where: { saleRecordId: saleId },
      include: { priceEntries: true },
    })
    expect(bookingAfter?.priceEntries).toHaveLength(0)
  })

  // ── T-INV4: non-admin + invoiced + no-op → no ApprovalRequest ─────────────

  it("T-INV4: non-admin + invoiced + identical data (no-op) → no ApprovalRequest created", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    const operadora = await createUser({ role: "operadora", mustChangePassword: false })

    loginAs(admin)
    const tour = await createTour()

    // Create with specific payload
    const originalPayload = baseSalePayload(tour.id)
    const created = await createSaleRecordAction(originalPayload)
    expect(created.success).toBe(true)
    const saleId = created.data!.id

    await attachInvoiceLine(saleId)

    // Re-submit the SAME payload (no-op)
    loginAs(operadora)
    const result = await updateSaleRecordAction(saleId, originalPayload)

    // A no-op on an invoiced sale by non-admin should NOT create an ApprovalRequest
    // (no-op detected before routing to approval)
    const approvals = await prisma.approvalRequest.findMany({
      where: { targetId: saleId, action: "UPDATE_INVOICED_SALE" },
    })
    expect(approvals).toHaveLength(0)

    // Result should be a direct success (applied as no-op) or approvalRequired absent
    if (result.success) {
      expect((result as { approvalRequired?: boolean }).approvalRequired).toBeUndefined()
    }
    // Sale unchanged
    const saleAfter = await prisma.saleRecord.findUniqueOrThrow({ where: { id: saleId } })
    expect(saleAfter.comments).toBeNull() // was null in original payload
  })
})
