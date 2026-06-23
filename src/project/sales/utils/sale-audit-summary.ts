import type { AuditFieldValue } from "@/lib/audit/types"
import type { SaleRecordFormSchema } from "../schemas/sale-record.schema"
import { getNormalizedPaymentAmountsFromSchema } from "../server/apply-sale-update"
import { detectChanges } from "@/lib/audit/utils"

/**
 * Structural type accepted by buildSaleAuditSnapshot.
 * Matches the shape of the include used in createSaleRecord and updateSaleRecord.
 */
export type SaleSnapshotInput = {
  type: string
  channel: string
  fileNumber: string | null
  comments: string | null
  agencyId: string | null
  discount: number
  isWholesale: boolean
  wholesaleAgencyId: string | null
  passengers: Array<{
    name: string | null
    document: string | null
  }>
  paymentRecords: Array<{
    refund: boolean
    method: string
    currency: string
    amount: number
    originalAmount?: number | null
    exchangeRate?: number | null
  }>
  eventBookings: Array<{
    passengerCount: number
    event: {
      date: Date
      serviceKind: string
      tour: { name: string } | null
      transferService: { name: string } | null
    }
    /** Optional: price entries per booking. When present, included in the booking summary. */
    priceEntries?: Array<{
      count: number
      priceSnapshot: number
      categoryName: string
    }>
    /** Optional: entry snapshots per booking. When present, included in the booking summary. */
    entrySnapshots?: Array<{
      count: number
      priceSnapshot: number
      entryName: string
      variantName: string
    }>
  }>
}

/**
 * Shape of the currentRecord needed by buildSaleAuditSnapshotFromInput.
 * Must include full eventBookings with event + tour/transferService for service names.
 * tourId and transferServiceId are native scalar fields on the Event model.
 */
export type SaleRecordForSnapshotInput = {
  type: string
  channel: string
  fileNumber: string | null
  comments: string | null
  agencyId: string | null
  discount: number
  isWholesale: boolean
  wholesaleAgencyId: string | null
  eventBookings: Array<{
    passengerCount: number
    event: {
      date: Date
      serviceKind: string
      tourId: string | null
      tour: { name: string } | null
      transferServiceId: string | null
      transferService: { name: string } | null
    }
  }>
}

// ── Formatters ──────────────────────────────────────────────────────────────

function formatPassengerNames(
  passengers: SaleSnapshotInput["passengers"]
): string {
  if (passengers.length === 0) return ""
  return [...passengers]
    .sort((a, b) => {
      const nameA = a.name ?? ""
      const nameB = b.name ?? ""
      if (nameA !== nameB) return nameA.localeCompare(nameB)
      return (a.document ?? "").localeCompare(b.document ?? "")
    })
    .map((p) => {
      const name = p.name ?? "Sin nombre"
      return p.document ? `${name} (${p.document})` : name
    })
    .join(", ")
}

function formatPaymentSummary(
  payments: SaleSnapshotInput["paymentRecords"]
): string {
  if (payments.length === 0) return ""
  return [...payments]
    .sort((a, b) => {
      if (a.method !== b.method) return a.method.localeCompare(b.method)
      if (a.amount !== b.amount) return a.amount - b.amount
      const dateA = (a as { date?: Date | string }).date
      const dateB = (b as { date?: Date | string }).date
      if (dateA != null && dateB != null) {
        return String(dateA) < String(dateB) ? -1 : String(dateA) > String(dateB) ? 1 : 0
      }
      return 0
    })
    .map((p) => {
      if (p.currency === "USD" && p.originalAmount != null) {
        return `${p.method} ${p.originalAmount} USD`
      }
      return `${p.method} ${p.amount} CLP`
    })
    .join(", ")
}

function formatPriceEntriesSignature(
  priceEntries: NonNullable<SaleSnapshotInput["eventBookings"][number]["priceEntries"]>,
  entrySnapshots: NonNullable<SaleSnapshotInput["eventBookings"][number]["entrySnapshots"]>
): string {
  const parts: string[] = []

  if (priceEntries.length > 0) {
    const pe = [...priceEntries]
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName))
      .map((e) => `${e.categoryName}:${e.count}:${e.priceSnapshot}`)
      .join(",")
    parts.push(`pe[${pe}]`)
  }

  if (entrySnapshots.length > 0) {
    const es = [...entrySnapshots]
      .sort((a, b) => {
        if (a.entryName !== b.entryName) return a.entryName.localeCompare(b.entryName)
        return a.variantName.localeCompare(b.variantName)
      })
      .map((e) => `${e.entryName}/${e.variantName}:${e.count}:${e.priceSnapshot}`)
      .join(",")
    parts.push(`es[${es}]`)
  }

  return parts.length > 0 ? ` {${parts.join("|")}}` : ""
}

function formatBookingSummary(
  bookings: SaleSnapshotInput["eventBookings"]
): string {
  if (bookings.length === 0) return ""
  return [...bookings]
    .sort((a, b) => {
      const dateA = a.event.date.toISOString().slice(0, 10)
      const dateB = b.event.date.toISOString().slice(0, 10)
      if (dateA !== dateB) return dateA.localeCompare(dateB)
      const nameA = a.event.tour?.name ?? a.event.transferService?.name ?? a.event.serviceKind
      const nameB = b.event.tour?.name ?? b.event.transferService?.name ?? b.event.serviceKind
      return nameA.localeCompare(nameB)
    })
    .map((b) => {
      const serviceName =
        b.event.tour?.name ?? b.event.transferService?.name ?? b.event.serviceKind
      const dateStr = b.event.date.toISOString().slice(0, 10)
      const priceSignature = formatPriceEntriesSignature(
        b.priceEntries ?? [],
        b.entrySnapshots ?? []
      )
      return `${serviceName} x${b.passengerCount} (${dateStr})${priceSignature}`
    })
    .join(", ")
}

// ── Snapshot builder ────────────────────────────────────────────────────────

/**
 * Pure, side-effect-free builder.
 *
 * Returns a Record<string, AuditFieldValue> with deterministic key insertion
 * order so JSON.stringify comparisons in detectChanges are stable.
 *
 * Nested values are one-level Record<string, string | number> which is
 * compatible with the AuditFieldValue union's Record arm.
 *
 * totalClp sums only payments with currency === "CLP" (stored `amount` is
 * already the CLP-equivalent for both CLP and USD records; however, the spec
 * explicitly requires totalClp to reflect CLP payments only so the
 * paymentRecords.summary string is the canonical place to read USD values).
 */
export function buildSaleAuditSnapshot(
  record: SaleSnapshotInput
): Record<string, AuditFieldValue> {
  // Passengers summary — deterministic order: count then names
  const passengerNames = formatPassengerNames(record.passengers)
  const passengersNested: Record<string, string | number> = {
    count: record.passengers.length,
    names: passengerNames,
  }

  // Payment summary — totalClp = sum of CLP-currency payments only
  const clpTotal = record.paymentRecords
    .filter((p) => !p.refund && p.currency === "CLP")
    .reduce((sum, p) => sum + p.amount, 0)
  const paymentSummary = formatPaymentSummary(record.paymentRecords)
  const paymentRecordsNested: Record<string, string | number> = {
    count: record.paymentRecords.length,
    totalClp: clpTotal,
    summary: paymentSummary,
  }

  // Event booking summary
  const bookingSummary = formatBookingSummary(record.eventBookings)
  const eventBookingsNested: Record<string, string | number> = {
    count: record.eventBookings.length,
    summary: bookingSummary,
  }

  // Build result with deterministic key order (scalars first, then nested)
  const result: Record<string, AuditFieldValue> = {
    type: record.type,
    channel: record.channel,
    fileNumber: record.fileNumber,
    comments: record.comments,
    agencyId: record.agencyId,
    discount: record.discount,
    isWholesale: record.isWholesale,
    wholesaleAgencyId: record.wholesaleAgencyId,
    passengers: passengersNested,
    paymentRecords: paymentRecordsNested,
    eventBookings: eventBookingsNested,
  }

  return result
}

// ── Input adapter (form payload → snapshot) ─────────────────────────────────

/**
 * Builds a SaleSnapshotInput-equivalent snapshot directly from a validated
 * SaleRecordFormSchema payload + the current DB record (for service name lookup).
 *
 * Used by the invoiced-sale approval gate to determine whether the payload
 * constitutes a real change before routing to approval. The comparison MUST
 * cover the same fields that buildSaleAuditSnapshot captures, plus
 * priceEntries/entrySnapshots (which the audit snapshot now also captures
 * when present).
 *
 * Service name resolution: each eventBooking in `validatedData` carries a
 * `tourId`. The actual service name (tour or transferService) is looked up
 * from `currentRecord.eventBookings` by matching on `event.tourId` or
 * `event.transferServiceId`. When the payload references a tourId that differs
 * from all current bookings (tour swap), the serviceName falls back to the
 * tourId string — the resulting summary differs from the old snapshot, which
 * correctly triggers the gate.
 */
export function buildSaleAuditSnapshotFromInput(
  validatedData: SaleRecordFormSchema,
  currentRecord: SaleRecordForSnapshotInput
): Record<string, AuditFieldValue> {
  // Build a service-name lookup: tourId/transferServiceId → { name, serviceKind }
  const serviceNameMap = new Map<
    string,
    { name: string; serviceKind: string; isTransfer: boolean }
  >()
  for (const eb of currentRecord.eventBookings) {
    const { tourId, transferServiceId } = eb.event
    const tourName = eb.event.tour?.name
    const transferName = eb.event.transferService?.name

    if (tourId && tourName) {
      serviceNameMap.set(tourId, { name: tourName, serviceKind: "TOUR", isTransfer: false })
    }
    if (transferServiceId && transferName) {
      serviceNameMap.set(transferServiceId, {
        name: transferName,
        serviceKind: "TRANSFER",
        isTransfer: true,
      })
    }
  }

  const passengers = validatedData.passengerArray.map((p) => ({
    name: p.name ?? null,
    document: p.rut ?? null,
  }))

  const paymentRecords = validatedData.paymentArray.map((p) => {
    const normalized = getNormalizedPaymentAmountsFromSchema(p)
    return {
      refund: p.refund || false,
      method: p.method as string,
      currency: normalized.currency,
      amount: normalized.amountInClp,
      originalAmount: normalized.originalAmount,
      exchangeRate: normalized.exchangeRate,
    }
  })

  const eventBookings = validatedData.eventBookings.map((b) => {
    const serviceInfo = serviceNameMap.get(b.tourId)
    const serviceName = serviceInfo?.name ?? b.tourId // fallback: tourId string (change detection)
    const serviceKind = serviceInfo?.serviceKind ?? "TOUR"
    const isTransfer = serviceInfo?.isTransfer ?? false

    const date =
      b.date instanceof Date ? b.date : new Date(b.date as string)

    const priceEntries = (b.priceEntries ?? [])
      .filter((pe) => pe.count > 0)
      .map((pe) => ({
        count: pe.count,
        priceSnapshot: pe.price,
        categoryName: pe.categoryName,
      }))

    const entrySnapshots = (b.entrySnapshots ?? [])
      .filter((es) => es.count > 0)
      .map((es) => ({
        count: es.count,
        priceSnapshot: es.price,
        entryName: es.entryName,
        variantName: es.variantName,
      }))

    // Per-booking effective passengerCount mirrors what applySaleUpdateTx persists:
    //   effectiveCount = totalPassengers − excludedCount for this booking.
    // Using passengerArray.length (the global total) would cause a false-positive
    // gate whenever a booking has excludedPassengers (the DB stores the effective
    // count, not the total, so old and new snapshots would diverge on a true no-op).
    const effectivePassengerCount =
      validatedData.passengerArray.length - (b.excludedPassengers ?? []).length

    return {
      passengerCount: effectivePassengerCount,
      event: {
        date,
        serviceKind,
        tour: isTransfer ? null : { name: serviceName },
        transferService: isTransfer ? { name: serviceName } : null,
      },
      priceEntries,
      entrySnapshots,
    }
  })

  const newDiscountVal = validatedData.discount ? Number(validatedData.discount) : 0

  const snapshotInput: SaleSnapshotInput = {
    type: validatedData.type,
    channel: validatedData.channel,
    fileNumber: validatedData.fileNumber || null,
    comments: validatedData.comments || null,
    agencyId: validatedData.agencyId || null,
    discount: newDiscountVal,
    isWholesale: validatedData.isWholesale || false,
    wholesaleAgencyId: validatedData.wholesaleAgencyId || null,
    passengers,
    paymentRecords,
    eventBookings,
  }

  return buildSaleAuditSnapshot(snapshotInput)
}

/**
 * Returns true when the validated form payload produces no detectable change
 * relative to the current DB record.
 *
 * Uses the SAME detectChanges logic as the audit layer, covering:
 *   - All scalar fields (type, channel, fileNumber, comments, agencyId,
 *     discount, isWholesale, wholesaleAgencyId)
 *   - Passengers: count + sorted "name (document)" strings
 *   - Payments: count + totalClp + sorted "method amount" summary
 *   - EventBookings: count + sorted "serviceName x{passengerCount} (date)
 *     {priceEntries|entrySnapshots}" summary
 *
 * Gate == Audit: fires exactly when the audit layer would record a change.
 */
export function isSaleNoOp(
  oldSnapshot: Record<string, AuditFieldValue>,
  validatedData: SaleRecordFormSchema,
  currentRecord: SaleRecordForSnapshotInput
): boolean {
  const newSnapshot = buildSaleAuditSnapshotFromInput(validatedData, currentRecord)
  const changes = detectChanges(oldSnapshot, newSnapshot)
  return Object.keys(changes).length === 0
}
