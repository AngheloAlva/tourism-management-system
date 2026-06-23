import type { Prisma } from "@/generated/prisma/client"

/**
 * Canonical helper for SaleRecord.firstEventDate computation.
 *
 * IMPORTANT: This function is the SINGLE SOURCE OF TRUTH for firstEventDate
 * semantics. It MUST stay in sync with the backfill SQL in
 * prisma/migrations/20260505230123_add_first_event_date/migration.sql.
 *
 * RULES:
 *  - Excludes EventBooking rows where cancelled = true
 *  - Excludes Event rows where status = 'CANCELLED'
 *  - Returns null when no qualifying event exists (zero bookings, all cancelled,
 *    or all events cancelled)
 *
 * FUTURE-MUTATION CONTRACT:
 * If you add a server action that creates, updates, deletes, or moves an
 * EventBooking, OR that modifies Event.date or Event.status, you MUST call
 * applyFirstEventDate (or applyFirstEventDateForSales for batch ops) inside
 * the same Prisma transaction. If you don't, facturación date filters will
 * silently drift.
 *
 * See spec: sdd/first-event-date/spec (R-A3, R-A4, R-B8, NFR-4, NFR-5)
 */

/**
 * Computes the earliest active event date for a sale's active bookings.
 *
 * Uses findFirst + orderBy to get MIN(event.date) without raw SQL, which is
 * type-safe under TypeScript strict mode.
 */
export async function computeFirstEventDate(
  saleRecordId: string,
  tx: Prisma.TransactionClient,
): Promise<Date | null> {
  const earliest = await tx.eventBooking.findFirst({
    where: {
      saleRecordId,
      cancelled: false,
      event: { status: { not: "CANCELLED" } },
    },
    orderBy: { event: { date: "asc" } },
    select: { event: { select: { date: true } } },
  })
  return earliest?.event?.date ?? null
}

/**
 * Computes + writes firstEventDate to SaleRecord. Idempotent.
 *
 * Call inside the same transaction that created/modified the sale's bookings
 * or the related events.
 */
export async function applyFirstEventDate(
  saleRecordId: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const value = await computeFirstEventDate(saleRecordId, tx)
  await tx.saleRecord.update({
    where: { id: saleRecordId },
    data: { firstEventDate: value },
  })
}

/**
 * Batch version for mutations affecting many sales (M5/M6/M7). Sequential
 * updates — acceptable at current scale; can be replaced with a single raw
 * SQL UPDATE FROM ... if N grows significantly.
 *
 * Deduplicates saleRecordIds before processing.
 */
export async function applyFirstEventDateForSales(
  saleRecordIds: string[],
  tx: Prisma.TransactionClient,
): Promise<void> {
  if (saleRecordIds.length === 0) return
  const unique = Array.from(new Set(saleRecordIds))
  for (const id of unique) {
    await applyFirstEventDate(id, tx)
  }
}
