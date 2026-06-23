/**
 * Shared core for sale record updates.
 *
 * This module exports:
 * - `isInvoiced(record)` — pure helper; detects whether a sale is invoiced
 *   by checking wholesaleInvoiceLine != null (REQ-2: line-existence only,
 *   does NOT inspect parent WholesaleInvoice.status).
 * - `applySaleUpdateTx(tx, id, validatedData, currentRecord)` — extracted
 *   $transaction body from updateSaleRecord. Behavior-preserving: identical
 *   to the pre-extraction implementation. Called by BOTH:
 *   (a) the direct updateSaleRecord path (non-invoiced or admin),
 *   (b) the updateInvoicedSaleExecutor on approval replay.
 *
 * IMPORTANT: This file is NOT a "use server" file — it contains server-only
 * helpers but is not a Next.js server action entry point.
 */

import type { Prisma } from "@/generated/prisma/client"
import type { SaleRecordFormSchema } from "../schemas/sale-record.schema"
import { parseCalendarDay, formatCalendarDay } from "@/shared/utils/calendar-day"
import { applyFirstEventDate } from "./first-event-date"

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Prisma transaction client — canonical type from @prisma/client.
 */
export type SaleUpdateTxClient = Prisma.TransactionClient

/**
 * Shape of the currentRecord that must be passed into applySaleUpdateTx.
 * The caller (action or executor) is responsible for fetching this with
 * the correct include. Required relations:
 *   - eventBookings with eventId and passengerCount (for booking revert)
 */
export type SaleUpdateCurrentRecord = {
  id: string
  eventBookings: Array<{
    eventId: string
    passengerCount: number
  }>
}

/**
 * Minimal record shape accepted by isInvoiced.
 * Decoupled from Prisma types so it works in unit tests without DB.
 */
export type MaybeInvoicedRecord = {
  wholesaleInvoiceLine?: unknown
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Returns true when the sale has a WholesaleInvoiceLine linked.
 * Detection is based on line-existence only (wholesaleInvoiceLine != null).
 * Does NOT inspect parent WholesaleInvoice.status (locked decision, REQ-2).
 */
export function isInvoiced(record: MaybeInvoicedRecord): boolean {
  return record.wholesaleInvoiceLine != null
}

// ── Payment normalisation ────────────────────────────────────────────────────

/**
 * Normalizes payment amounts from form schema to storage shape.
 * Behavior is identical to the private getNormalizedPaymentAmounts helper
 * in sale-record.actions.ts.
 */
export function getNormalizedPaymentAmountsFromSchema(
  payment: SaleRecordFormSchema["paymentArray"][number]
): {
  amountInClp: number
  currency: string
  originalAmount: number | null
  exchangeRate: number | null
} {
  const amount = Number(payment.amount || 0)
  const currency = payment.currency || "CLP"
  const exchangeRate = currency === "USD" ? Number(payment.exchange_rate || 0) : null

  if (currency === "USD") {
    if (!exchangeRate || exchangeRate <= 0) {
      throw new Error("El tipo de cambio debe ser mayor a 0 para pagos en USD")
    }
    return {
      amountInClp: amount * exchangeRate,
      currency,
      originalAmount: amount,
      exchangeRate,
    }
  }

  return {
    amountInClp: amount,
    currency,
    originalAmount: null,
    exchangeRate: null,
  }
}

// ── Internal event helpers ───────────────────────────────────────────────────

/**
 * Finds an existing event or creates a new one for a booking.
 * Exact copy of findOrCreateEventForBooking from sale-record.actions.ts.
 */
async function findOrCreateEventForBookingTx(
  tx: SaleUpdateTxClient,
  params: {
    serviceId: string
    date: Date
    mode: "REGULAR" | "PRIVATE"
    passengerCount: number
    startTime?: string | null
    endTime?: string | null
    comments?: string | null
  }
) {
  const { serviceId, date: rawDate, mode, passengerCount, startTime, endTime, comments } = params
  // Normalize client-supplied Date (local midnight) to UTC midnight for @db.Date field.
  const date = parseCalendarDay(formatCalendarDay(rawDate, "yyyy-MM-dd"))

  const transferService = await tx.transferService.findUnique({
    where: { id: serviceId },
    select: { id: true },
  })

  const serviceKind = transferService ? "TRANSFER" : "TOUR"
  const tourId = transferService ? null : serviceId
  const transferServiceId = transferService?.id || null

  const existingEvents = await tx.event.findMany({
    where: {
      serviceKind,
      ...(tourId ? { tourId } : {}),
      ...(transferServiceId ? { transferServiceId } : {}),
      date,
      mode,
      status: {
        not: "CANCELLED",
      },
      startTime: startTime || null,
      endTime: endTime || null,
    },
    orderBy: {
      createdAt: "asc",
    },
  })

  let targetEvent = existingEvents.find(
    (event) => event.currentBookings + passengerCount <= event.maxCapacity
  )

  if (!targetEvent) {
    const tour = await tx.tour.findUnique({
      where: { id: tourId || "" },
      select: { maxCapacity: true },
    })

    const maxCapacity = tour?.maxCapacity || 12

    targetEvent = await tx.event.create({
      data: {
        serviceKind,
        ...(tourId ? { tourId } : {}),
        ...(transferServiceId ? { transferServiceId } : {}),
        date,
        mode,
        maxCapacity,
        startTime: startTime || null,
        endTime: endTime || null,
        comments: comments || null,
        status: "SCHEDULED",
        currentBookings: 0,
      },
    })
  }

  return targetEvent
}

/**
 * Creates an EventBooking for a given booking input inside a transaction.
 * Exact copy of createBookingForEvent from sale-record.actions.ts.
 */
async function createBookingForEventTx(
  tx: SaleUpdateTxClient,
  bookingData: SaleRecordFormSchema["eventBookings"][number],
  saleRecordId: string,
  passengerCount: number
) {
  let event
  if (bookingData.eventId) {
    const selectedEvent = await tx.event.findUniqueOrThrow({
      where: { id: bookingData.eventId },
    })

    // Normalize the form date to UTC midnight so it can be compared against
    // selectedEvent.date (@db.Date, always UTC midnight from Prisma).
    const normalizedFormDate = parseCalendarDay(formatCalendarDay(bookingData.date, "yyyy-MM-dd"))

    const dateChanged = normalizedFormDate.getTime() !== selectedEvent.date.getTime()
    const modeChanged = bookingData.mode !== selectedEvent.mode
    const startTimeChanged = (bookingData.startTime || null) !== (selectedEvent.startTime || null)
    const endTimeChanged = (bookingData.endTime || null) !== (selectedEvent.endTime || null)

    if (dateChanged || modeChanged || startTimeChanged || endTimeChanged) {
      // One or more defining parameters changed — re-resolve (find or create)
      // the correct event for the new params. The old event's currentBookings
      // were already decremented upstream so capacity math is correct here.
      event = await findOrCreateEventForBookingTx(tx, {
        serviceId: bookingData.tourId,
        date: bookingData.date,
        mode: bookingData.mode,
        passengerCount,
        startTime: bookingData.startTime,
        endTime: bookingData.endTime,
        comments: bookingData.comments,
      })
    } else {
      // No defining params changed — reuse the existing event as before.
      if (selectedEvent.currentBookings + passengerCount > selectedEvent.maxCapacity) {
        throw new Error("El evento seleccionado no tiene capacidad suficiente")
      }
      event = selectedEvent
    }
  } else {
    event = await findOrCreateEventForBookingTx(tx, {
      serviceId: bookingData.tourId,
      date: bookingData.date,
      mode: bookingData.mode,
      passengerCount,
      startTime: bookingData.startTime,
      endTime: bookingData.endTime,
      comments: bookingData.comments,
    })
  }

  const priceEntriesWithCount = (bookingData.priceEntries || []).filter((pe) => pe.count > 0)

  await tx.eventBooking.create({
    data: {
      saleRecordId,
      eventId: event.id,
      passengerCount,
      flyDate: bookingData.flyDate?.toISOString() || null,
      flyTime: bookingData.flyTime || null,
      flyName: bookingData.flyName || null,
      specialRequest: bookingData.specialRequest || null,
      priceEntries: {
        create: priceEntriesWithCount.map((pe) => ({
          count: pe.count,
          priceSnapshot: pe.price,
          receptionSnapshot: pe.reception,
          categoryName: pe.categoryName,
          // TRANSFER events use synthetic price categories; their ids are not real FKs.
          // Re-derive from event.serviceKind rather than trusting client payload.
          tourPriceCategoryId:
            event.serviceKind === "TRANSFER" ? null : (pe.priceCategoryId || null),
        })),
      },
      entrySnapshots: {
        create: (bookingData.entrySnapshots || [])
          .filter((snap) => snap.count > 0)
          .map((snap) => ({
            count: snap.count,
            priceSnapshot: snap.price,
            entryName: snap.entryName,
            variantName: snap.variantName,
            categoryName: snap.categoryName,
            tourEntryId: snap.tourEntryId || null,
          })),
      },
    },
  })

  // Increment currentBookings on the event
  await tx.event.update({
    where: { id: event.id },
    data: { currentBookings: { increment: passengerCount } },
  })
}

// ── Shared transaction body ──────────────────────────────────────────────────

/**
 * The extracted $transaction body of updateSaleRecord.
 *
 * This function MUST produce identical results to the pre-extraction inline
 * transaction body. It is the single source of truth for the update logic.
 *
 * Callers:
 * - Direct path (updateSaleRecord): prisma.$transaction(tx => applySaleUpdateTx(...))
 * - Executor path (updateInvoicedSaleExecutor): receives tx from resolveApproval's $transaction
 *
 * Cash-flow recalc is NOT included here — it stays in each caller:
 * - Direct path: non-fatal post-commit recalc on global prisma (unchanged)
 * - Executor path: recalc inside its own tx using tx-scoped reads (locked decision)
 *
 * @param tx - Prisma transaction client
 * @param id - SaleRecord ID
 * @param validatedData - already-parsed SaleRecordFormSchema
 * @param currentRecord - pre-fetched current record (must include eventBookings with eventId)
 * @returns The updated SaleRecord with full details, or null if not found
 */
export async function applySaleUpdateTx(
  tx: SaleUpdateTxClient,
  id: string,
  validatedData: SaleRecordFormSchema,
  currentRecord: SaleUpdateCurrentRecord
) {
  const newDiscount = validatedData.discount ? Number(validatedData.discount) : 0

  const wholesalePaymentTerm =
    validatedData.channel === "WHOLESALE" && validatedData.paymentPending
      ? "POSTPAID"
      : "IMMEDIATE"

  // 1. Update SaleRecord fields + delete/recreate passengers and payments
  await tx.saleRecord.update({
    where: { id },
    data: {
      type: validatedData.type,
      channel: validatedData.channel,
      fileNumber: validatedData.fileNumber || null,
      comments: validatedData.comments || null,
      agencyId: validatedData.agencyId || null,
      discount: newDiscount,
      isWholesale: validatedData.isWholesale || false,
      wholesalePaymentTerm,
      wholesaleAgencyId: validatedData.wholesaleAgencyId || null,
      wholesaleMarkup: 30,
      // Delete and recreate passengers
      passengers: {
        deleteMany: {},
        create: validatedData.passengerArray.map((passenger) => ({
          name: passenger.name || null,
          document: passenger.rut || null,
          age: passenger.age ? Number(passenger.age) : null,
          nationality: passenger.nacionality || null,
          diet: passenger.diet_type || null,
          allergies: passenger.allergies || [],
          phone: passenger.phone || null,
          email: passenger.email || null,
          complimentary: passenger.complimentary ?? false,
          complimentaryCategory: passenger.complimentary
            ? passenger.complimentaryCategory || null
            : null,
          ...(passenger.hotels?.length > 0 && {
            hotels: {
              create: passenger.hotels
                .filter((h) => h.hotelName?.trim())
                .map((h, idx) => ({
                  hotelName: h.hotelName!.trim(),
                  checkIn: h.checkIn
                    ? parseCalendarDay(formatCalendarDay(h.checkIn, "yyyy-MM-dd"))
                    : null,
                  checkOut: h.checkOut
                    ? parseCalendarDay(formatCalendarDay(h.checkOut, "yyyy-MM-dd"))
                    : null,
                  order: idx,
                })),
            },
          }),
        })),
      },
      // Delete and recreate payments
      paymentRecords: {
        deleteMany: {},
        create: validatedData.paymentArray.map((payment) => {
          const normalizedPayment = getNormalizedPaymentAmountsFromSchema(payment)
          return {
            date: payment.movement_date,
            refund: payment.refund || false,
            method: payment.method,
            amount: normalizedPayment.amountInClp,
            currency: normalizedPayment.currency as "CLP" | "USD",
            originalAmount: normalizedPayment.originalAmount,
            exchangeRate: normalizedPayment.exchangeRate,
            comments: payment.comments || null,
            documentNumber: payment.document_number || null,
          }
        }),
      },
    },
  })

  // 2. Handle Event Bookings — revert old, delete, recreate

  // Revert passenger counts on old events
  for (const oldBooking of currentRecord.eventBookings) {
    await tx.event.update({
      where: { id: oldBooking.eventId },
      data: {
        currentBookings: {
          decrement: oldBooking.passengerCount,
        },
      },
    })
  }

  // Delete old bookings
  await tx.eventBooking.deleteMany({
    where: { saleRecordId: id },
  })

  // Create new bookings
  for (const bookingData of validatedData.eventBookings) {
    await createBookingForEventTx(tx, bookingData, id, validatedData.passengerArray.length)
  }

  // 3. Create BookingPassenger rows with exclusion support
  const [newPassengers, newBookings] = await Promise.all([
    tx.passenger.findMany({
      where: { saleRecordId: id },
      select: { id: true },
      orderBy: { id: "asc" },
    }),
    tx.eventBooking.findMany({
      where: { saleRecordId: id },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    }),
  ])

  if (newPassengers.length > 0 && newBookings.length > 0) {
    const bookingPassengerData: Array<{
      eventBookingId: string
      passengerId: string
      excluded: boolean
      excludeReason: string | undefined
    }> = []

    for (let bIdx = 0; bIdx < newBookings.length; bIdx++) {
      const bookingData = validatedData.eventBookings[bIdx]
      const excludedSet = new Set(
        (bookingData?.excludedPassengers || []).map((ep) => ep.passengerIndex)
      )
      const excludeReasonMap = new Map(
        (bookingData?.excludedPassengers || []).map((ep) => [ep.passengerIndex, ep.excludeReason])
      )

      for (let pIdx = 0; pIdx < newPassengers.length; pIdx++) {
        const isExcluded = excludedSet.has(pIdx)
        bookingPassengerData.push({
          eventBookingId: newBookings[bIdx].id,
          passengerId: newPassengers[pIdx].id,
          excluded: isExcluded,
          excludeReason: isExcluded ? excludeReasonMap.get(pIdx) : undefined,
        })
      }
    }

    await tx.bookingPassenger.createMany({ data: bookingPassengerData })

    // Update passengerCount per booking to reflect effective (non-excluded) count
    for (let bIdx = 0; bIdx < newBookings.length; bIdx++) {
      const bookingData = validatedData.eventBookings[bIdx]
      const excludedCount = (bookingData?.excludedPassengers || []).length

      if (excludedCount > 0) {
        const effectiveCount = newPassengers.length - excludedCount
        const booking = await tx.eventBooking.update({
          where: { id: newBookings[bIdx].id },
          data: { passengerCount: effectiveCount },
          select: { eventId: true },
        })

        // Adjust Event.currentBookings: decrement by excluded count
        await tx.event.update({
          where: { id: booking.eventId },
          data: {
            currentBookings: {
              decrement: excludedCount,
            },
          },
        })
      }
    }
  }

  // 4. Recompute firstEventDate
  await applyFirstEventDate(id, tx)

  // 5. Return updated sale with full details for audit snapshot
  return tx.saleRecord.findUnique({
    where: { id },
    include: {
      seller: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      agency: {
        select: {
          id: true,
          name: true,
          contactEmails: true,
        },
      },
      wholesaleAgency: {
        select: {
          id: true,
          name: true,
        },
      },
      passengers: { include: { hotels: { orderBy: { order: "asc" } } } },
      paymentRecords: true,
      eventBookings: {
        include: {
          priceEntries: true,
          entrySnapshots: true,
          bookingPassengers: {
            include: {
              passenger: {
                select: { id: true, name: true },
              },
            },
          },
          event: {
            include: {
              tour: {
                select: {
                  id: true,
                  name: true,
                },
              },
              transferService: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  })
}
