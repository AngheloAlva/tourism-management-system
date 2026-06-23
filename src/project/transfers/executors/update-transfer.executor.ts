/**
 * Executor for UPDATE_TRANSFER.
 *
 * Called by resolveApproval() when an admin approves a non-admin's edit of a transfer.
 * Replays the stored validated payload through applyTransferUpdateTx with the same
 * side effects as the direct path (admin or SMALL change):
 *   1. Validates the stored payload through buildTransferSchema("edit")
 *   2. Checks fingerprint (updatedAt) for concurrent-edit detection
 *   3. Verifies transfer is OUTGOING and not CANCELLED
 *   4. Fetches the current transfer with full includes for prepareTransferUpdate
 *   5. Calls applyTransferUpdateTx inside the executor's transaction (all in one tx)
 *   6. Writes audit log
 *
 * Trust boundary: re-parses metadata.payload through buildTransferSchema("edit").
 * Fingerprint: uses fingerprintMatches() (updatedAt comparison) to detect stale state.
 * Idempotency: relies on resolveApproval's atomic PENDING→APPROVED lock.
 *
 * Design reference: mirrors src/project/sales/executors/update-invoiced-sale.executor.ts
 */

import { AuditService } from "@/lib/audit/service"
import { fingerprintMatches } from "@/project/approvals/utils/fingerprint"
import { buildTransferSchema } from "@/project/transfers/schemas/transfer.schema"
import {
  prepareTransferUpdate,
  applyTransferUpdateTx,
} from "@/project/transfers/server/apply-transfer-update"
import type { Executor, ExecutorContext } from "@/project/approvals/executors/types"
import type { TransferFormData } from "@/project/transfers/schemas/transfer.schema"

// ── ISO date coercion (mirrors update-invoiced-sale.executor.ts) ─────────────

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

// ── Full include shape for current transfer fetch ─────────────────────────────
// Includes all scalar fields needed for fingerprint/status guards AND the nested
// relations needed by prepareTransferUpdate. Used in one single findUnique call.

const CURRENT_TRANSFER_INCLUDE = {
  agency: { select: { name: true } },
  priceDetails: { select: { id: true, sourcePassengerId: true } },
  passengers: { select: { id: true } },
  eventBookings: {
    include: {
      event: { select: { id: true, date: true } },
    },
  },
  payments: { select: { id: true } },
} as const

// ── Executor ──────────────────────────────────────────────────────────────────

export const updateTransferExecutor: Executor<TransferFormData> = async (
  ctx: ExecutorContext<TransferFormData>
) => {
  const { tx, targetId, request, resolvedById } = ctx

  // ── 1. Load target (single query — covers fingerprint, status guard, and prepareTransferUpdate)

  const currentRecord = await tx.agencyTransfer.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      status: true,
      type: true,
      voucher: true,
      updatedAt: true,
      agencyId: true,
      ...CURRENT_TRANSFER_INCLUDE,
    },
  })

  if (!currentRecord) {
    return { ok: false, invalidated: true, reason: "target_not_found" }
  }

  if (!fingerprintMatches(request.targetFingerprint, currentRecord.updatedAt)) {
    return { ok: false, invalidated: true, reason: "target_modified" }
  }

  // ── 2. Status guard ───────────────────────────────────────────────────────

  if (currentRecord.status === "CANCELLED") {
    return {
      ok: false,
      invalidated: true,
      reason: "transfer_cancelled",
    }
  }

  if (currentRecord.type !== "OUTGOING") {
    return {
      ok: false,
      error: `Solo se pueden modificar traspasos de tipo salida (OUTGOING). Este traspaso es ${currentRecord.type}.`,
      retryable: false,
    }
  }

  // ── 3. Re-parse payload (trust boundary) ──────────────────────────────────
  //
  // Payloads are stored as JSONB: Date objects arrive as ISO strings.
  // Coerce before Zod validation.

  const metadata = request.metadata as { payload?: unknown } | null
  const rawPayload = metadata?.payload
  const coercedPayload = coerceDateStrings(rawPayload)

  const parseResult = buildTransferSchema("edit").safeParse(coercedPayload)
  if (!parseResult.success) {
    return {
      ok: false,
      error: `Payload inválido en metadata: ${parseResult.error.issues[0]?.message ?? "unknown"}`,
      retryable: false,
    }
  }

  const validatedData = parseResult.data

  // ── 4. Prepare (validates already-transferred conflict) ───────────────────
  // Pass `tx` so the conflict-check queries participate in the same tx snapshot.

  let prepared: Awaited<ReturnType<typeof prepareTransferUpdate>>
  try {
    prepared = await prepareTransferUpdate(targetId, validatedData, currentRecord, tx)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al preparar el traspaso"
    return { ok: false, error: message, retryable: false }
  }

  // ── 5. Apply inside tx ────────────────────────────────────────────────────

  await applyTransferUpdateTx(tx, targetId, validatedData, prepared, resolvedById)

  // ── 6. Audit log ──────────────────────────────────────────────────────────

  const resolverUser = await tx.user.findUnique({
    where: { id: resolvedById },
    select: { id: true, name: true, email: true },
  })
  const auditActor = resolverUser
    ? { id: resolverUser.id, name: resolverUser.name ?? "Admin", email: resolverUser.email }
    : { id: resolvedById, name: "Admin", email: "" }

  const oldSnapshot = {
    agencyId: currentRecord.agencyId,
    agencyName: currentRecord.agency.name,
    voucher: currentRecord.voucher,
    status: currentRecord.status,
  }

  const newSnapshot = {
    agencyId: validatedData.agencyId,
    passengerCount: prepared.uniqueSelectedPassengerPrices.length,
    totalAmount: prepared.uniqueSelectedPassengerPrices.reduce((s, pp) => s + pp.totalPrice, 0),
  }

  await AuditService.logUpdate("AgencyTransfer", targetId, auditActor, oldSnapshot, newSnapshot, {
    subtype: "transfer:update",
    approvalRequestId: request.id,
    voucher: currentRecord.voucher,
  })

  return { ok: true }
}
