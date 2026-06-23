import { AuditService } from "@/lib/audit/service"
import { fingerprintMatches } from "@/project/approvals/utils/fingerprint"
import type { Executor, ExecutorContext } from "@/project/approvals/executors/types"

export interface DeleteProviderPayload {
  reason?: string
}

/**
 * Executor para DELETE_PROVIDER.
 *
 * SC-10 special case: antes del hard delete se invalidan todos los ApprovalRequests
 * PENDING asociados a este proveedor (excluyendo la solicitud actual que ya está APPROVED).
 * Esto evita que queden solicitudes huérfanas apuntando a un target eliminado.
 */
export const deleteProviderExecutor: Executor<DeleteProviderPayload> = async (
  ctx: ExecutorContext<DeleteProviderPayload>
) => {
  const { tx, targetId, request, resolvedById } = ctx

  // 1. Verificar que el provider existe y validar fingerprint
  const provider = await tx.provider.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      fullName: true,
      companyName: true,
      type: true,
      isActive: true,
      updatedAt: true,
    },
  })

  if (!provider) {
    return { ok: false, invalidated: true, reason: "target_not_found" }
  }

  if (!fingerprintMatches(request.targetFingerprint, provider.updatedAt)) {
    return { ok: false, invalidated: true, reason: "target_modified" }
  }

  const providerName =
    provider.type === "NATURAL" ? (provider.fullName ?? "Sin nombre") : (provider.companyName ?? "Sin nombre")

  // 2. SC-10: Invalidar otros ApprovalRequests PENDING sobre este provider
  //    (excluyendo la solicitud actual que ya fue marcada APPROVED y está ejecutándose)
  const pendingRequests = await tx.approvalRequest.findMany({
    where: {
      targetId,
      targetType: "provider",
      status: "PENDING",
      id: { not: request.id },
    },
    select: { id: true },
  })

  if (pendingRequests.length > 0) {
    await tx.approvalRequest.updateMany({
      where: {
        id: { in: pendingRequests.map((r) => r.id) },
      },
      data: {
        status: "INVALIDATED",
        invalidationReason: "Provider eliminado por otra solicitud aprobada",
        resolvedAt: new Date(),
        resolvedById,
      },
    })

    // Audit log por cada invalidación
    for (const pendingReq of pendingRequests) {
      await AuditService.createLog({
        action: "UPDATE",
        entityType: "ApprovalRequest",
        entityId: pendingReq.id,
        user: { id: resolvedById, name: "Admin", email: "" },
        oldValues: { status: "PENDING" },
        newValues: { status: "INVALIDATED" },
        metadata: {
          subtype: "approval.invalidated",
          reason: "Provider eliminado por otra solicitud aprobada",
          triggeredByApprovalRequestId: request.id,
          providerId: targetId,
          providerName,
        },
        description: `ApprovalRequest ${pendingReq.id} invalidada por eliminación del proveedor "${providerName}"`,
      })
    }
  }

  // 3. Hard delete del provider
  await tx.provider.delete({
    where: { id: targetId },
  })

  // 4. Audit log de la eliminación (entityType=ApprovalRequest porque Provider no está en AuditableEntity)
  await AuditService.createLog({
    action: "DELETE",
    entityType: "ApprovalRequest",
    entityId: request.id,
    user: { id: resolvedById, name: "Admin", email: "" },
    oldValues: {},
    newValues: {},
    metadata: {
      subtype: "approval.executed",
      providerName,
      providerType: provider.type,
      providerId: targetId,
      approvalRequestId: request.id,
      invalidatedPendingCount: pendingRequests.length,
    },
    description: `Proveedor "${providerName}" eliminado por solicitud ${request.id}${pendingRequests.length > 0 ? ` (${pendingRequests.length} solicitudes PENDING invalidadas)` : ""}`,
  })

  return { ok: true }
}
