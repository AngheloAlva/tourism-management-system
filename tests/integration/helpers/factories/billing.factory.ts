import { prisma } from "@/lib/prisma"
import type { WholesaleInvoice, Prisma } from "@/generated/prisma"
import { createAgency } from "./agency.factory"

type CreateInvoiceOpts = Partial<Prisma.WholesaleInvoiceUncheckedCreateInput> & {
  agencyId?: string
}

export async function createInvoice(
  opts?: CreateInvoiceOpts,
): Promise<WholesaleInvoice> {
  const { agencyId: providedAgencyId, ...overrides } = opts ?? {}

  const agencyId = providedAgencyId ?? (await createAgency()).id

  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  return prisma.wholesaleInvoice.create({
    data: {
      periodStart: now,
      periodEnd,
      status: "DRAFT",
      documentStatus: "PENDING",
      currency: "CLP",
      subtotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 0,
      paidAmount: 0,
      pendingAmount: 0,
      agencyId,
      ...overrides,
    },
  })
}
