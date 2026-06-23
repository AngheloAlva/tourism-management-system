"use server"

import { headers } from "next/headers"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { canCurrentUserInteractPath } from "@/project/roles/actions/role.actions"
import { requestApproval } from "@/project/approvals/actions/approval.actions"
import { computeFingerprint } from "@/project/approvals/utils/fingerprint"
import { buildSnapshot } from "@/project/approvals/utils/snapshot"
import { APPROVAL_ACTION } from "@/generated/prisma/enums"

export async function deleteAgency(
  id: string,
  reason: string
): Promise<
  | { success: true; approvalRequired: boolean; requestId?: string }
  | { success: false; error: string }
> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { success: false, error: "No autorizado" }

  const canInteract = await canCurrentUserInteractPath("/dashboard/gestion-de-mayoristas")
  if (!canInteract) return { success: false, error: "No tiene permisos para esta acción" }

  try {
    const agency = await prisma.agency.findUnique({
      where: { id },
      select: { id: true, name: true, active: true, updatedAt: true },
    })

    if (!agency) return { success: false, error: "Agencia no encontrada" }

    const fingerprint = computeFingerprint(agency)
    const snapshot = buildSnapshot("agencies", {
      id: agency.id,
      name: agency.name,
      active: agency.active,
    })

    const result = await requestApproval({
      action: APPROVAL_ACTION.DELETE_AGENCY,
      targetType: "agency",
      targetId: id,
      payload: { reason: reason.trim() },
      reason: reason.trim(),
      targetFingerprint: fingerprint,
      snapshot,
      source: { path: "/dashboard/gestion-de-mayoristas", ui: "delete-agency-dialog" },
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
    console.error("Error requesting agency deletion:", error)
    return { success: false, error: "Error al solicitar la eliminación de la agencia" }
  }
}
