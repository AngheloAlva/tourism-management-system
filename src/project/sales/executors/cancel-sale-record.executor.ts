import { AuditService } from "@/lib/audit/service"
import { fingerprintMatches } from "@/project/approvals/utils/fingerprint"
import type { Executor, ExecutorContext } from "@/project/approvals/executors/types"

export interface CancelSaleRecordPayload {
  reason?: string
}

export const cancelSaleRecordExecutor: Executor<CancelSaleRecordPayload> = async (
  ctx: ExecutorContext<CancelSaleRecordPayload>
) => {
  const { tx, targetId, request, resolvedById } = ctx

  const record = await tx.saleRecord.findUnique({
    where: { id: targetId },
    select: { id: true, status: true, type: true, voucher: true, updatedAt: true },
  })

  if (!record) {
    return { ok: false, invalidated: true, reason: "target_not_found" }
  }

  if (!fingerprintMatches(request.targetFingerprint, record.updatedAt)) {
    return { ok: false, invalidated: true, reason: "target_modified" }
  }

  // Idempotency
  if (record.status === "CANCELLED") {
    return { ok: true }
  }

  const previousStatus = record.status

  await tx.saleRecord.update({
    where: { id: targetId },
    data: { status: "CANCELLED" },
  })

  await AuditService.createLog({
    action: "UPDATE",
    entityType: "SaleRecord",
    entityId: targetId,
    user: { id: resolvedById, name: "Admin", email: "" },
    oldValues: { status: previousStatus },
    newValues: { status: "CANCELLED" },
    metadata: {
      subtype: "sale:cancel",
      voucher: record.voucher,
      type: record.type,
      approvalRequestId: request.id,
    },
    description: `Anulación de ${record.type === "SALE" ? "venta" : "cotización"} #${record.voucher} por solicitud ${request.id}`,
  })

  return { ok: true }
}
