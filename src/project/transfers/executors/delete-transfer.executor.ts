import { AuditService } from "@/lib/audit/service"
import { fingerprintMatches } from "@/project/approvals/utils/fingerprint"
import type { Executor, ExecutorContext } from "@/project/approvals/executors/types"

export interface DeleteTransferPayload {
  reason?: string
}

export const deleteTransferExecutor: Executor<DeleteTransferPayload> = async (
  ctx: ExecutorContext<DeleteTransferPayload>
) => {
  const { tx, targetId, request, resolvedById } = ctx

  const transfer = await tx.agencyTransfer.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      status: true,
      voucher: true,
      updatedAt: true,
    },
  })

  if (!transfer) {
    return { ok: false, invalidated: true, reason: "target_not_found" }
  }

  if (!fingerprintMatches(request.targetFingerprint, transfer.updatedAt)) {
    return { ok: false, invalidated: true, reason: "target_modified" }
  }

  await tx.agencyTransfer.delete({
    where: { id: targetId },
  })

  await AuditService.createLog({
    action: "DELETE",
    entityType: "AgencyTransfer",
    entityId: targetId,
    user: { id: resolvedById, name: "Admin", email: "" },
    oldValues: { status: transfer.status },
    newValues: {},
    metadata: {
      subtype: "transfer:delete",
      voucher: transfer.voucher,
      approvalRequestId: request.id,
    },
    description: `Traspaso #${transfer.voucher} eliminado por solicitud ${request.id}`,
  })

  return { ok: true }
}
