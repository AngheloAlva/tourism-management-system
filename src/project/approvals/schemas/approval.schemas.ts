import { z } from "zod"
import { APPROVAL_ACTION, APPROVAL_STATUS } from "@/generated/prisma/enums"
import { APPROVAL_DOMAINS } from "../constants/approval-actions"

export const requestApprovalSchema = z.object({
  action: z.nativeEnum(APPROVAL_ACTION),
  targetType: z.string().min(1),
  targetId: z.string().min(1),
  payload: z.unknown(),
  reason: z.string().min(1, "El motivo es requerido").max(1000),
  source: z
    .object({
      path: z.string().optional(),
      ui: z.string().optional(),
    })
    .optional(),
})

export type RequestApprovalInput = z.infer<typeof requestApprovalSchema>

export const resolveApprovalSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["APPROVE", "REJECT"]),
  resolutionNote: z.string().max(1000).optional(),
})

export type ResolveApprovalInput = z.infer<typeof resolveApprovalSchema>

export const getInboxRequestsSchema = z.object({
  scope: z.enum(["PENDING", "RESOLVED"]).default("PENDING"),
  domain: z.enum(APPROVAL_DOMAINS).optional(),
  action: z.nativeEnum(APPROVAL_ACTION).optional(),
  requestedById: z.string().optional(),
  status: z.nativeEnum(APPROVAL_STATUS).optional(),
  from: z.date().optional(),
  to: z.date().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})

export type GetInboxRequestsInput = z.infer<typeof getInboxRequestsSchema>
