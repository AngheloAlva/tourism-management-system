import { prisma } from "@/lib/prisma"
import type { SaleRecord, Prisma } from "@/generated/prisma"
import { createUser } from "./user.factory"

type CreateSaleRecordOpts = Partial<Prisma.SaleRecordUncheckedCreateInput> & {
  sellerId?: string
}

let voucherCounter = 900_000
const nextVoucher = () => ++voucherCounter

export async function createSaleRecord(
  opts?: CreateSaleRecordOpts,
): Promise<SaleRecord> {
  const { sellerId: providedSellerId, ...overrides } = opts ?? {}

  const sellerId = providedSellerId ?? (await createUser()).id

  return prisma.saleRecord.create({
    data: {
      voucher: nextVoucher(),
      type: "SALE",
      channel: "PHYSICAL",
      status: "TO_BE_DONE",
      operatorPaymentStatus: "UNKNOWN",
      discount: 0,
      isWholesale: false,
      wholesalePaymentTerm: "IMMEDIATE",
      wholesaleMarkup: 0,
      contacted: false,
      sellerId,
      ...overrides,
    },
  })
}
