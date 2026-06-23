"use client"

import { authClient } from "@/lib/auth-client"
import { APPROVAL_ACTION } from "@/generated/prisma/enums"
import { RequestApprovalDialog } from "@/project/approvals/components/request/request-approval-dialog"
import type { Agency } from "../types/agency"

interface DeleteAgencyDialogProps {
  agency: Agency | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

/**
 * Dialog para solicitar eliminación de una agencia mayorista.
 * Reemplaza el AlertDialog directo por el flujo asincrónico de autorizaciones.
 */
export function DeleteAgencyDialog({
  agency,
  open,
  onOpenChange,
  onSuccess,
}: DeleteAgencyDialogProps) {
  const { data: session } = authClient.useSession()
  const isAdmin = session?.user?.role === "admin"

  if (!agency) return null

  return (
    <RequestApprovalDialog
      open={open}
      onOpenChange={onOpenChange}
      action={APPROVAL_ACTION.DELETE_AGENCY}
      targetType="agency"
      targetId={agency.id}
      targetLabel={`Agencia "${agency.name}"`}
      payload={{ agencyId: agency.id, name: agency.name }}
      snapshot={{
        id: agency.id,
        name: agency.name,
        active: agency.active,
      }}
      isAdmin={isAdmin}
      onSuccess={() => {
        onOpenChange(false)
        onSuccess?.()
      }}
    />
  )
}
