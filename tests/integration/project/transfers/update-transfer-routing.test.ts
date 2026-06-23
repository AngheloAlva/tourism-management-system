/**
 * S2-T4 RED: Integration tests for the Slice 2 routing changes in updateTransfer.
 *
 * Covers:
 * - Routing: non-admin + LARGE change without reason → needsReason
 * - Routing: non-admin + LARGE change with reason → ApprovalRequest PENDING, no mutation
 * - Routing: admin + LARGE change → direct mutation, no ApprovalRequest
 * - Routing: non-admin + SMALL change → direct mutation, no ApprovalRequest
 * - Atomicity: updateTransfer now uses applyTransferUpdateTx (reversal + new cash in same tx)
 * - S-2: Two identical payments (same amount + method) link to distinct paymentRecord IDs
 *
 * All tests use Docker testcontainer via the global setup.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { updateTransfer } from "@/project/transfers/actions/transfer.actions"
import { applyTransferUpdateTx } from "@/project/transfers/server/apply-transfer-update"
import {
  createUser,
  createTransfer,
  createTransferAgency,
  createCashBox,
  createTour,
  createEvent,
  createSaleRecord,
} from "../../helpers/factories"
import { loginAs } from "../../helpers/auth"
import { truncateAll, disconnect } from "../../helpers/db"
import type { TransferFormData } from "@/project/transfers/schemas/transfer.schema"
import { MODULE_DEFINITIONS } from "@/project/roles/constants/modules"
import { SYSTEM_ROLE_KEY, getDefaultPermissionForRole } from "@/project/roles/constants/system-roles"

/**
 * Sets up the operadora system role in the DB with default permissions.
 * This is required for non-admin users to pass canCurrentUserInteractPaths.
 * The operadora role has canInteract=true for /traspasos and /navegacion-traspasos.
 */
async function ensureOperadoraRole(): Promise<void> {
  const role = await prisma.role.upsert({
    where: { key: SYSTEM_ROLE_KEY.OPERADORA },
    create: {
      key: SYSTEM_ROLE_KEY.OPERADORA,
      name: "Operadora",
      description: "Operación comercial y gestión diaria",
      isSystem: true,
      isActive: true,
    },
    update: {},
  })

  for (const module of MODULE_DEFINITIONS) {
    const defaults = getDefaultPermissionForRole(SYSTEM_ROLE_KEY.OPERADORA, module.key)
    await prisma.roleModulePermission.upsert({
      where: { roleId_moduleKey: { roleId: role.id, moduleKey: module.key } },
      create: {
        roleId: role.id,
        moduleKey: module.key,
        visible: defaults.visible,
        canInteract: defaults.canInteract,
      },
      update: {},
    })
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildPayload(opts: {
  agencyId: string
  passengerId: string
  eventId: string
  saleRecordId: string
  payments?: TransferFormData["payments"]
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
    payments: opts.payments ?? [],
  }
}

/**
 * Seeds a minimal transfer with event booking, price detail, and sale passenger.
 * Returns everything needed for test assertions.
 */
async function seedTransfer(opts: {
  createdById: string
  agencyId: string
}) {
  const tour = await createTour()
  const event = await createEvent({ tourId: tour.id })
  const saleRecord = await createSaleRecord({ sellerId: opts.createdById })

  const salePassenger = await prisma.passenger.create({
    data: { name: "Test Passenger", saleRecordId: saleRecord.id },
  })

  const transfer = await createTransfer({
    createdById: opts.createdById,
    agencyId: opts.agencyId,
    saleRecordId: saleRecord.id,
  })

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

  await prisma.passenger.create({
    data: { name: "Test Passenger", transferId: transfer.id },
  })

  // Re-fetch with updatedAt
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

describe("updateTransfer routing (Slice 2)", () => {
  beforeEach(async () => {
    await truncateAll()
    vi.mocked(revalidatePath).mockClear()
    // Ensure operadora system role exists with correct permissions
    await ensureOperadoraRole()
  })

  afterAll(async () => {
    await disconnect()
  })

  // ── LARGE change, non-admin, no reason → needsReason ──────────────────────

  it("non-admin + LARGE change (new event) without reason → returns needsReason, no DB mutation", async () => {
    const operator = await createUser({ role: "operadora", mustChangePassword: false })
    loginAs(operator)
    const agency = await createTransferAgency()
    const { transfer, saleRecord, salePassenger } = await seedTransfer({
      createdById: operator.id,
      agencyId: agency.id,
    })

    // Create a different event to cause a LARGE change
    const tour2 = await createTour()
    const newEvent = await createEvent({ tourId: tour2.id })

    const payload = buildPayload({
      agencyId: agency.id,
      passengerId: salePassenger.id,
      eventId: newEvent.id, // ← different event = LARGE change
      saleRecordId: saleRecord.id,
    })

    const result = await updateTransfer(transfer.id, payload)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error("unreachable")
    // @ts-expect-error — widened return type
    expect(result.approvalRequired).toBe(true)
    // @ts-expect-error — widened return type
    expect(result.needsReason).toBe(true)

    // No ApprovalRequest should have been created
    const requests = await prisma.approvalRequest.findMany({
      where: { targetId: transfer.id },
    })
    expect(requests).toHaveLength(0)

    // Transfer structure should be unchanged
    const priceDetails = await prisma.transferPriceDetail.findMany({
      where: { transferId: transfer.id },
    })
    expect(priceDetails).toHaveLength(1) // original unchanged

    // revalidatePath NOT called
    expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled()
  })

  // ── LARGE change, non-admin, with reason → ApprovalRequest, no mutation ───

  it("non-admin + LARGE change with reason → creates PENDING ApprovalRequest, no transfer mutation", async () => {
    const operator = await createUser({ role: "operadora", mustChangePassword: false })
    loginAs(operator)
    const agency = await createTransferAgency()
    const { transfer, saleRecord, salePassenger } = await seedTransfer({
      createdById: operator.id,
      agencyId: agency.id,
    })

    // Add a new passenger to make it a LARGE change (different passenger set)
    const extraPassenger = await prisma.passenger.create({
      data: { name: "Extra Passenger", saleRecordId: saleRecord.id },
    })

    const payload: TransferFormData = {
      type: "OUTGOING",
      agencyId: agency.id,
      date: new Date(),
      paymentStatus: "PENDING",
      comments: undefined,
      saleRecordId: saleRecord.id,
      eventTransfers: [
        {
          // Keep the same event but add a second passenger → passengerIds set changes = LARGE
          eventId: "00000000-0000-0000-0000-000000000000", // placeholder; overridden below with real eventId
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
            {
              passengerId: extraPassenger.id,
              passengerName: "Extra Passenger",
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
      payments: [],
    }

    // Fetch the original event so we can use the correct eventId
    const originalBooking = await prisma.transferEventBooking.findFirst({
      where: { transferId: transfer.id },
      select: { eventId: true },
    })
    payload.eventTransfers[0].eventId = originalBooking!.eventId

    const result = await updateTransfer(transfer.id, payload, "Corrección de pasajeros")

    expect(result.success).toBe(true)
    if (!result.success) throw new Error("unreachable")
    // @ts-expect-error — widened return type
    expect(result.approvalRequired).toBe(true)
    // @ts-expect-error — widened return type
    expect(result.requestId).toBeTruthy()

    // ApprovalRequest should exist with PENDING status
    // @ts-expect-error — widened return type
    const request = await prisma.approvalRequest.findUnique({ where: { id: result.requestId } })
    expect(request).not.toBeNull()
    expect(request?.status).toBe("PENDING")
    expect(request?.action).toBe("UPDATE_TRANSFER")
    expect(request?.targetId).toBe(transfer.id)

    // Transfer structure NOT mutated (still 1 price detail)
    const priceDetails = await prisma.transferPriceDetail.findMany({
      where: { transferId: transfer.id },
    })
    expect(priceDetails).toHaveLength(1)

    // revalidatePath NOT called
    expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled()
  })

  // ── LARGE change, admin → direct mutation, no ApprovalRequest ──────────────

  it("admin + LARGE change (new event) → executes mutation directly, no ApprovalRequest", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    loginAs(admin)
    await createCashBox()
    const agency = await createTransferAgency()
    const { transfer, saleRecord, salePassenger } = await seedTransfer({
      createdById: admin.id,
      agencyId: agency.id,
    })

    // New event = LARGE change
    const tour2 = await createTour()
    const newEvent = await createEvent({ tourId: tour2.id })

    const payload = buildPayload({
      agencyId: agency.id,
      passengerId: salePassenger.id,
      eventId: newEvent.id,
      saleRecordId: saleRecord.id,
    })

    const result = await updateTransfer(transfer.id, payload)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error("unreachable")
    // No approvalRequired on success path
    expect("approvalRequired" in result ? result.approvalRequired : false).toBe(false)

    // No ApprovalRequest created
    const requests = await prisma.approvalRequest.findMany({
      where: { targetId: transfer.id },
    })
    expect(requests).toHaveLength(0)

    // Transfer structure WAS mutated — new event booking exists
    const bookings = await prisma.transferEventBooking.findMany({
      where: { transferId: transfer.id },
    })
    expect(bookings).toHaveLength(1)
    expect(bookings[0].eventId).toBe(newEvent.id) // new event

    // revalidatePath called
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/dashboard/navegacion-traspasos")
  })

  // ── SMALL change, any role → direct mutation, no ApprovalRequest ──────────

  it("non-admin + SMALL change (only agencyId changed) → executes directly, no ApprovalRequest", async () => {
    const operator = await createUser({ role: "operadora", mustChangePassword: false })
    loginAs(operator)
    await createCashBox()
    const agency = await createTransferAgency()
    const newAgency = await createTransferAgency()
    const { transfer, event, saleRecord, salePassenger } = await seedTransfer({
      createdById: operator.id,
      agencyId: agency.id,
    })

    // Same event, same passenger — only agencyId differs = SMALL
    const payload = buildPayload({
      agencyId: newAgency.id,
      passengerId: salePassenger.id,
      eventId: event.id,
      saleRecordId: saleRecord.id,
    })

    const result = await updateTransfer(transfer.id, payload)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error("unreachable")
    expect("approvalRequired" in result ? result.approvalRequired : false).toBe(false)

    // No ApprovalRequest created
    const requests = await prisma.approvalRequest.findMany({
      where: { targetId: transfer.id },
    })
    expect(requests).toHaveLength(0)

    // Transfer agencyId was updated
    const updated = await prisma.agencyTransfer.findUnique({ where: { id: transfer.id } })
    expect(updated?.agencyId).toBe(newAgency.id)

    // revalidatePath called (direct path)
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/dashboard/navegacion-traspasos")
  })

  // ── Atomicity: reversal + new cash in same tx (W-3 fix) ───────────────────

  it("direct path (admin/small) is atomic: reversal and new INCOME both committed, or both rolled back", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    loginAs(admin)
    const cashBox = await createCashBox()
    const agency = await createTransferAgency()
    const { transfer, event, saleRecord, salePassenger } = await seedTransfer({
      createdById: admin.id,
      agencyId: agency.id,
    })

    // Seed an existing INCOME entry
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

    const payload = buildPayload({
      agencyId: agency.id,
      passengerId: salePassenger.id,
      eventId: event.id,
      saleRecordId: saleRecord.id,
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
    })

    const result = await updateTransfer(transfer.id, { ...payload, paymentStatus: "FULLY_PAID" })

    expect(result.success).toBe(true)

    // Reversal must exist
    const reversals = await prisma.cashBoxEntry.findMany({
      where: { transferId: transfer.id, description: { startsWith: "[REVERSAL]" } },
    })
    expect(reversals.length).toBeGreaterThan(0)

    // New INCOME must exist
    const newIncome = await prisma.cashBoxEntry.findMany({
      where: { transferId: transfer.id, type: "INCOME", amount: 70000 },
    })
    expect(newIncome.length).toBeGreaterThan(0)
  })

  // ── S-2: Two identical payments link to distinct paymentRecord IDs ─────────

  it("S-2: two payments with same amount+method each link to a distinct paymentRecord (no cross-link)", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    loginAs(admin)
    const cashBox = await createCashBox()
    const agency = await createTransferAgency()
    const { transfer, event, saleRecord, salePassenger } = await seedTransfer({
      createdById: admin.id,
      agencyId: agency.id,
    })

    // Two identical payments: same amount, same method
    const payload: TransferFormData = {
      type: "OUTGOING",
      agencyId: agency.id,
      date: new Date(),
      paymentStatus: "FULLY_PAID",
      comments: undefined,
      saleRecordId: saleRecord.id,
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
        { refund: false, method: "CASH", amount: "10000", date: new Date(), documentNumber: undefined, comments: undefined },
        { refund: false, method: "CASH", amount: "10000", date: new Date(), documentNumber: undefined, comments: undefined },
      ],
    }

    const result = await updateTransfer(transfer.id, payload)
    expect(result.success).toBe(true)

    // There should be 2 paymentRecords
    const paymentRecords = await prisma.paymentRecord.findMany({
      where: { transferId: transfer.id },
    })
    expect(paymentRecords).toHaveLength(2)

    // There should be 2 cashBoxEntries for INCOME
    const cashEntries = await prisma.cashBoxEntry.findMany({
      where: { transferId: transfer.id, type: "INCOME", amount: 10000 },
    })
    expect(cashEntries).toHaveLength(2)

    // Each cashBoxEntry must link to a DIFFERENT paymentRecord
    const linkedIds = cashEntries.map((e) => e.paymentRecordId).filter(Boolean)
    expect(linkedIds).toHaveLength(2)
    expect(new Set(linkedIds).size).toBe(2) // all distinct
  })
})

// ── S-2 direct test via applyTransferUpdateTx ─────────────────────────────────
// Tests the fix at the core tx level without going through the action

describe("applyTransferUpdateTx — S-2 paymentRecord link correctness", () => {
  beforeEach(async () => {
    await truncateAll()
    vi.mocked(revalidatePath).mockClear()
  })

  afterAll(async () => {
    await disconnect()
  })

  it("two payments with same amount+method create 2 cashBoxEntries each linked to a different paymentRecord", async () => {
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    const cashBox = await createCashBox()
    const agency = await createTransferAgency()
    const tour = await createTour()
    const event = await createEvent({ tourId: tour.id })
    const saleRecord = await createSaleRecord({ sellerId: admin.id })
    const salePassenger = await prisma.passenger.create({
      data: { name: "P1", saleRecordId: saleRecord.id },
    })
    const transfer = await createTransfer({
      createdById: admin.id,
      agencyId: agency.id,
      saleRecordId: saleRecord.id,
    })

    // Prepare a prepared object manually (bypass prepareTransferUpdate for this tx-level test)
    const prepared = {
      uniqueSelectedPassengerPrices: [
        {
          passengerId: salePassenger.id,
          passengerName: "P1",
          sourceSaleRecordId: saleRecord.id,
          ageCategory: "adult" as const,
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
    }

    const data: TransferFormData = {
      type: "OUTGOING",
      agencyId: agency.id,
      date: new Date(),
      paymentStatus: "FULLY_PAID",
      comments: undefined,
      saleRecordId: saleRecord.id,
      eventTransfers: [
        {
          eventId: event.id,
          transferEvent: true,
          passengerPrices: [
            {
              passengerId: salePassenger.id,
              passengerName: "P1",
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
        { refund: false, method: "CASH", amount: "5000", date: new Date(), documentNumber: undefined, comments: undefined },
        { refund: false, method: "CASH", amount: "5000", date: new Date(), documentNumber: undefined, comments: undefined },
      ],
    }

    await prisma.$transaction((tx) =>
      applyTransferUpdateTx(tx, transfer.id, data, prepared, admin.id)
    )

    const paymentRecords = await prisma.paymentRecord.findMany({
      where: { transferId: transfer.id },
    })
    expect(paymentRecords).toHaveLength(2)

    const cashEntries = await prisma.cashBoxEntry.findMany({
      where: { transferId: transfer.id, type: "INCOME" },
    })
    expect(cashEntries).toHaveLength(2)

    const linkedIds = cashEntries.map((e) => e.paymentRecordId).filter(Boolean)
    expect(linkedIds).toHaveLength(2)
    expect(new Set(linkedIds).size).toBe(2) // each cashBoxEntry → distinct paymentRecord
  })
})
