import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { AuditService } from "@/lib/audit/service"
import { fingerprintMatches } from "@/project/approvals/utils/fingerprint"
import type { Executor, ExecutorContext } from "@/project/approvals/executors/types"
import type { BanUserPayload } from "../actions/ban-user.action"

/**
 * Executor para BAN_USER.
 *
 * Activa el ban vía Better Auth admin API (`auth.api.banUser`).
 * La lógica de negocio del ban (campo `banned`, `banReason`, sesiones revocadas)
 * la maneja Better Auth internamente, por lo que no se usa la transacción Prisma.
 *
 * Nota: User no está en AuditableEntity → se usa entityType="ApprovalRequest"
 * con metadata.userId como workaround (igual que deleteProviderExecutor).
 */
export const banUserExecutor: Executor<BanUserPayload> = async (
  ctx: ExecutorContext<BanUserPayload>
) => {
  const { tx, targetId, request, resolvedById, payload } = ctx

  // 1. Verificar que el usuario existe y validar fingerprint
  const user = await tx.user.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      name: true,
      email: true,
      banned: true,
      updatedAt: true,
    },
  })

  if (!user) {
    return { ok: false, invalidated: true, reason: "target_not_found" }
  }

  if (!fingerprintMatches(request.targetFingerprint, user.updatedAt)) {
    return { ok: false, invalidated: true, reason: "target_modified" }
  }

  // 2. Idempotencia: si ya está baneado, considerar éxito sin re-ejecutar
  if (user.banned) {
    return { ok: true }
  }

  // 3. Activar ban vía Better Auth admin API
  //    auth.api.banUser maneja internamente: campo banned, banReason, revocación de sesiones
  const banResult = await auth.api.banUser({
    body: {
      userId: targetId,
      banReason: request.reason ?? payload.userName ? `Solicitud aprobada: ${request.reason}` : "Baneado por administrador",
    },
    headers: await headers(),
  })

  if (!banResult) {
    return {
      ok: false,
      error: "Better Auth no pudo activar el ban del usuario",
      retryable: true,
    }
  }

  // 4. Audit log (entityType=ApprovalRequest porque User no está en AuditableEntity)
  await AuditService.createLog({
    action: "UPDATE",
    entityType: "ApprovalRequest",
    entityId: request.id,
    user: { id: resolvedById, name: "Admin", email: "" },
    oldValues: { banned: false },
    newValues: { banned: true },
    metadata: {
      subtype: "approval.executed",
      userId: targetId,
      userName: user.name,
      userEmail: user.email,
      banReason: request.reason,
      approvalRequestId: request.id,
    },
    description: `Usuario "${user.name}" (${user.email}) baneado por solicitud ${request.id}`,
  })

  return { ok: true }
}
