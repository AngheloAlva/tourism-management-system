"use server"

import { headers } from "next/headers"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { canCurrentUserInteractPath } from "@/project/roles/actions/role.actions"
import { requestApproval } from "@/project/approvals/actions/approval.actions"
import { computeFingerprint } from "@/project/approvals/utils/fingerprint"
import { buildSnapshot } from "@/project/approvals/utils/snapshot"
import { APPROVAL_ACTION } from "@/generated/prisma/enums"

export interface BanUserPayload {
  userId: string
  userName: string
  userEmail: string
}

export async function banUser(
  userId: string,
  reason: string
): Promise<
  | { success: true; approvalRequired: boolean; requestId?: string }
  | { success: false; error: string }
> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { success: false, error: "No autorizado" }

  const canInteract = await canCurrentUserInteractPath("/dashboard/usuarios")
  if (!canInteract) return { success: false, error: "No tiene permisos para esta acción" }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        banned: true,
        updatedAt: true,
      },
    })

    if (!user) return { success: false, error: "Usuario no encontrado" }
    if (user.banned) return { success: false, error: "El usuario ya está baneado" }

    const fingerprint = computeFingerprint(user)
    const snapshot = buildSnapshot("users", {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      banned: user.banned,
    })

    const result = await requestApproval({
      action: APPROVAL_ACTION.BAN_USER,
      targetType: "user",
      targetId: userId,
      payload: {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
      } satisfies BanUserPayload,
      reason: reason.trim(),
      targetFingerprint: fingerprint,
      snapshot,
      source: { path: "/dashboard/usuarios", ui: "ban-user-dialog" },
    })

    if ("error" in result) {
      return { success: false, error: result.message }
    }

    return {
      success: true,
      approvalRequired: result.approvalRequired,
      requestId: result.approvalRequired ? result.requestId : undefined,
    }
  } catch (error) {
    console.error("Error requesting user ban:", error)
    return { success: false, error: "Error al solicitar el baneo del usuario" }
  }
}
