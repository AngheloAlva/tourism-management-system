"use client"

import { authClient } from "@/lib/auth-client"
import { APPROVAL_ACTION } from "@/generated/prisma/enums"
import { RequestApprovalDialog } from "@/project/approvals/components/request/request-approval-dialog"

import type { UserWithStats } from "../actions/user.actions"

interface BanUserDialogProps {
  user: UserWithStats | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

/**
 * Dialog para solicitar el baneo de un usuario.
 * Reemplaza el stub handleToggleBan por el flujo asincrónico de autorizaciones.
 */
export function BanUserDialog({ user, open, onOpenChange, onSuccess }: BanUserDialogProps) {
  const { data: session } = authClient.useSession()
  const isAdmin = session?.user?.role === "admin"

  if (!user) return null

  return (
    <RequestApprovalDialog
      open={open}
      onOpenChange={onOpenChange}
      action={APPROVAL_ACTION.BAN_USER}
      targetType="user"
      targetId={user.id}
      targetLabel={`Usuario "${user.name}"`}
      payload={{ userId: user.id, userName: user.name, userEmail: user.email }}
      snapshot={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        banned: user.banned,
      }}
      isAdmin={isAdmin}
      onSuccess={() => {
        onOpenChange(false)
        onSuccess?.()
      }}
    />
  )
}
