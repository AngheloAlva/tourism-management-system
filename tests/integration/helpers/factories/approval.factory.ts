import { prisma } from "@/lib/prisma"
import type { ApprovalRequest, Prisma } from "@/generated/prisma"
import { createUser } from "./user.factory"

type CreateApprovalOpts = Partial<Prisma.ApprovalRequestUncheckedCreateInput> & {
  requestedById?: string
}

export async function createApproval(
  opts?: CreateApprovalOpts,
): Promise<ApprovalRequest> {
  const { requestedById: providedUserId, ...overrides } = opts ?? {}

  const requestedById = providedUserId ?? (await createUser()).id

  return prisma.approvalRequest.create({
    data: {
      action: "CANCEL_EVENT",
      domain: "events",
      status: "PENDING",
      targetType: "Event",
      targetId: "test-target-id",
      codeHash: "test-hash-value",
      codeLast4: "1234",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      requestedById,
      ...overrides,
    },
  })
}
