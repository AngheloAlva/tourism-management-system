import { AuditService } from "@/lib/audit/service"
import { fingerprintMatches } from "@/project/approvals/utils/fingerprint"
import type { Executor, ExecutorContext } from "@/project/approvals/executors/types"
import { applyFirstEventDateForSales } from "@/project/sales/server/first-event-date"

export interface CancelEventPayload {
  reason: string
}

export const cancelEventExecutor: Executor<CancelEventPayload> = async (
  ctx: ExecutorContext<CancelEventPayload>
) => {
  const { tx, targetId, request, resolvedById, payload } = ctx

  // Fetch current target state
  const event = await tx.event.findUnique({
    where: { id: targetId },
    select: { id: true, status: true, updatedAt: true },
  })

  if (!event) {
    return { ok: false, invalidated: true, reason: "target_not_found" }
  }

  // Validate fingerprint (idempotency guard)
  if (!fingerprintMatches(request.targetFingerprint, event.updatedAt)) {
    return { ok: false, invalidated: true, reason: "target_modified" }
  }

  // Idempotency: if already cancelled, treat as success
  if (event.status === "CANCELLED") {
    return { ok: true }
  }

  const reason = payload?.reason?.trim() ?? ""

  // Execute cancellation inside the provided transaction
  const affected = await tx.eventBooking.findMany({
    where: { eventId: targetId, cancelled: false },
    select: { saleRecordId: true },
    distinct: ["saleRecordId"],
  })
  const affectedSaleIds = affected.map((r) => r.saleRecordId)

  await tx.event.update({
    where: { id: targetId },
    data: {
      status: "CANCELLED",
      cancelReason: reason || null,
      cancelledAt: new Date(),
      cancelledById: request.requestedById,
      cancellationRequestId: request.id,
    },
  })

  await applyFirstEventDateForSales(affectedSaleIds, tx)

  // Audit log (fire outside tx is not possible here — use tx for consistency)
  await AuditService.createLog({
    action: "UPDATE",
    entityType: "Event",
    entityId: targetId,
    user: { id: resolvedById, name: "Admin", email: "" },
    oldValues: { status: event.status },
    newValues: { status: "CANCELLED", cancelReason: reason || null },
    metadata: { subtype: "event:cancel", approvalRequestId: request.id },
    description: `Evento anulado por solicitud de autorización ${request.id}`,
  })

  return { ok: true }
}
