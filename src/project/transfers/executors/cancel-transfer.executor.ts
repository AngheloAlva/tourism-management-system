import { AuditService } from "@/lib/audit/service"
import { fingerprintMatches } from "@/project/approvals/utils/fingerprint"
import type { Executor, ExecutorContext } from "@/project/approvals/executors/types"

export interface CancelTransferPayload {
  reason?: string
}

export const cancelTransferExecutor: Executor<CancelTransferPayload> = async (
  ctx: ExecutorContext<CancelTransferPayload>
) => {
  const { tx, targetId, request, resolvedById, payload } = ctx

  const transfer = await tx.agencyTransfer.findUnique({
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

  if (!transfer) {
    return { ok: false, invalidated: true, reason: "target_not_found" }
  }

  if (!fingerprintMatches(request.targetFingerprint, transfer.updatedAt)) {
    return { ok: false, invalidated: true, reason: "target_modified" }
  }

  // Idempotency
  if (transfer.status === "CANCELLED") {
    return { ok: true }
  }

  if (transfer.type !== "OUTGOING") {
    return {
      ok: false,
      error: `No se puede cancelar el traspaso #${transfer.voucher}: es de tipo ${transfer.type === "INCOMING" ? "recepción (INCOMING)" : transfer.type}. Desde acá solo se cancelan traspasos de salida (OUTGOING). Si querés cancelar una recepción, usá la sección de recepciones.`,
      retryable: false,
    }
  }

  const reason = payload?.reason?.trim() ?? null

  // Cancel the transfer
  await tx.agencyTransfer.update({
    where: { id: targetId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledById: resolvedById,
      cancelReason: reason,
    },
  })

  // Reverse INCOME cash entries
  const entries = await tx.cashBoxEntry.findMany({
    where: { transferId: targetId, type: "INCOME" },
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
    oldValues: { status: transfer.status },
    newValues: { status: "CANCELLED", cancelReason: reason },
    metadata: {
      subtype: "transfer:cancel",
      voucher: transfer.voucher,
      agencyName: transfer.agency.name,
      approvalRequestId: request.id,
    },
    description: `Traspaso #${transfer.voucher} anulado por solicitud ${request.id}`,
  })

  return { ok: true }
}
