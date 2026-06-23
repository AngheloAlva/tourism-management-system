import { createElement } from "react"
import { APPROVAL_STATUS } from "@/generated/prisma/enums"
import { canSendEmails, resendClient, resendFromEmail } from "./resend"
import { ApprovalRequestedEmail } from "./templates/approval-requested-email"
import { ApprovalResolvedEmail } from "./templates/approval-resolved-email"
import { prisma } from "@/lib/prisma"
import { APPROVAL_ACTION_LABELS } from "@/project/approvals/constants/approval-actions"

type ApprovalRequestMinimal = {
  id: string
  action: import("@/generated/prisma/client").APPROVAL_ACTION
  targetType: string
  targetId: string
  reason: string | null
}

type UserMinimal = {
  id: string
  name: string
  email: string
}

/**
 * Envía email a todos los admins activos notificando una nueva solicitud.
 * Fix del bug original: destinatario real, no delivered@resend.dev.
 */
export async function sendApprovalRequestedEmail(params: {
  request: ApprovalRequestMinimal
  requester: UserMinimal
}): Promise<void> {
  if (!canSendEmails() || !resendClient) return

  const admins = await prisma.user.findMany({
    where: { role: "admin", banned: false },
    select: { email: true },
  })

  const recipients = admins
    .map((a) => a.email)
    .filter((email): email is string => Boolean(email))

  if (recipients.length === 0) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "https://dashboard.turismochile.com"
  const actionLabel = APPROVAL_ACTION_LABELS[params.request.action] ?? params.request.action
  const targetLabel = `${params.request.targetType} #${params.request.targetId.slice(-8)}`

  await resendClient.emails.send({
    from: resendFromEmail,
    to: recipients,
    subject: `Nueva solicitud de autorización: ${actionLabel}`,
    react: createElement(ApprovalRequestedEmail, {
      requesterName: params.requester.name,
      requesterEmail: params.requester.email,
      action: params.request.action,
      targetLabel,
      reason: params.request.reason,
      requestId: params.request.id,
      appUrl,
    }),
  })
}

/**
 * Envía email al solicitante notificando la resolución de su solicitud.
 */
export async function sendApprovalResolvedEmail(params: {
  request: ApprovalRequestMinimal
  requester: UserMinimal
  finalStatus: APPROVAL_STATUS
  resolvedBy: { name: string } | null
  resolutionNote?: string | null
  executionError?: string | null
  invalidationReason?: string | null
}): Promise<void> {
  if (!canSendEmails() || !resendClient) return
  if (!params.requester.email) return

  const actionLabel = APPROVAL_ACTION_LABELS[params.request.action] ?? params.request.action
  const targetLabel = `${params.request.targetType} #${params.request.targetId.slice(-8)}`

  const STATUS_SUBJECTS: Partial<Record<APPROVAL_STATUS, string>> = {
    [APPROVAL_STATUS.EXECUTED]: "Tu solicitud fue aprobada y ejecutada",
    [APPROVAL_STATUS.REJECTED]: "Tu solicitud fue rechazada",
    [APPROVAL_STATUS.INVALIDATED]: "Tu solicitud quedó anulada (el recurso cambió)",
    [APPROVAL_STATUS.FAILED]: "Tu solicitud fue aprobada pero falló al ejecutarse",
    [APPROVAL_STATUS.EXPIRED]: "Tu solicitud expiró sin resolución",
  }

  const subject = STATUS_SUBJECTS[params.finalStatus] ?? `Actualización de solicitud: ${actionLabel}`

  await resendClient.emails.send({
    from: resendFromEmail,
    to: [params.requester.email],
    subject,
    react: createElement(ApprovalResolvedEmail, {
      requesterName: params.requester.name,
      action: params.request.action,
      targetLabel,
      finalStatus: params.finalStatus,
      resolvedByName: params.resolvedBy?.name ?? null,
      resolutionNote: params.resolutionNote,
      executionError: params.executionError,
      invalidationReason: params.invalidationReason,
    }),
  })
}
