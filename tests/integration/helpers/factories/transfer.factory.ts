/**
 * Transfer factory.
 * "Transfers" are AgencyTransfer rows with type: "OUTGOING".
 * Also exports createTransferAgency as a shared helper.
 */
import { prisma } from "@/lib/prisma"
import type { AgencyTransfer, TransferAgency, Prisma } from "@/generated/prisma"
import { createUser } from "./user.factory"

// ─── TransferAgency helper ─────────────────────────────────────────────────

let agencyCounter = 0
const uniqAgency = () => `transfer-agency-${Date.now()}-${++agencyCounter}`

export async function createTransferAgency(
  overrides?: Partial<Prisma.TransferAgencyCreateInput>,
): Promise<TransferAgency> {
  return prisma.transferAgency.create({
    data: {
      name: uniqAgency(),
      contactEmails: [],
      active: true,
      ...overrides,
    },
  })
}

// ─── AgencyTransfer (outgoing) ─────────────────────────────────────────────

type CreateTransferOpts = Partial<Prisma.AgencyTransferUncheckedCreateInput> & {
  createdById?: string
  agencyId?: string
}

let transferVoucherCounter = 700_000
const nextVoucher = () => ++transferVoucherCounter

export async function createTransfer(
  opts?: CreateTransferOpts,
): Promise<AgencyTransfer> {
  const { createdById: providedUserId, agencyId: providedAgencyId, ...overrides } =
    opts ?? {}

  const createdById = providedUserId ?? (await createUser()).id
  const agencyId = providedAgencyId ?? (await createTransferAgency()).id

  return prisma.agencyTransfer.create({
    data: {
      voucher: nextVoucher(),
      type: "OUTGOING",
      paymentStatus: "PENDING",
      status: "ACTIVE",
      date: new Date(),
      createdBy: createdById,
      agencyId,
      ...overrides,
    },
  })
}
