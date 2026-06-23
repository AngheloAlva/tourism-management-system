/**
 * Executor for UPDATE_INVOICED_SALE.
 *
 * Called by resolveApproval() when an admin approves a non-admin's edit of an
 * invoiced sale. Replays the stored validated payload through applySaleUpdateTx
 * with the same side effects as the direct updateSaleRecord path:
 *   1. Applies the validated update within the executor's $transaction (tx).
 *   2. Runs cash-flow recalc INSIDE the same tx (locked decision: transactional/atomic).
 *   3. Writes the same Slice 2 audit log (buildSaleAuditSnapshot + AuditService.logUpdate)
 *      with subtype "sale:update-invoiced" and approvalRequestId.
 *
 * Trust boundary: re-parses metadata.payload through saleRecordFormSchema before replay.
 * Fingerprint: uses fingerprintMatches() (updatedAt comparison) to detect stale state.
 * Idempotency: relies on resolveApproval's atomic PENDING→APPROVED lock.
 */

import { startOfDay } from "date-fns"
import { AuditService } from "@/lib/audit/service"
import { fingerprintMatches } from "@/project/approvals/utils/fingerprint"
import { applySaleUpdateTx } from "@/project/sales/server/apply-sale-update"
import { buildSaleAuditSnapshot } from "@/project/sales/utils/sale-audit-summary"
import { saleRecordFormSchema } from "@/project/sales/schemas/sale-record.schema"
import { paymentsAffectingCashChanged } from "@/project/sales/utils/payment-cash-diff"
import type { Executor, ExecutorContext } from "@/project/approvals/executors/types"
import type { SaleRecordFormSchema } from "@/project/sales/schemas/sale-record.schema"

export type UpdateInvoicedSalePayload = SaleRecordFormSchema

/**
 * Full include shape needed for the old-snapshot + cash-flow computation.
 * Must match the include used by updateSaleRecord's currentRecord query.
 */
const CURRENT_RECORD_INCLUDE = {
  passengers: { include: { hotels: { orderBy: { order: "asc" as const } } } },
  paymentRecords: true,
  eventBookings: {
    include: {
      // priceEntries and entrySnapshots are required so buildSaleAuditSnapshot
      // produces a symmetric old-snapshot (matching the post-update re-fetch).
      // Without these, the executor's audit diff always shows a spurious
      // eventBookings.summary change for any sale with price entries (W-NEW-2).
      priceEntries: {
        select: { count: true, priceSnapshot: true, categoryName: true },
      },
      entrySnapshots: {
        select: {
          count: true,
          priceSnapshot: true,
          entryName: true,
          variantName: true,
        },
      },
      event: {
        include: {
          tour: true,
          transferService: { select: { id: true, name: true } },
        },
      },
    },
  },
} as const

export const updateInvoicedSaleExecutor: Executor<UpdateInvoicedSalePayload> = async (
  ctx: ExecutorContext<UpdateInvoicedSalePayload>
) => {
  const { tx, targetId, request, resolvedById } = ctx

  // ── 1. Load target + fingerprint check ───────────────────────────────────

  const record = await tx.saleRecord.findUnique({
    where: { id: targetId },
    select: { id: true, voucher: true, type: true, updatedAt: true },
  })

  if (!record) {
    return { ok: false, invalidated: true, reason: "target_not_found" }
  }

  if (!fingerprintMatches(request.targetFingerprint, record.updatedAt)) {
    return { ok: false, invalidated: true, reason: "target_modified" }
  }

  // ── 2. Re-parse payload through saleRecordFormSchema (trust boundary) ─────
  //
  // Payloads are stored as JSONB: Date objects are serialized as ISO strings.
  // Coerce date string fields back to Date objects before Zod validation.

  const metadata = request.metadata as { payload?: unknown } | null
  const rawPayload = metadata?.payload

  const coercedPayload = coerceDateStrings(rawPayload)

  const parseResult = saleRecordFormSchema.safeParse(coercedPayload)
  if (!parseResult.success) {
    return {
      ok: false,
      error: `Payload inválido en metadata: ${parseResult.error.issues[0]?.message ?? "unknown"}`,
      retryable: false,
    }
  }

  const validatedData = parseResult.data

  // ── 3. Load full currentRecord for audit snapshot + event-booking revert ─

  const currentRecord = await tx.saleRecord.findUnique({
    where: { id: targetId },
    include: CURRENT_RECORD_INCLUDE,
  })

  if (!currentRecord) {
    return { ok: false, invalidated: true, reason: "target_not_found" }
  }

  // ── 4. Build old audit snapshot (before the update) ──────────────────────

  const oldSnapshot = buildSaleAuditSnapshot(currentRecord)

  // ── 5. Compute cash-flow recalc intent (BEFORE applying the update) ───────

  const oldCashPayments = currentRecord.paymentRecords.map((p) => ({
    amount: p.amount,
    method: p.method as string,
    currency: (p as { currency?: string }).currency || "CLP",
    refund: p.refund,
  }))

  const newCashPayments = validatedData.paymentArray.map((p) => {
    const amount = Number(p.amount || 0)
    const currency = p.currency || "CLP"
    const exchangeRate = currency === "USD" ? Number(p.exchange_rate || 0) : null
    const amountInClp = currency === "USD" && exchangeRate ? amount * exchangeRate : amount
    return {
      amount: amountInClp,
      method: p.method as string,
      currency,
      refund: p.refund || false,
    }
  })

  const shouldRecalcCashFlow =
    validatedData.type === "SALE" && paymentsAffectingCashChanged(oldCashPayments, newCashPayments)

  // ── 6. Apply the update inside the executor's transaction ─────────────────

  const updatedSale = await applySaleUpdateTx(tx, targetId, validatedData, currentRecord)

  if (!updatedSale) {
    return { ok: false, invalidated: true, reason: "target_not_found" }
  }

  // ── 7. Cash-flow recalc INSIDE tx (locked decision: transactional/atomic) ─

  if (shouldRecalcCashFlow) {
    // Fetch new payment records within tx (already written by applySaleUpdateTx)
    const newPaymentRecords = await tx.paymentRecord.findMany({
      where: { saleRecordId: targetId },
      select: {
        id: true,
        amount: true,
        method: true,
        currency: true,
        originalAmount: true,
        exchangeRate: true,
        refund: true,
      },
    })

    // recalculateSaleCashFlowOnEdit uses its own internal $transaction.
    // For executor use, we pass the tx handle so reads/writes stay inside our tx.
    // The function accepts an optional db parameter (defaults to global prisma).
    // We call it with tx by passing it as the db parameter.
    await recalculateSaleCashFlowOnEditInTx(
      {
        voucher: record.voucher,
        newPayments: newPaymentRecords.map((p) => ({
          id: p.id,
          amount: p.amount,
          method: p.method as string,
          currency: (p.currency as string) || "CLP",
          originalAmount: p.originalAmount ?? null,
          exchangeRate: p.exchangeRate ?? null,
          refund: p.refund,
        })),
        userId: resolvedById,
      },
      tx
    )
  }

  // ── 8. Audit log with Slice 2 snapshot (audit parity with direct path) ────

  const newSnapshot = buildSaleAuditSnapshot(updatedSale)

  const resolverUser = await tx.user.findUnique({
    where: { id: resolvedById },
    select: { id: true, name: true, email: true },
  })
  const auditActor = resolverUser
    ? { id: resolverUser.id, name: resolverUser.name ?? "Admin", email: resolverUser.email }
    : { id: resolvedById, name: "Admin", email: "" }

  await AuditService.logUpdate("SaleRecord", targetId, auditActor, oldSnapshot, newSnapshot, {
    subtype: "sale:update-invoiced",
    approvalRequestId: request.id,
    voucher: record.voucher,
    type: record.type,
    passengersCount: validatedData.passengerArray.length,
    paymentsCount: validatedData.paymentArray.length,
    eventsCount: validatedData.eventBookings.length,
  })

  return { ok: true }
}

// ── Internal: date coercion for stored JSONB payloads ────────────────────────

/**
 * Recursively converts ISO date strings to Date objects in a plain object tree.
 * Needed because saleRecordFormSchema uses z.date() but metadata.payload is JSONB
 * (all Date values serialized as strings when stored).
 */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/

function coerceDateStrings(value: unknown): unknown {
  if (typeof value === "string" && ISO_DATE_RE.test(value)) {
    const d = new Date(value)
    return isNaN(d.getTime()) ? value : d
  }
  if (Array.isArray(value)) {
    return value.map(coerceDateStrings)
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, coerceDateStrings(v)])
    )
  }
  return value
}

// ── Internal: cash-flow recalc inside tx ─────────────────────────────────────

/**
 * Runs the net-reversal cash-flow recalc using the provided tx client.
 *
 * recalculateSaleCashFlowOnEdit normally uses its own internal $transaction
 * and the global prisma client. For the executor path, we need everything to
 * stay inside the executor's outer tx (locked decision). This function
 * reimplements the reversal + re-registration steps using the tx parameter,
 * matching the algorithm in cash-flow-internal.ts but scoped to tx.
 *
 * This avoids nested transaction issues while preserving atomicity.
 */
async function recalculateSaleCashFlowOnEditInTx(
  params: {
    voucher: number
    newPayments: Array<{
      id: string
      amount: number
      method: string
      currency: string
      originalAmount: number | null
      exchangeRate: number | null
      refund: boolean
    }>
    userId: string
  },
  tx: import("@/generated/prisma/client").Prisma.TransactionClient
): Promise<void> {
  const { voucher, newPayments, userId } = params
  const reference = `V-${voucher}`
  const EPSILON = 0.005

  // 1. Calculate existing nets for this voucher
  const existingEntries = await tx.cashBoxEntry.findMany({
    where: { reference, type: "INCOME" },
    select: { amount: true, currency: true, originalAmount: true },
  })

  const netClpAmount = existingEntries
    .filter((e) => e.currency === "CLP")
    .reduce((sum, e) => sum + e.amount, 0)

  const netUsdAmount = existingEntries
    .filter((e) => e.currency === "USD")
    .reduce((sum, e) => sum + e.amount, 0)

  const netUsdOriginal = existingEntries
    .filter((e) => e.currency === "USD")
    .reduce((sum, e) => sum + (e.originalAmount ?? 0), 0)

  const cashAffectingPayments = newPayments.filter((p) => !p.refund && p.amount > 0)

  // 2. Get or create today's cash box (using tx)
  const today = startOfDay(new Date())

  let cashBox = await tx.cashBox.findUnique({ where: { date: today } })

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

  // 3. CLP reversal
  if (Math.abs(netClpAmount) > EPSILON) {
    await tx.cashBoxEntry.create({
      data: {
        type: "INCOME",
        amount: -netClpAmount,
        currency: "CLP",
        originalAmount: -netClpAmount,
        exchangeRate: null,
        description: `[REVERSAL] Ajuste por edición (CLP) - Voucher V${voucher}`,
        reference,
        paymentRecordId: null,
        paymentMethod: null,
        cashBoxId: cashBox.id,
        createdById: userId,
      },
    })
  }

  // 4. USD reversal
  if (Math.abs(netUsdOriginal) > EPSILON) {
    await tx.cashBoxEntry.create({
      data: {
        type: "INCOME",
        amount: -netUsdAmount,
        currency: "USD",
        originalAmount: -netUsdOriginal,
        exchangeRate: null,
        description: `[REVERSAL] Ajuste por edición (USD) - Voucher V${voucher}`,
        reference,
        paymentRecordId: null,
        paymentMethod: null,
        cashBoxId: cashBox.id,
        createdById: userId,
      },
    })
  }

  // 5. Re-register cash-affecting payments
  const PAYMENT_METHOD_LABELS: Record<string, string> = {
    CASH: "Efectivo",
    TRANSFER: "Transferencia",
    CREDIT_CARD: "Tarjeta de Credito",
    DEBIT_CARD: "Tarjeta de Debito",
    PAYMENT_LINK_DEBIT: "Link de pago Debito",
    PAYMENT_LINK_CREDIT: "Link de pago Credito",
  }

  for (const payment of cashAffectingPayments) {
    const paymentCurrency = (payment.currency as "CLP" | "USD") || "CLP"
    const methodLabel = PAYMENT_METHOD_LABELS[payment.method] ?? payment.method
    const currencyLabel = paymentCurrency === "USD" ? "USD" : "CLP"
    const normalizedOriginalAmount =
      paymentCurrency === "USD"
        ? (payment.originalAmount ??
            (payment.exchangeRate && payment.exchangeRate > 0
              ? payment.amount / payment.exchangeRate
              : payment.amount))
        : payment.amount

    await tx.cashBoxEntry.create({
      data: {
        type: "INCOME",
        amount: payment.amount,
        currency: paymentCurrency,
        originalAmount: normalizedOriginalAmount,
        exchangeRate: paymentCurrency === "USD" ? (payment.exchangeRate ?? null) : null,
        description: `Pago ${methodLabel} (${currencyLabel}) - Voucher V${voucher}`,
        reference: `V-${voucher}`,
        paymentRecordId: payment.id,
        paymentMethod: payment.method as import("@/generated/prisma/enums").PAYMENT_METHOD,
        cashBoxId: cashBox.id,
        createdById: userId,
      },
    })
  }
}
