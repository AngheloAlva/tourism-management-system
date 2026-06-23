import type { ApprovalRequest, User } from "@/generated/prisma/client"
import type { APPROVAL_ACTION, APPROVAL_STATUS } from "@/generated/prisma/enums"

export type InboxRow = ApprovalRequest & {
  requestedBy: Pick<User, "id" | "name" | "email"> & { image?: string | null }
  resolvedBy: Pick<User, "id" | "name"> | null
}

export type InboxResult = {
  rows: InboxRow[]
  total: number
}
