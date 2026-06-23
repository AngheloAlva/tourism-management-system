import { AuditService } from "@/lib/audit/service"
import { fingerprintMatches } from "@/project/approvals/utils/fingerprint"
import type { Executor, ExecutorContext } from "@/project/approvals/executors/types"

export interface DeleteReceptionPayload {
  reason?: string
}

export const deleteReceptionExecutor: Executor<DeleteReceptionPayload> = async (
  ctx: ExecutorContext<DeleteReceptionPayload>
) => {
  const { tx, targetId, request, resolvedById } = ctx

  const reception = await tx.agencyTransfer.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      type: true,
      voucher: true,
      updatedAt: true,
    },
  })

  if (!reception) {
    return { ok: false, invalidated: true, reason: "target_not_found" }
  }

  if (!fingerprintMatches(request.targetFingerprint, reception.updatedAt)) {
    return { ok: false, invalidated: true, reason: "target_modified" }
  }

  if (reception.type !== "INCOMING") {
    return {
      ok: false,
      error: "Solo se pueden eliminar recepciones de tipo entrada",
      retryable: false,
    }
  }

  await tx.agencyTransfer.delete({
    where: { id: targetId },
  })

  await AuditService.createLog({
    action: "DELETE",
    entityType: "AgencyTransfer",
    entityId: targetId,
    user: { id: resolvedById, name: "Admin", email: "" },
    oldValues: {},
    newValues: {},
    metadata: {
      subtype: "reception:delete",
      voucher: reception.voucher,
      approvalRequestId: request.id,
    },
    description: `Recepción #${reception.voucher} eliminada por solicitud ${request.id}`,
  })

  return { ok: true }
}
