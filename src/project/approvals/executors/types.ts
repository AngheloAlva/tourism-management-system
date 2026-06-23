import type { ApprovalRequest, Prisma } from "@/generated/prisma/client"

export interface ExecutorContext<TPayload = unknown> {
  request: ApprovalRequest
  payload: TPayload
  requestedById: string
  resolvedById: string
  targetId: string
  tx: Prisma.TransactionClient
}

export type ExecutorResult =
  | { ok: true }
  | { ok: false; error: string; retryable: boolean }
  | { ok: false; invalidated: true; reason: string }

export type Executor<TPayload = unknown> = (
  ctx: ExecutorContext<TPayload>
) => Promise<ExecutorResult>
