"use client"

import { authClient } from "@/lib/auth-client"
import { APPROVAL_ACTION } from "@/generated/prisma/enums"
import { RequestApprovalDialog } from "@/project/approvals/components/request/request-approval-dialog"
import type { Provider } from "@/generated/prisma/client"

interface DeleteProviderDialogProps {
  provider: Provider | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

/**
 * Dialog para solicitar eliminación de un proveedor.
 * Reemplaza el AlertDialog directo por el flujo asincrónico de autorizaciones.
 */
export function DeleteProviderDialog({
  provider,
  open,
  onOpenChange,
  onSuccess,
}: DeleteProviderDialogProps) {
  const { data: session } = authClient.useSession()
  const isAdmin = session?.user?.role === "admin"

  if (!provider) return null

  const providerName =
    provider.type === "NATURAL"
      ? (provider.fullName ?? "Sin nombre")
      : (provider.companyName ?? "Sin nombre")

  return (
    <RequestApprovalDialog
      open={open}
      onOpenChange={onOpenChange}
      action={APPROVAL_ACTION.DELETE_PROVIDER}
      targetType="provider"
      targetId={provider.id}
      targetLabel={`Proveedor "${providerName}"`}
      payload={{ providerId: provider.id, name: providerName }}
      snapshot={{
        id: provider.id,
        name: providerName,
        active: provider.isActive,
      }}
      isAdmin={isAdmin}
      onSuccess={() => {
        onOpenChange(false)
        onSuccess?.()
      }}
    />
  )
}
