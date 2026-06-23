import { AuditService } from "@/lib/audit/service"
import { fingerprintMatches } from "@/project/approvals/utils/fingerprint"
import type { Executor, ExecutorContext } from "@/project/approvals/executors/types"

export interface DeleteAgencyPayload {
  reason?: string
}

export const deleteAgencyExecutor: Executor<DeleteAgencyPayload> = async (
  ctx: ExecutorContext<DeleteAgencyPayload>
) => {
  const { tx, targetId, request, resolvedById } = ctx

  const agency = await tx.agency.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      name: true,
      active: true,
      updatedAt: true,
    },
  })

  if (!agency) {
    return { ok: false, invalidated: true, reason: "target_not_found" }
  }

  if (!fingerprintMatches(request.targetFingerprint, agency.updatedAt)) {
    return { ok: false, invalidated: true, reason: "target_modified" }
  }

  if (!agency.active) {
    // Already inactive — idempotent success
    return { ok: true }
  }

  await tx.agency.update({
    where: { id: targetId },
    data: { active: false },
  })

  await AuditService.createLog({
    action: "DELETE",
    entityType: "Agency",
    entityId: targetId,
    user: { id: resolvedById, name: "Admin", email: "" },
    oldValues: { active: true },
    newValues: { active: false },
    metadata: {
      subtype: "approval.executed",
      agencyName: agency.name,
      approvalRequestId: request.id,
    },
    description: `Agencia "${agency.name}" marcada como inactiva por solicitud ${request.id}`,
  })

  return { ok: true }
}
