import { AuditService } from "@/lib/audit/service"
import { fingerprintMatches } from "@/project/approvals/utils/fingerprint"
import type { Executor, ExecutorContext } from "@/project/approvals/executors/types"

export interface DeleteSaleRecordPayload {
  reason?: string
}

export const deleteSaleRecordExecutor: Executor<DeleteSaleRecordPayload> = async (
  ctx: ExecutorContext<DeleteSaleRecordPayload>
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

  // Idempotency: already cancelled
  if (record.status === "CANCELLED") {
    return { ok: true }
  }

  const previousStatus = record.status

  await tx.saleRecord.update({
    where: { id: targetId },
    data: { status: "CANCELLED" },
  })

  await AuditService.createLog({
    action: "DELETE",
    entityType: "SaleRecord",
    entityId: targetId,
    user: { id: resolvedById, name: "Admin", email: "" },
    oldValues: { status: previousStatus },
    newValues: { status: "CANCELLED" },
    metadata: {
      subtype: "sale:delete",
      voucher: record.voucher,
      type: record.type,
      approvalRequestId: request.id,
    },
    description: `Eliminación de ${record.type === "SALE" ? "venta" : "cotización"} #${record.voucher} por solicitud ${request.id}`,
  })

  return { ok: true }
}
