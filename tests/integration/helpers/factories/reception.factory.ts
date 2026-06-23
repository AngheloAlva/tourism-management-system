/**
 * Reception factory.
 * "Receptions" in this project are AgencyTransfer rows with type: "INCOMING".
 */
import { prisma } from "@/lib/prisma"
import type { AgencyTransfer, Prisma } from "@/generated/prisma"
import { createUser } from "./user.factory"
import { createTransferAgency } from "./transfer.factory"

type CreateReceptionOpts = Partial<Prisma.AgencyTransferUncheckedCreateInput> & {
  createdById?: string
  agencyId?: string
}

let receptionVoucherCounter = 800_000
const nextVoucher = () => ++receptionVoucherCounter

export async function createReception(
  opts?: CreateReceptionOpts,
): Promise<AgencyTransfer> {
  const { createdById: providedUserId, agencyId: providedAgencyId, ...overrides } =
    opts ?? {}

  const createdById = providedUserId ?? (await createUser()).id
  const agencyId = providedAgencyId ?? (await createTransferAgency()).id

  return prisma.agencyTransfer.create({
    data: {
      voucher: nextVoucher(),
      type: "INCOMING",
      paymentStatus: "PENDING",
      status: "ACTIVE",
      date: new Date(),
      createdBy: createdById,
      agencyId,
      ...overrides,
    },
  })
}
