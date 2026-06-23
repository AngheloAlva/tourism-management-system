import { AuditService } from "@/lib/audit/service"
import { fingerprintMatches } from "@/project/approvals/utils/fingerprint"
import type { Executor, ExecutorContext } from "@/project/approvals/executors/types"

export interface CancelReceptionPayload {
  reason?: string
}

export const cancelReceptionExecutor: Executor<CancelReceptionPayload> = async (
  ctx: ExecutorContext<CancelReceptionPayload>
) => {
  const { tx, targetId, request, resolvedById, payload } = ctx

  const reception = await tx.agencyTransfer.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      status: true,
      type: true,
      voucher: true,
      updatedAt: true,
      agency: { select: { name: true } },
      priceDetails: { select: { passengerName: true } },
    },
  })

  if (!reception) {
    return { ok: false, invalidated: true, reason: "target_not_found" }
  }

  if (!fingerprintMatches(request.targetFingerprint, reception.updatedAt)) {
    return { ok: false, invalidated: true, reason: "target_modified" }
  }

  // Idempotency
  if (reception.status === "CANCELLED") {
    return { ok: true }
  }

  if (reception.type !== "INCOMING") {
    return {
      ok: false,
      error: `No se puede cancelar la recepción #${reception.voucher}: es de tipo ${reception.type === "OUTGOING" ? "traspaso de salida (OUTGOING)" : reception.type}. Desde acá solo se cancelan recepciones de entrada (INCOMING). Si querés cancelar un traspaso, usá la sección de traspasos.`,
      retryable: false,
    }
  }

  const reason = payload?.reason?.trim() ?? null

  await tx.agencyTransfer.update({
    where: { id: targetId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledById: resolvedById,
      cancelReason: reason,
    },
  })

  // Reverse SUPPLIER_PAYMENT cash entries
  const entries = await tx.cashBoxEntry.findMany({
    where: { transferId: targetId, type: "SUPPLIER_PAYMENT" },
  })

  if (entries.length > 0) {
    await tx.cashBoxEntry.createMany({
      data: entries.map((entry) => ({
        type: entry.type,
        amount: -entry.amount,
        currency: entry.currency,
        originalAmount: entry.originalAmount ? -entry.originalAmount : null,
        description: `[REVERSAL] ${entry.description}`,
        reference: entry.reference,
        transferId: entry.transferId,
        paymentMethod: entry.paymentMethod,
        cashBoxId: entry.cashBoxId,
        createdById: resolvedById,
      })),
    })
  }

  await AuditService.createLog({
    action: "UPDATE",
    entityType: "AgencyTransfer",
    entityId: targetId,
    user: { id: resolvedById, name: "Admin", email: "" },
    oldValues: { status: reception.status },
    newValues: { status: "CANCELLED", cancelReason: reason },
    metadata: {
      subtype: "reception:cancel",
      voucher: reception.voucher,
      agencyName: reception.agency.name,
      approvalRequestId: request.id,
    },
    description: `Recepción #${reception.voucher} anulada por solicitud ${request.id}`,
  })

  return { ok: true }
}
