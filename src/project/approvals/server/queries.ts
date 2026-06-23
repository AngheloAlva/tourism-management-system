"use server"

import { APPROVAL_STATUS } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { computeDiff } from "../utils/diff"
import { buildSnapshot } from "../utils/snapshot"
import type { GetInboxRequestsInput } from "../schemas/approval.schemas"
import type { ApprovalDomain } from "../constants/approval-actions"

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("No autenticado")
  if (session.user.role !== "admin") throw new Error("No autorizado")
  return session.user
}

const RESOLVED_STATUSES: APPROVAL_STATUS[] = [
  APPROVAL_STATUS.APPROVED,
  APPROVAL_STATUS.EXECUTED,
  APPROVAL_STATUS.REJECTED,
  APPROVAL_STATUS.EXPIRED,
  APPROVAL_STATUS.INVALIDATED,
  APPROVAL_STATUS.FAILED,
]

export async function getInboxRequests(input: GetInboxRequestsInput) {
  await requireAdmin()

  const skip = (input.page - 1) * input.pageSize
  const scopeFilter =
    input.scope === "PENDING"
      ? { status: APPROVAL_STATUS.PENDING }
      : { status: { in: RESOLVED_STATUSES } }

  const where = {
    ...scopeFilter,
    ...(input.domain ? { domain: input.domain } : {}),
    ...(input.action ? { action: input.action } : {}),
    ...(input.requestedById ? { requestedById: input.requestedById } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.from || input.to
      ? {
          createdAt: {
            ...(input.from ? { gte: input.from } : {}),
            ...(input.to ? { lte: input.to } : {}),
          },
        }
      : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.approvalRequest.findMany({
      where,
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true, image: true },
        },
        resolvedBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: input.pageSize,
    }),
    prisma.approvalRequest.count({ where }),
  ])

  return { rows, total }
}

/**
 * Fetches the current state of the target from the DB for real-time diff display.
 * Dispatcher per domain/targetType. Returns null if the target no longer exists
 * or the domain is not yet supported.
 */
async function fetchCurrentTargetState(
  domain: ApprovalDomain,
  targetId: string
): Promise<Record<string, unknown> | null> {
  try {
    switch (domain) {
      case "events": {
        const event = await prisma.event.findUnique({
          where: { id: targetId },
          select: { id: true, status: true, date: true, startTime: true, cancelledAt: true },
        })
        if (!event) return null
        return buildSnapshot("events", event as Record<string, unknown>)
      }
      case "sales": {
        const sale = await prisma.saleRecord.findUnique({
          where: { id: targetId },
          select: { id: true, status: true, voucher: true, type: true },
        })
        if (!sale) return null
        return buildSnapshot("sales", sale as Record<string, unknown>)
      }
      case "transfers": {
        const transfer = await prisma.agencyTransfer.findUnique({
          where: { id: targetId },
          select: { id: true, status: true, voucher: true, type: true },
        })
        if (!transfer) return null
        return buildSnapshot("transfers", transfer as Record<string, unknown>)
      }
      case "receptions": {
        const reception = await prisma.agencyTransfer.findUnique({
          where: { id: targetId },
          select: { id: true, status: true, voucher: true, type: true },
        })
        if (!reception) return null
        return buildSnapshot("receptions", reception as Record<string, unknown>)
      }
      default:
        return null
    }
  } catch {
    return null
  }
}

export async function getRequestDetail(requestId: string) {
  await requireAdmin()

  const request = await prisma.approvalRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: {
      requestedBy: { select: { id: true, name: true, email: true } },
      resolvedBy: { select: { id: true, name: true, email: true } },
    },
  })

  const snapshotAtRequest = request.snapshot as Record<string, unknown> | null

  const currentTargetState = await fetchCurrentTargetState(
    request.domain as ApprovalDomain,
    request.targetId
  )

  const diff = computeDiff(snapshotAtRequest, currentTargetState)

  return {
    request,
    snapshotAtRequest,
    currentTargetState,
    diff,
  }
}

export async function getRequestCounts() {
  await requireAdmin()

  const [pending, resolved] = await Promise.all([
    prisma.approvalRequest.count({ where: { status: APPROVAL_STATUS.PENDING } }),
    prisma.approvalRequest.count({ where: { status: { in: RESOLVED_STATUSES } } }),
  ])

  return { pending, resolved }
}
