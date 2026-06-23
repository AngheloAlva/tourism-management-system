import { AuditService } from "@/lib/audit/service"
import { fingerprintMatches } from "@/project/approvals/utils/fingerprint"
import { applyFirstEventDate } from "@/project/sales/server/first-event-date"
import type { Executor, ExecutorContext } from "@/project/approvals/executors/types"

export interface CancelBookingPayload {
  reason?: string
}

export const cancelBookingExecutor: Executor<CancelBookingPayload> = async (
  ctx: ExecutorContext<CancelBookingPayload>
) => {
  const { tx, targetId, request, resolvedById, payload } = ctx

  // Fetch current booking state
  const booking = await tx.eventBooking.findUnique({
    where: { id: targetId },
    select: { id: true, cancelled: true, updatedAt: true, eventId: true, saleRecordId: true },
  })

  if (!booking) {
    return { ok: false, invalidated: true, reason: "target_not_found" }
  }

  // Validate fingerprint
  if (!fingerprintMatches(request.targetFingerprint, booking.updatedAt)) {
    return { ok: false, invalidated: true, reason: "target_modified" }
  }

  // Idempotency: already cancelled
  if (booking.cancelled) {
    return { ok: true }
  }

  const reason = payload?.reason?.trim() ?? ""

  await tx.eventBooking.update({
    where: { id: targetId },
    data: {
      cancelled: true,
      cancelledAt: new Date(),
    },
  })

  await applyFirstEventDate(booking.saleRecordId, tx)

  await AuditService.createLog({
    action: "UPDATE",
    entityType: "EventBooking",
    entityId: targetId,
    user: { id: resolvedById, name: "Admin", email: "" },
    oldValues: { cancelled: false },
    newValues: { cancelled: true },
    metadata: {
      subtype: "booking:cancel",
      approvalRequestId: request.id,
      cancelReason: reason || null,
    },
    description: `Reserva anulada por solicitud de autorización ${request.id}`,
  })

  return { ok: true }
}
