"use server"

import { createHash, randomInt } from "node:crypto"
import { addMinutes, isAfter } from "date-fns"
import { headers } from "next/headers"

import { canSendEmails, resendClient, resendFromEmail } from "@/lib/email/resend"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { APPROVAL_ACTION, APPROVAL_STATUS } from "@/generated/prisma/enums"
import { AuditService } from "@/lib/audit/service"
import {
  ACTION_TO_DOMAIN,
  isDomainGated,
  type ApprovalDomain,
} from "../constants/approval-actions"
import { computeFingerprint } from "../utils/fingerprint"
import { getExecutor } from "../executors/registry"
import {
  sendApprovalRequestedEmail,
  sendApprovalResolvedEmail,
} from "@/lib/email/approval-emails"
import { requestApprovalSchema } from "../schemas/approval.schemas"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ApprovalAction = "CANCEL_EVENT" | "LOCK_EVENT_EDIT"

type ApprovalMetadata = {
  payload: unknown
  source?: { path?: string; ui?: string }
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function getAuthUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    throw new Error("No autenticado")
  }

  return session.user
}

async function requireAdmin() {
  const user = await getAuthUser()
  if (user.role !== "admin") throw new Error("No autorizado")
  return user
}

// ---------------------------------------------------------------------------
// Legacy code-flow helpers (mantener hasta PR2)
// ---------------------------------------------------------------------------

const CODE_EXPIRATION_MINUTES = 10

function generateApprovalCode() {
  return randomInt(100000, 999999).toString()
}

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex")
}

async function sendApprovalCodeEmail(params: {
  requestId: string
  code: string
  action: ApprovalAction
  reason?: string
  requesterName: string
  requesterEmail: string
}) {
  if (!canSendEmails() || !resendClient) {
    return
  }

  const admins = await prisma.user.findMany({
    where: {
      role: "admin",
      banned: false,
    },
    select: {
      email: true,
      name: true,
    },
  })

  const recipients = admins
    .map((admin) => admin.email)
    .filter((email): email is string => Boolean(email))

  if (recipients.length === 0) {
    throw new Error("No hay administradores configurados para aprobación")
  }

  const actionLabel =
    params.action === "CANCEL_EVENT" ? "anulación de evento" : "bloqueo de edición de evento"

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 20px;">
      <h2 style="margin-bottom: 8px;">Código de aprobación requerido</h2>
      <p style="margin-top: 0; color: #475569;">
        Se solicitó una <strong>${actionLabel}</strong>.
      </p>
      <p><strong>Solicitante:</strong> ${params.requesterName} (${params.requesterEmail})</p>
      ${params.reason ? `<p><strong>Motivo:</strong> ${params.reason}</p>` : ""}
      <p><strong>ID solicitud:</strong> ${params.requestId}</p>
      <div style="margin: 20px 0; padding: 14px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
        <p style="margin: 0 0 6px 0; color: #475569;">Código de autorización:</p>
        <p style="margin: 0; font-size: 28px; letter-spacing: 4px; font-weight: 700;">${params.code}</p>
      </div>
      <p style="color: #64748b; font-size: 12px; margin-top: 0;">Este código vence en ${CODE_EXPIRATION_MINUTES} minutos.</p>
    </div>
  `

  const { error } = await resendClient.emails.send({
    from: resendFromEmail,
    to: recipients,
    subject: `Código de aprobación: ${actionLabel}`,
    html,
  })

  if (error) {
    throw new Error("No se pudo enviar el correo de aprobación")
  }
}

// ---------------------------------------------------------------------------
// Legacy actions — @deprecated: usar requestApproval/resolveApproval en PR2+
// ---------------------------------------------------------------------------

/**
 * @deprecated Usar requestApproval() en su lugar. Se mantiene para compat con cancelEventWithApproval hasta PR2.
 */
export async function requestActionApproval(params: {
  action: ApprovalAction
  targetType: string
  targetId: string
  reason?: string
  metadata?: unknown
}) {
  const user = await getAuthUser()

  const code = generateApprovalCode()
  const codeHash = hashCode(code)
  const expiresAt = addMinutes(new Date(), CODE_EXPIRATION_MINUTES)

  await prisma.approvalRequest.updateMany({
    where: {
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      requestedById: user.id,
      status: "PENDING",
    },
    data: {
      status: "EXPIRED",
    },
  })

  const request = await prisma.approvalRequest.create({
    data: {
      action: params.action,
      domain: ACTION_TO_DOMAIN[params.action as APPROVAL_ACTION] ?? "events",
      targetType: params.targetType,
      targetId: params.targetId,
      reason: params.reason,
      codeHash,
      codeLast4: code.slice(-4),
      expiresAt,
      requestedById: user.id,
      metadata: params.metadata as object | undefined,
    },
  })

  await sendApprovalCodeEmail({
    requestId: request.id,
    code,
    action: params.action,
    reason: params.reason,
    requesterName: user.name,
    requesterEmail: user.email,
  })

  return {
    success: true,
    requestId: request.id,
    expiresAt,
  }
}

/**
 * @deprecated Usar resolveApproval() en su lugar. Se mantiene para compat con cancelEventWithApproval hasta PR2.
 */
export async function verifyActionApprovalCode(params: {
  requestId: string
  code: string
  action: ApprovalAction
  targetType: string
  targetId: string
}) {
  const [user, request] = await Promise.all([
    getAuthUser(),
    prisma.approvalRequest.findUnique({
      where: { id: params.requestId },
    }),
  ])

  if (!request) {
    return { success: false, error: "Solicitud de aprobación no encontrada" }
  }

  if (request.requestedById !== user.id) {
    return { success: false, error: "No puede validar una solicitud de otro usuario" }
  }

  if (
    request.action !== params.action ||
    request.targetType !== params.targetType ||
    request.targetId !== params.targetId
  ) {
    return { success: false, error: "La solicitud no coincide con la operación" }
  }

  if (request.status !== "PENDING") {
    return { success: false, error: "La solicitud ya no está pendiente" }
  }

  if (request.expiresAt && isAfter(new Date(), request.expiresAt)) {
    await prisma.approvalRequest.update({
      where: { id: request.id },
      data: { status: "EXPIRED" },
    })
    return { success: false, error: "El código de aprobación expiró" }
  }

  if (!request.codeHash) {
    return { success: false, error: "Solicitud sin código asociado" }
  }

  const incomingHash = hashCode(params.code)
  if (incomingHash !== request.codeHash) {
    return { success: false, error: "Código de aprobación inválido" }
  }

  const approvedRequest = await prisma.approvalRequest.update({
    where: { id: request.id },
    data: {
      status: "APPROVED",
      usedAt: new Date(),
      verifiedById: user.id,
    },
  })

  return {
    success: true,
    request: approvedRequest,
  }
}

// ---------------------------------------------------------------------------
// New async approval actions
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// S-1: Auto-capture fingerprint/snapshot dispatcher
// ---------------------------------------------------------------------------

type TargetWithUpdatedAt = { updatedAt: Date } & Record<string, unknown>

/**
 * Auto-captures fingerprint and snapshot for a targetType/targetId if not provided by caller.
 * Centralizes the responsibility of snapshot capture so callers don't need to compute it.
 * Falls back gracefully if the target is not found or the targetType is unsupported.
 */
async function autoCaptureFingerprintAndSnapshot(
  targetType: string,
  targetId: string
): Promise<{ fingerprint: string | null; snapshot: Record<string, unknown> | null }> {
  try {
    let target: TargetWithUpdatedAt | null = null

    // Dispatcher per targetType
    if (targetType === "event") {
      target = (await prisma.event.findUnique({
        where: { id: targetId },
        select: { id: true, status: true, date: true, startTime: true, updatedAt: true },
      })) as TargetWithUpdatedAt | null
    } else if (targetType === "sale-record") {
      target = (await prisma.saleRecord.findUnique({
        where: { id: targetId },
        select: { id: true, status: true, voucher: true, type: true, updatedAt: true },
      })) as TargetWithUpdatedAt | null
    } else if (targetType === "agency-transfer") {
      target = (await prisma.agencyTransfer.findUnique({
        where: { id: targetId },
        select: { id: true, status: true, voucher: true, type: true, updatedAt: true },
      })) as TargetWithUpdatedAt | null
    }

    if (!target) {
      return { fingerprint: null, snapshot: null }
    }

    const fingerprint = target.updatedAt.toISOString()
    // Snapshot derived from the target without the updatedAt field
    const { updatedAt: _updatedAt, ...snapshotSource } = target
    const snapshot = snapshotSource as Record<string, unknown>

    return { fingerprint, snapshot }
  } catch {
    return { fingerprint: null, snapshot: null }
  }
}

/**
 * Solicita autorización para una acción destructiva.
 * Si el dominio no está gateado (flag OFF), ejecuta el executor directamente.
 * Si el caller no pasa targetFingerprint/snapshot, los captura automáticamente (S-1).
 * Retorna { approvalRequired: true, requestId } o { approvalRequired: false, executedDirectly: true }.
 */
export async function requestApproval<TPayload>(input: {
  action: APPROVAL_ACTION
  targetType: string
  targetId: string
  payload: TPayload
  reason?: string
  snapshot?: Record<string, unknown>
  targetFingerprint?: string
  source?: { path?: string; ui?: string }
}): Promise<
  | { approvalRequired: true; requestId: string }
  | { approvalRequired: false; executedDirectly: true }
  | { error: true; message: string }
> {
  // Validación server-side con Zod — no confiar solo en TypeScript
  const validation = requestApprovalSchema.safeParse({
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    payload: input.payload,
    reason: input.reason,
    source: input.source,
  })

  if (!validation.success) {
    const firstIssue = validation.error.issues[0]
    return { error: true, message: firstIssue?.message ?? "Datos de solicitud inválidos" }
  }

  const user = await getAuthUser()
  const domain = ACTION_TO_DOMAIN[input.action]

  // Si el dominio no está gateado, ejecutar directo sin crear solicitud
  if (!isDomainGated(domain)) {
    return { approvalRequired: false, executedDirectly: true }
  }

  // S-1: Auto-capture fingerprint/snapshot if caller didn't provide them
  let { targetFingerprint, snapshot } = input
  if (!targetFingerprint || !snapshot) {
    const autoCapture = await autoCaptureFingerprintAndSnapshot(input.targetType, input.targetId)
    if (!targetFingerprint) targetFingerprint = autoCapture.fingerprint ?? undefined
    if (!snapshot) snapshot = autoCapture.snapshot ?? undefined
  }

  const metadata: ApprovalMetadata = {
    payload: input.payload,
    source: input.source,
  }

  const request = await prisma.approvalRequest.create({
    data: {
      action: input.action,
      domain,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      targetFingerprint,
      snapshot: snapshot !== undefined ? (snapshot as object) : undefined,
      requestedById: user.id,
      metadata: metadata as object,
    },
  })

  // Audit log — solicitud creada
  await AuditService.createLog({
    action: "CREATE",
    entityType: "ApprovalRequest",
    entityId: request.id,
    user,
    newValues: {
      action: input.action,
      domain,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason ?? null,
      status: APPROVAL_STATUS.PENDING,
    },
    metadata: {
      subtype: "approval.requested",
      sourcePath: input.source?.path ?? null,
      sourceUi: input.source?.ui ?? null,
    },
    description: `Solicitud de autorización creada: ${input.action}`,
  })

  // Notificar a admins
  await sendApprovalRequestedEmail({ request, requester: user })

  return { approvalRequired: true, requestId: request.id }
}

/**
 * Resuelve una solicitud (aprobar o rechazar). Solo admins.
 * Al aprobar: ejecuta el executor del action, marca EXECUTED/FAILED/INVALIDATED.
 * Implementa control de concurrencia vía updateMany con guard de status.
 */
export async function resolveApproval(input: {
  requestId: string
  decision: "APPROVE" | "REJECT"
  resolutionNote?: string
}): Promise<{ status: APPROVAL_STATUS; error?: string }> {
  const admin = await requireAdmin()

  // FASE 1: lock optimista — updateMany con guard status=PENDING (atómico en PG)
  const updateResult = await prisma.approvalRequest.updateMany({
    where: { id: input.requestId, status: APPROVAL_STATUS.PENDING },
    data: {
      status:
        input.decision === "APPROVE" ? APPROVAL_STATUS.APPROVED : APPROVAL_STATUS.REJECTED,
      resolvedAt: new Date(),
      resolvedById: admin.id,
    },
  })

  if (updateResult.count === 0) {
    throw new Error("La solicitud ya fue resuelta o no existe")
  }

  const request = await prisma.approvalRequest.findUniqueOrThrow({
    where: { id: input.requestId },
    include: {
      requestedBy: { select: { id: true, name: true, email: true } },
    },
  })

  if (input.decision === "REJECT") {
    await AuditService.createLog({
      action: "UPDATE",
      entityType: "ApprovalRequest",
      entityId: request.id,
      user: admin,
      oldValues: { status: APPROVAL_STATUS.PENDING },
      newValues: { status: APPROVAL_STATUS.REJECTED, resolvedById: admin.id },
      metadata: {
        subtype: "approval.resolved",
        decision: "REJECT",
        resolutionNote: input.resolutionNote,
      },
      description: `Solicitud rechazada por ${admin.name}`,
    })

    await sendApprovalResolvedEmail({
      request,
      requester: request.requestedBy,
      finalStatus: APPROVAL_STATUS.REJECTED,
      resolvedBy: { name: admin.name },
      resolutionNote: input.resolutionNote,
    })

    return { status: APPROVAL_STATUS.REJECTED }
  }

  // FASE 2: ejecutar el executor dentro de su propia transacción
  const executor = getExecutor(request.action)
  const metadata = request.metadata as ApprovalMetadata | null

  type ExecutorResultType =
    | { ok: true }
    | { ok: false; error: string; retryable: boolean }
    | { ok: false; invalidated: true; reason: string }

  let result: ExecutorResultType
  try {
    result = await prisma.$transaction(async (tx) => {
      return executor({
        request,
        payload: metadata?.payload,
        requestedById: request.requestedById,
        resolvedById: admin.id,
        targetId: request.targetId,
        tx,
      })
    }, { timeout: 30000, maxWait: 10000 })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    result = { ok: false, error: errorMsg, retryable: true }
  }

  // FASE 3: estado final
  let finalStatus: APPROVAL_STATUS

  if (result.ok) {
    finalStatus = APPROVAL_STATUS.EXECUTED
    await prisma.approvalRequest.update({
      where: { id: request.id },
      data: { status: APPROVAL_STATUS.EXECUTED, executedAt: new Date() },
    })

    await AuditService.createLog({
      action: "UPDATE",
      entityType: "ApprovalRequest",
      entityId: request.id,
      user: admin,
      oldValues: { status: APPROVAL_STATUS.APPROVED },
      newValues: { status: APPROVAL_STATUS.EXECUTED, executedAt: new Date() },
      metadata: { subtype: "approval.executed" },
      description: `Acción ejecutada: ${request.action}`,
    })
  } else if ("invalidated" in result && result.invalidated) {
    finalStatus = APPROVAL_STATUS.INVALIDATED
    await prisma.approvalRequest.update({
      where: { id: request.id },
      data: {
        status: APPROVAL_STATUS.INVALIDATED,
        invalidationReason: result.reason,
      },
    })

    await AuditService.createLog({
      action: "UPDATE",
      entityType: "ApprovalRequest",
      entityId: request.id,
      user: admin,
      oldValues: { status: APPROVAL_STATUS.APPROVED },
      newValues: {
        status: APPROVAL_STATUS.INVALIDATED,
        invalidationReason: result.reason,
      },
      metadata: { subtype: "approval.invalidated", reason: result.reason },
      description: `Solicitud invalidada: ${result.reason}`,
    })
  } else {
    const errorMsg = "error" in result ? result.error : "Error desconocido"
    finalStatus = APPROVAL_STATUS.FAILED
    await prisma.approvalRequest.update({
      where: { id: request.id },
      data: { status: APPROVAL_STATUS.FAILED, executionError: errorMsg },
    })

    await AuditService.createLog({
      action: "UPDATE",
      entityType: "ApprovalRequest",
      entityId: request.id,
      user: admin,
      oldValues: { status: APPROVAL_STATUS.APPROVED },
      newValues: { status: APPROVAL_STATUS.FAILED, executionError: errorMsg },
      metadata: { subtype: "approval.failed", error: errorMsg },
      description: `Ejecución fallida: ${errorMsg}`,
    })
  }

  await sendApprovalResolvedEmail({
    request,
    requester: request.requestedBy,
    finalStatus,
    resolvedBy: { name: admin.name },
    resolutionNote: input.resolutionNote,
    executionError: finalStatus === APPROVAL_STATUS.FAILED && "error" in result ? result.error : undefined,
    invalidationReason:
      finalStatus === APPROVAL_STATUS.INVALIDATED && "reason" in result ? result.reason : undefined,
  })

  return { status: finalStatus }
}

/**
 * Expira solicitudes PENDING con más de 7 días de antigüedad.
 * Usado por el cron job diario.
 */
export async function expirePendingApprovals(): Promise<{ expired: number }> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const expired = await prisma.approvalRequest.findMany({
    where: {
      status: APPROVAL_STATUS.PENDING,
      createdAt: { lt: cutoff },
    },
    include: {
      requestedBy: { select: { id: true, name: true, email: true } },
    },
  })

  for (const req of expired) {
    await prisma.approvalRequest.update({
      where: { id: req.id },
      data: { status: APPROVAL_STATUS.EXPIRED, resolvedAt: new Date() },
    })

    // Audit log
    await AuditService.createLog({
      action: "UPDATE",
      entityType: "ApprovalRequest",
      entityId: req.id,
      user: { id: undefined, name: "Sistema (cron)", email: "system@cron" },
      oldValues: { status: APPROVAL_STATUS.PENDING },
      newValues: { status: APPROVAL_STATUS.EXPIRED },
      metadata: { subtype: "approval.expired" },
      description: `Solicitud expirada automáticamente (TTL 7 días)`,
    })

    await sendApprovalResolvedEmail({
      request: req,
      requester: req.requestedBy,
      finalStatus: APPROVAL_STATUS.EXPIRED,
      resolvedBy: null,
    })
  }

  return { expired: expired.length }
}

export async function getCurrentUserRole() {
  const user = await getAuthUser()
  return user.role || "user"
}
