/**
 * S1-T4 RED: Integration tests for updateTransferExecutor + applyTransferUpdateTx atomicity.
 *
 * Covers:
 * - Happy path: executor applies update, creates reversal + new INCOME entries, updatedAt advances
 * - Atomicity (cash-flow bug regression): forced failure AFTER reversal rolls back entire tx
 * - Fingerprint invalidation: stale approval rejected
 * - OUTGOING guard: CANCELLED / non-OUTGOING transfers invalidated
 * - Payload trust boundary: invalid payload returns error (not invalidated)
 *
 * All tests use Docker testcontainer via the global setup.
 */

import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { APPROVAL_ACTION } from "@/generated/prisma/enums"
import { updateTransferExecutor } from "@/project/transfers/executors/update-transfer.executor"
import { applyTransferUpdateTx } from "@/project/transfers/server/apply-transfer-update"
import {
  createUser,
  createTransfer,
  createTransferAgency,
  createApproval,
  createCashBox,
  createProvider,
  createTour,
  createEvent,
  createSaleRecord,
} from "../../helpers/factories"
import { truncateAll, disconnect } from "../../helpers/db"
import type { TransferFormData } from "@/project/transfers/schemas/transfer.schema"

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds a minimal valid TransferFormData suitable for edit mode.
 * Uses a real passengerId from priceDetails (sourcePassengerId).
 */
function buildPayload(opts: {
  agencyId: string
  passengerId: string
  eventId: string
  saleRecordId: string
}): TransferFormData {
  return {
    type: "OUTGOING",
    agencyId: opts.agencyId,
    date: new Date(),
    paymentStatus: "PENDING",
    comments: undefined,
    saleRecordId: opts.saleRecordId,
    eventTransfers: [
      {
        eventId: opts.eventId,
        transferEvent: true,
        passengerPrices: [
          {
            passengerId: opts.passengerId,
            passengerName: "Test Passenger",
            sourceSaleRecordId: opts.saleRecordId,
            ageCategory: "adult",
            tourPrice: 50000,
            entrancePrice: 20000,
            totalPrice: 70000,
            isSelected: true,
            isAlreadyTransferred: false,
          },
        ],
      },
    ],
    payments: [],
  }
}

/**
 * Builds a valid payload that includes one payment.
 */
function buildPayloadWithPayment(opts: {
  agencyId: string
  passengerId: string
  eventId: string
  saleRecordId: string
  cashAmount: number
}): TransferFormData {
  const base = buildPayload(opts)
  return {
    ...base,
    paymentStatus: "FULLY_PAID",
    payments: [
      {
        refund: false,
        method: "CASH",
        amount: String(opts.cashAmount),
        date: new Date(),
        documentNumber: undefined,
        comments: undefined,
      },
    ],
  }
}

/**
 * Creates a minimal ApprovalRequest for UPDATE_TRANSFER targeting the given transfer.
 */
async function createUpdateTransferApproval(opts: {
  transferId: string
  requestedById: string
  targetFingerprint?: string
  payload?: TransferFormData
}) {
  return prisma.approvalRequest.create({
    data: {
      action: APPROVAL_ACTION.UPDATE_TRANSFER,
      domain: "transfers",
      status: "PENDING",
      targetType: "agency-transfer",
      targetId: opts.transferId,
      codeHash: "test-hash",
      codeLast4: "0000",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      requestedById: opts.requestedById,
      targetFingerprint: opts.targetFingerprint ?? null,
      metadata: opts.payload ? { payload: opts.payload } : {},
    },
  })
}

/**
 * Seeds a transfer with a transferEventBooking, transferPriceDetail, and passenger.
 * Returns the seeded IDs for test use.
 */
async function seedTransferWithEventAndPassenger(opts: {
  createdById: string
  agencyId: string
}) {
  // Create using factories that handle required fields
  const provider = await createProvider()
  void provider // unused — only needed to satisfy FK if any
  const tour = await createTour()
  const event = await createEvent({ tourId: tour.id })

  // Create a sale record using the factory (handles required fields like channel)
  const saleRecord = await createSaleRecord({ sellerId: opts.createdById })

  // Create a passenger linked to the sale
  const salePassenger = await prisma.passenger.create({
    data: {
      name: "Test Passenger",
      saleRecordId: saleRecord.id,
    },
  })

  // Create the transfer
  const transfer = await createTransfer({
    createdById: opts.createdById,
    agencyId: opts.agencyId,
    saleRecordId: saleRecord.id,
  })

  // Seed a transferPriceDetail (sourcePassengerId = salePassenger.id)
  await prisma.transferPriceDetail.create({
    data: {
      transferId: transfer.id,
      passengerName: "Test Passenger",
      sourcePassengerId: salePassenger.id,
      ageCategory: "adult",
      tourPrice: 60000,
      entrancePrice: 25000,
      totalPrice: 85000,
    },
  })

  // Seed a transferEventBooking
  await prisma.transferEventBooking.create({
    data: {
      transferId: transfer.id,
      eventId: event.id,
      passengerCount: 1,
      adultsCount: 1,
      childrenCount: 0,
      seniorsCount: 0,
    },
  })

  // Seed a passenger row
  await prisma.passenger.create({
    data: {
      name: "Test Passenger",
      transferId: transfer.id,
    },
  })

  // Re-fetch transfer with updatedAt
  const freshTransfer = await prisma.agencyTransfer.findUniqueOrThrow({
    where: { id: transfer.id },
  })

  return {
    transfer: freshTransfer,
    event,
    saleRecord,
    salePassenger,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("updateTransferExecutor integration", () => {
  beforeEach(async () => {
    await truncateAll()
  })

  afterAll(async () => {
    await disconnect()
  })

  // ── Happy path ───────────────────────────────────────────────────────────

  it("applies the update, creates reversal + new INCOME entries, and bumps updatedAt", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    const agency = await createTransferAgency()

    const cashBox = await createCashBox()

    const { transfer, event, saleRecord, salePassenger } =
      await seedTransferWithEventAndPassenger({
        createdById: admin.id,
        agencyId: agency.id,
      })

    // Seed an existing INCOME cash entry for this transfer
    await prisma.cashBoxEntry.create({
      data: {
        type: "INCOME",
        amount: 85000,
        currency: "CLP",
        description: `Cobro traspaso Efectivo - ${agency.name} (T-${transfer.voucher})`,
        reference: `T-${transfer.voucher}`,
        transferId: transfer.id,
        paymentMethod: "CASH",
        cashBoxId: cashBox.id,
        createdById: admin.id,
      },
    })

    const payload = buildPayloadWithPayment({
      agencyId: agency.id,
      passengerId: salePassenger.id,
      eventId: event.id,
      saleRecordId: saleRecord.id,
      cashAmount: 70000,
    })

    const request = await createUpdateTransferApproval({
      transferId: transfer.id,
      requestedById: admin.id,
      targetFingerprint: transfer.updatedAt.toISOString(),
      payload,
    })

    const updatedAtBefore = transfer.updatedAt

    const result = await prisma.$transaction(async (tx) => {
      return updateTransferExecutor({
        tx,
        targetId: transfer.id,
        request,
        requestedById: admin.id,
        resolvedById: admin.id,
        payload,
      })
    })

    expect(result.ok).toBe(true)

    // Reversal entry should exist
    const reversalEntries = await prisma.cashBoxEntry.findMany({
      where: { transferId: transfer.id, description: { startsWith: "[REVERSAL]" } },
    })
    expect(reversalEntries.length).toBeGreaterThan(0)
    expect(reversalEntries[0].amount).toBe(-85000)

    // New INCOME entry should exist
    const newIncomeEntries = await prisma.cashBoxEntry.findMany({
      where: {
        transferId: transfer.id,
        type: "INCOME",
        amount: 70000,
      },
    })
    expect(newIncomeEntries.length).toBe(1)

    // CRITICAL assertion (R5/ADR-5): updatedAt MUST advance
    const freshTransfer = await prisma.agencyTransfer.findUniqueOrThrow({
      where: { id: transfer.id },
    })
    expect(freshTransfer.updatedAt.getTime()).toBeGreaterThan(updatedAtBefore.getTime())
  })

  // ── Atomicity: cash-flow bug regression ─────────────────────────────────

  it("rolls back the entire transaction when cash entry creation fails — no orphaned reversals", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    const agency = await createTransferAgency()
    const cashBox = await createCashBox()

    const { transfer, event, saleRecord, salePassenger } =
      await seedTransferWithEventAndPassenger({
        createdById: admin.id,
        agencyId: agency.id,
      })

    // Seed existing INCOME entry
    const originalEntry = await prisma.cashBoxEntry.create({
      data: {
        type: "INCOME",
        amount: 85000,
        currency: "CLP",
        description: `Cobro traspaso Efectivo - ${agency.name} (T-${transfer.voucher})`,
        reference: `T-${transfer.voucher}`,
        transferId: transfer.id,
        paymentMethod: "CASH",
        cashBoxId: cashBox.id,
        createdById: admin.id,
      },
    })

    // Payment with invalid method to force a DB constraint failure
    // We trigger the failure by pointing to a non-existent cashBoxId via a
    // sabotaged payload — we'll force a throw mid-transaction instead.
    const payload: TransferFormData = {
      type: "OUTGOING",
      agencyId: agency.id,
      date: new Date(),
      paymentStatus: "FULLY_PAID",
      saleRecordId: saleRecord.id,
      comments: undefined,
      eventTransfers: [
        {
          eventId: event.id,
          transferEvent: true,
          passengerPrices: [
            {
              passengerId: salePassenger.id,
              passengerName: "Test Passenger",
              sourceSaleRecordId: saleRecord.id,
              ageCategory: "adult",
              tourPrice: 50000,
              entrancePrice: 20000,
              totalPrice: 70000,
              isSelected: true,
              isAlreadyTransferred: false,
            },
          ],
        },
      ],
      payments: [
        {
          refund: false,
          method: "CASH",
          amount: "70000",
          date: new Date(),
          documentNumber: undefined,
          comments: undefined,
        },
      ],
    }

    const request = await createUpdateTransferApproval({
      transferId: transfer.id,
      requestedById: admin.id,
      targetFingerprint: transfer.updatedAt.toISOString(),
      payload,
    })

    // Force a failure inside the transaction AFTER the reversal is written
    // by wrapping in a tx that we intentionally abort after the executor runs.
    let executorResult: Awaited<ReturnType<typeof updateTransferExecutor>> | null = null
    let txAborted = false

    try {
      await prisma.$transaction(async (tx) => {
        executorResult = await updateTransferExecutor({
          tx,
          targetId: transfer.id,
          request,
          requestedById: admin.id,
          resolvedById: admin.id,
          payload,
        })
        // Force rollback by throwing after the executor succeeds
        throw new Error("Forced rollback to test atomicity")
      })
    } catch (err) {
      if (err instanceof Error && err.message === "Forced rollback to test atomicity") {
        txAborted = true
      } else {
        throw err
      }
    }

    expect(txAborted).toBe(true)
    expect(executorResult?.ok).toBe(true)

    // After rollback: ZERO reversal entries (the reversal was inside the tx, must roll back)
    const reversalEntries = await prisma.cashBoxEntry.findMany({
      where: { transferId: transfer.id, description: { startsWith: "[REVERSAL]" } },
    })
    expect(reversalEntries).toHaveLength(0)

    // Original INCOME entry still intact (not deleted by rollback)
    const entry = await prisma.cashBoxEntry.findUnique({ where: { id: originalEntry.id } })
    expect(entry).not.toBeNull()
    expect(entry?.amount).toBe(85000)
  })

  // ── S-1: Internal rollback — real cash-flow asymmetry regression ─────────
  //
  // This test exercises the original cash-flow bug regression:
  // BEFORE the fix, reversal happened outside the tx (global prisma), so if the
  // new INCOME cashBoxEntry.create failed, the reversal was already committed.
  // AFTER the fix, both steps are inside applyTransferUpdateTx — any failure
  // rolls back reversal AND new INCOME atomically.
  //
  // We force the internal failure by passing a non-existent userId to
  // applyTransferUpdateTx: when the tx tries to INSERT into cash_box_entry with
  // createdById referencing a non-existent User row, it gets a FK violation
  // (P2003) mid-transaction — between the reversal write (step b) and the new
  // INCOME create (step d), causing the whole tx to abort.

  it("rolls back reversal when cashBoxEntry.create fails internally (real FK violation)", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    const agency = await createTransferAgency()
    const cashBox = await createCashBox()

    const { transfer, event, saleRecord, salePassenger } =
      await seedTransferWithEventAndPassenger({
        createdById: admin.id,
        agencyId: agency.id,
      })

    // Seed an existing INCOME entry for this transfer
    const originalEntry = await prisma.cashBoxEntry.create({
      data: {
        type: "INCOME",
        amount: 85000,
        currency: "CLP",
        description: `Cobro traspaso Efectivo - ${agency.name} (T-${transfer.voucher})`,
        reference: `T-${transfer.voucher}`,
        transferId: transfer.id,
        paymentMethod: "CASH",
        cashBoxId: cashBox.id,
        createdById: admin.id,
      },
    })

    // Payload includes a payment so step (d) runs cashBoxEntry.create
    const payload = buildPayloadWithPayment({
      agencyId: agency.id,
      passengerId: salePassenger.id,
      eventId: event.id,
      saleRecordId: saleRecord.id,
      cashAmount: 70000,
    })

    // Use a non-existent userId — the cashBoxEntry.create (step d) will fail with
    // FK violation on createdById, causing the full tx to abort (including step b reversal).
    const nonExistentUserId = "00000000-0000-0000-0000-000000000099"

    let threwInternally = false

    try {
      await prisma.$transaction(async (tx) => {
        await applyTransferUpdateTx(tx, transfer.id, payload, {
          uniqueSelectedPassengerPrices: [
            {
              passengerId: salePassenger.id,
              passengerName: "Test Passenger",
              sourceSaleRecordId: saleRecord.id,
              ageCategory: "adult",
              tourPrice: 50000,
              entrancePrice: 20000,
              totalPrice: 70000,
              isSelected: true,
              isAlreadyTransferred: false,
            },
          ],
          eventBookingsToCreate: [
            {
              eventId: event.id,
              passengerCount: 1,
              adultsCount: 1,
              childrenCount: 0,
              seniorsCount: 0,
            },
          ],
          agencyName: agency.name,
        }, nonExistentUserId)
      })
    } catch {
      threwInternally = true
    }

    // The tx MUST have aborted internally (FK violation on createdById)
    expect(threwInternally).toBe(true)

    // Original INCOME entry must still exist, untouched
    const entryAfter = await prisma.cashBoxEntry.findUnique({ where: { id: originalEntry.id } })
    expect(entryAfter).not.toBeNull()
    expect(entryAfter?.amount).toBe(85000)

    // No reversal entry should exist (step b rolled back with the tx)
    const reversalEntries = await prisma.cashBoxEntry.findMany({
      where: { transferId: transfer.id, description: { startsWith: "[REVERSAL]" } },
    })
    expect(reversalEntries).toHaveLength(0)

    // No new INCOME entry with amount 70000 (step d never committed)
    const newIncomeEntries = await prisma.cashBoxEntry.findMany({
      where: { transferId: transfer.id, type: "INCOME", amount: 70000 },
    })
    expect(newIncomeEntries).toHaveLength(0)

    // Transfer relation records must be unchanged (no deleted passengers/priceDetails)
    const priceDetails = await prisma.transferPriceDetail.findMany({
      where: { transferId: transfer.id },
    })
    expect(priceDetails.length).toBeGreaterThan(0)
  })

  // ── Fingerprint invalidation ─────────────────────────────────────────────

  it("returns invalidated:target_modified when fingerprint is stale", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    const agency = await createTransferAgency()

    const { transfer, event, saleRecord, salePassenger } =
      await seedTransferWithEventAndPassenger({
        createdById: admin.id,
        agencyId: agency.id,
      })

    const payload = buildPayload({
      agencyId: agency.id,
      passengerId: salePassenger.id,
      eventId: event.id,
      saleRecordId: saleRecord.id,
    })

    // Create approval with an OLD fingerprint (stale)
    const staleFingerprint = new Date(transfer.updatedAt.getTime() - 10000).toISOString()
    const request = await createUpdateTransferApproval({
      transferId: transfer.id,
      requestedById: admin.id,
      targetFingerprint: staleFingerprint,
      payload,
    })

    const result = await prisma.$transaction(async (tx) => {
      return updateTransferExecutor({
        tx,
        targetId: transfer.id,
        request,
        requestedById: admin.id,
        resolvedById: admin.id,
        payload,
      })
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("unreachable")
    expect("invalidated" in result && result.invalidated).toBe(true)
    if (!("invalidated" in result)) throw new Error("unreachable")
    expect(result.reason).toBe("target_modified")
  })

  // ── Status guard: CANCELLED ──────────────────────────────────────────────

  it("returns invalidated when transfer is CANCELLED", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    const agency = await createTransferAgency()

    const transfer = await createTransfer({
      createdById: admin.id,
      agencyId: agency.id,
      status: "CANCELLED",
    })

    const payload = buildPayload({
      agencyId: agency.id,
      passengerId: "dummy-p",
      eventId: "dummy-e",
      saleRecordId: "dummy-s",
    })

    const request = await createUpdateTransferApproval({
      transferId: transfer.id,
      requestedById: admin.id,
      targetFingerprint: transfer.updatedAt.toISOString(),
      payload,
    })

    const result = await prisma.$transaction(async (tx) => {
      return updateTransferExecutor({
        tx,
        targetId: transfer.id,
        request,
        requestedById: admin.id,
        resolvedById: admin.id,
        payload,
      })
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("unreachable")
    expect("invalidated" in result && result.invalidated).toBe(true)
  })

  // ── Missing target ───────────────────────────────────────────────────────

  it("returns invalidated:target_not_found when transfer does not exist", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    const agency = await createTransferAgency()

    const payload = buildPayload({
      agencyId: agency.id,
      passengerId: "dummy",
      eventId: "dummy",
      saleRecordId: "dummy",
    })

    const request = await createUpdateTransferApproval({
      transferId: "non-existent-transfer-id",
      requestedById: admin.id,
      payload,
    })

    const result = await prisma.$transaction(async (tx) => {
      return updateTransferExecutor({
        tx,
        targetId: "non-existent-transfer-id",
        request,
        requestedById: admin.id,
        resolvedById: admin.id,
        payload,
      })
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("unreachable")
    expect("invalidated" in result && result.invalidated).toBe(true)
    if (!("invalidated" in result)) throw new Error("unreachable")
    expect(result.reason).toBe("target_not_found")
  })

  // ── Invalid payload ──────────────────────────────────────────────────────

  it("returns error (not invalidated) when stored payload is invalid", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    const agency = await createTransferAgency()

    const { transfer } = await seedTransferWithEventAndPassenger({
      createdById: admin.id,
      agencyId: agency.id,
    })

    // Create approval with corrupted payload
    const request = await prisma.approvalRequest.create({
      data: {
        action: APPROVAL_ACTION.UPDATE_TRANSFER,
        domain: "transfers",
        status: "PENDING",
        targetType: "agency-transfer",
        targetId: transfer.id,
        codeHash: "test-hash",
        codeLast4: "0000",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        requestedById: admin.id,
        targetFingerprint: transfer.updatedAt.toISOString(),
        metadata: { payload: { invalid: "garbage" } },
      },
    })

    const result = await prisma.$transaction(async (tx) => {
      return updateTransferExecutor({
        tx,
        targetId: transfer.id,
        request,
        requestedById: admin.id,
        resolvedById: admin.id,
        payload: {} as TransferFormData,
      })
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("unreachable")
    // Should be a validation error (not invalidated)
    expect("error" in result).toBe(true)
    if (!("error" in result)) throw new Error("unreachable")
    expect(result.error).toContain("Payload inválido")
  })
})
