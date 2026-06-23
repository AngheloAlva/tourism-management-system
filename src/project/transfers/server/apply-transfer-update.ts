/**
 * Shared transactional core for transfer updates.
 *
 * Exports:
 * - Pure helpers (unit-testable, no DB): dedupePassengerPrices, buildEventBookings,
 *   checkAlreadyTransferred
 * - prepareTransferUpdate(id, data, current) — async, hits DB for already-transferred check;
 *   throws on conflict; returns PreparedTransferUpdate
 * - applyTransferUpdateTx(tx, id, data, prepared, userId) — runs INSIDE a $transaction:
 *   deletes old children → reverses INCOME cash entries → recreates nested relations →
 *   registers NEW cash entries (all inside the same tx, fixing the cash-flow asymmetry bug).
 *
 * NOT a "use server" file — this is a server-only helper module.
 *
 * Design reference: mirrors src/project/sales/server/apply-sale-update.ts
 */

import { startOfDay } from "date-fns"
import { prisma } from "@/lib/prisma"
import type { Prisma, PrismaClient } from "@/generated/prisma/client"
import type { TransferFormData, PassengerPrice } from "../schemas/transfer.schema"
import type { PAYMENT_METHOD, TRANSFER_PAYMENT_STATUS } from "@/generated/prisma/enums"

// ── Types ─────────────────────────────────────────────────────────────────────

export type TransferUpdateTxClient = Prisma.TransactionClient

export interface TransferUpdateCurrentRecord {
  id: string
  voucher: number
  agencyId: string
  agency: { name: string }
  priceDetails: Array<{ id: string; sourcePassengerId: string | null }>
  passengers: Array<{ id: string }>
  eventBookings: Array<{ id: string; event: { id: string; date: Date } }>
  payments: Array<{ id: string }>
}

export interface EventBookingToCreate {
  eventId: string
  passengerCount: number
  adultsCount: number
  childrenCount: number
  seniorsCount: number
}

export interface PreparedTransferUpdate {
  uniqueSelectedPassengerPrices: PassengerPrice[]
  eventBookingsToCreate: EventBookingToCreate[]
  agencyName: string
  /** Immutable voucher number from the current DB record — resolved in prepareTransferUpdate. */
  voucher: number
}

// ── Payment method labels (mirrors cash-flow-internal.ts) ─────────────────────

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  CREDIT_CARD: "Tarjeta de Credito",
  DEBIT_CARD: "Tarjeta de Debito",
  PAYMENT_LINK_DEBIT: "Link de pago Debito",
  PAYMENT_LINK_CREDIT: "Link de pago Credito",
}

// ── Pure helpers (unit-testable) ──────────────────────────────────────────────

/**
 * Deduplicates passenger prices by passengerId. First occurrence wins.
 */
export function dedupePassengerPrices(prices: PassengerPrice[]): PassengerPrice[] {
  const seen = new Map<string, PassengerPrice>()
  for (const p of prices) {
    if (!seen.has(p.passengerId)) {
      seen.set(p.passengerId, p)
    }
  }
  return Array.from(seen.values())
}

/**
 * Aggregates event bookings from passengers grouped by event, excluding already-transferred.
 * Returns only events that have at least one non-transferred passenger.
 */
export function buildEventBookings(
  passengersByEvent: Array<{ eventId: string; passengerPrices: PassengerPrice[] }>,
  alreadyTransferredIds: Set<string>
): EventBookingToCreate[] {
  return passengersByEvent
    .map((eventTransfer) => {
      const eligible = eventTransfer.passengerPrices.filter(
        (p) => !alreadyTransferredIds.has(p.passengerId)
      )
      if (eligible.length === 0) return null

      const counts = eligible.reduce(
        (acc, p) => {
          acc.total++
          if (p.ageCategory === "adult") acc.adults++
          if (p.ageCategory === "child") acc.children++
          if (p.ageCategory === "senior") acc.seniors++
          return acc
        },
        { total: 0, adults: 0, children: 0, seniors: 0 }
      )

      return {
        eventId: eventTransfer.eventId,
        passengerCount: counts.total,
        adultsCount: counts.adults,
        childrenCount: counts.children,
        seniorsCount: counts.seniors,
      }
    })
    .filter((b): b is EventBookingToCreate => b !== null)
}

/**
 * Returns the names of passengers that are in the alreadyTransferredIds set.
 * Capped at 5 to avoid overly long error messages.
 */
export function checkAlreadyTransferred(
  passengers: PassengerPrice[],
  alreadyTransferredIds: Set<string>
): string[] {
  return passengers
    .filter((p) => alreadyTransferredIds.has(p.passengerId))
    .map((p) => p.passengerName)
    .slice(0, 5)
}

// ── prepareTransferUpdate (async, hits DB) ────────────────────────────────────

/**
 * Validates and prepares the transfer update payload.
 * Throws on conflict (already-transferred passengers).
 * Returns PreparedTransferUpdate with the deduplicated selection + event bookings + agency name.
 *
 * @param db - Prisma client or transaction client. Pass `tx` when calling from inside a
 *   $transaction so reads participate in the same snapshot. Pass the global `prisma` client
 *   for direct (non-transactional) callers.
 */
export async function prepareTransferUpdate(
  id: string,
  data: TransferFormData,
  current: TransferUpdateCurrentRecord,
  db: PrismaClient | Prisma.TransactionClient = prisma
): Promise<PreparedTransferUpdate> {
  const transferredEvents = data.eventTransfers.filter((et) => et.transferEvent)

  if (transferredEvents.length === 0) {
    throw new Error("Debe seleccionar al menos un evento para transferir")
  }

  const selectedPassengersByEvent = transferredEvents
    .map((eventTransfer) => ({
      eventId: eventTransfer.eventId,
      passengerPrices: (eventTransfer.passengerPrices ?? []).filter(
        (p) =>
          p.isSelected &&
          !p.isAlreadyTransferred &&
          p.sourceSaleRecordId === data.saleRecordId
      ),
    }))
    .filter((et) => et.passengerPrices.length > 0)

  const selectedPassengerPrices = selectedPassengersByEvent.flatMap((et) => et.passengerPrices)

  if (selectedPassengerPrices.length === 0) {
    throw new Error("Debe seleccionar al menos un pasajero para transferir")
  }

  const uniqueSelectedPassengerPrices = dedupePassengerPrices(selectedPassengerPrices)

  const selectedPassengerIds = uniqueSelectedPassengerPrices
    .map((p) => p.passengerId)
    .filter(Boolean)

  if (selectedPassengerIds.length === 0) {
    throw new Error("No se pudo identificar los pasajeros seleccionados para transferir")
  }

  const selectedEventIds = Array.from(new Set(selectedPassengersByEvent.map((et) => et.eventId)))

  // CRITICAL: exclude current transfer so its own passengers don't appear as conflicts
  const alreadyTransferredPassengers = await db.transferPriceDetail.findMany({
    where: {
      sourcePassengerId: { in: selectedPassengerIds },
      transfer: {
        type: "OUTGOING",
        id: { not: id },
        eventBookings: {
          some: { eventId: { in: selectedEventIds } },
        },
      },
    },
    select: { sourcePassengerId: true },
  })

  const alreadyTransferredIds = new Set(
    alreadyTransferredPassengers
      .map((p) => p.sourcePassengerId)
      .filter((pid): pid is string => Boolean(pid))
  )

  if (alreadyTransferredIds.size > 0) {
    const conflictNames = checkAlreadyTransferred(
      uniqueSelectedPassengerPrices,
      alreadyTransferredIds
    )
    throw new Error(
      `Algunos pasajeros ya fueron traspasados y no pueden repetirse: ${conflictNames.join(", ")}`
    )
  }

  const eventBookingsToCreate = buildEventBookings(selectedPassengersByEvent, alreadyTransferredIds)

  if (eventBookingsToCreate.length === 0) {
    throw new Error(
      "No hay pasajeros disponibles para transferir en los eventos seleccionados"
    )
  }

  const agencyName =
    data.agencyId === current.agencyId
      ? current.agency.name
      : ((
          await db.transferAgency.findUnique({
            where: { id: data.agencyId },
            select: { name: true },
          })
        )?.name ?? "Agencia")

  return {
    uniqueSelectedPassengerPrices,
    eventBookingsToCreate,
    agencyName,
    // voucher is immutable — read from the current record so applyTransferUpdateTx
    // can build the reference string without an extra DB round-trip.
    voucher: current.voucher,
  }
}

// ── applyTransferUpdateTx (runs inside $transaction) ─────────────────────────

/**
 * Applies the transfer update inside a Prisma transaction.
 *
 * Steps (ALL inside tx — fixes the cash-flow asymmetry bug):
 *   a. Delete old child relations (priceDetails, eventBookings, passengers, paymentRecords)
 *   b. Reverse old INCOME cash entries via cashBoxEntry.createMany with negative amounts
 *   c. Update agencyTransfer scalars + recreate nested relations (passengers, priceDetails,
 *      eventBookings, payments) in a single tx.agencyTransfer.update
 *   d. Register new INCOME cash entries directly via tx.cashBoxEntry.create
 *      (NOT via global registerCashFlowFromTransfer — that function opens its own DB connection
 *       and cannot participate in the caller's tx)
 *
 * IMPORTANT: steps (b) and (d) are both inside the same tx. If (d) fails, (b) rolls back too —
 * no orphaned reversal entries.
 */
export async function applyTransferUpdateTx(
  tx: TransferUpdateTxClient,
  id: string,
  data: TransferFormData,
  prepared: PreparedTransferUpdate,
  userId: string
): Promise<void> {
  const { uniqueSelectedPassengerPrices, eventBookingsToCreate, agencyName, voucher } = prepared

  // a. Delete old child relations
  await tx.transferPriceDetail.deleteMany({ where: { transferId: id } })
  await tx.transferEventBooking.deleteMany({ where: { transferId: id } })
  await tx.passenger.deleteMany({ where: { transferId: id } })
  await tx.paymentRecord.deleteMany({ where: { transferId: id } })

  // b. Reverse old INCOME cash entries (inside tx — symmetric with step d)
  const oldEntries = await tx.cashBoxEntry.findMany({
    where: { transferId: id, type: "INCOME" },
  })

  if (oldEntries.length > 0) {
    await tx.cashBoxEntry.createMany({
      data: oldEntries.map((entry) => ({
        type: entry.type,
        amount: -entry.amount,
        currency: entry.currency,
        originalAmount: entry.originalAmount ? -entry.originalAmount : null,
        description: `[REVERSAL] ${entry.description}`,
        reference: entry.reference,
        transferId: entry.transferId,
        paymentMethod: entry.paymentMethod,
        cashBoxId: entry.cashBoxId,
        createdById: userId,
      })),
    })
  }

  // c. Update scalars + recreate passengers and priceDetails + eventBookings (no payments yet)
  await tx.agencyTransfer.update({
    where: { id },
    data: {
      agencyId: data.agencyId,
      date: data.date,
      paymentStatus: data.paymentStatus as TRANSFER_PAYMENT_STATUS,
      comments: data.comments ?? null,

      passengers: {
        create: uniqueSelectedPassengerPrices.map((pp) => ({
          name: pp.passengerName,
        })),
      },

      priceDetails: {
        create: uniqueSelectedPassengerPrices.map((pp) => ({
          passengerName: pp.passengerName,
          sourcePassengerId: pp.passengerId,
          ageCategory: pp.ageCategory,
          tourPrice: pp.tourPrice,
          entrancePrice: pp.entrancePrice,
          totalPrice: pp.totalPrice,
        })),
      },

      eventBookings: {
        create: eventBookingsToCreate,
      },
    },
  })

  // d. Register new INCOME cash entries inside tx (NOT global registerCashFlowFromTransfer)
  //    S-2 FIX: create paymentRecord rows one-by-one so we have their IDs before creating
  //    cashBoxEntry rows. This eliminates the fragile amount+method lookup that failed when
  //    two payments had identical amount and method.
  const paymentInputs = data.payments ?? []

  // voucher is immutable and was resolved in prepareTransferUpdate — no extra DB round-trip needed.
  const reference = `T-${voucher}`

  // Get or create today's cash box using the tx handle (needed even if we have no income payments,
  // to ensure the tx remains clean — only open the box when there are payments to register)
  const newPayments = paymentInputs.filter((p) => !p.refund && parseFloat(p.amount) > 0)

  let cashBox: { id: string } | null = null
  if (newPayments.length > 0) {
    const today = startOfDay(new Date())
    cashBox = await tx.cashBox.findUnique({ where: { date: today } })
    if (!cashBox) {
      const previousCashBox = await tx.cashBox.findFirst({
        where: { date: { lt: today }, status: "CLOSED" },
        orderBy: { date: "desc" },
      })
      cashBox = await tx.cashBox.create({
        data: {
          date: today,
          initialBalance: previousCashBox?.finalBalance ?? 0,
          initialUsdBalance: previousCashBox?.finalUsdBalance ?? 0,
          status: "OPEN",
        },
      })
    }
  }

  // Create each paymentRecord individually, then immediately create its cashBoxEntry
  // using the real ID — no post-hoc amount+method lookup needed.
  for (const payment of paymentInputs) {
    const amount = parseFloat(payment.amount)

    const createdPayment = await tx.paymentRecord.create({
      data: {
        transferId: id,
        amount,
        method: payment.method as PAYMENT_METHOD,
        date: payment.date,
        documentNumber: payment.documentNumber,
        comments: payment.comments,
        refund: payment.refund,
        isTransferPayment: true,
      },
    })

    // Only register an INCOME entry for non-refund positive payments
    if (!payment.refund && amount > 0 && cashBox) {
      const methodLabel = PAYMENT_METHOD_LABELS[payment.method] ?? payment.method
      await tx.cashBoxEntry.create({
        data: {
          type: "INCOME",
          amount,
          currency: "CLP",
          originalAmount: amount,
          description: `Cobro traspaso ${methodLabel} - ${agencyName} (T-${voucher})`,
          reference,
          transferId: id,
          paymentMethod: payment.method as PAYMENT_METHOD,
          cashBoxId: cashBox.id,
          createdById: userId,
          paymentRecordId: createdPayment.id, // ← direct link, no lookup
        },
      })
    }
  }
}
