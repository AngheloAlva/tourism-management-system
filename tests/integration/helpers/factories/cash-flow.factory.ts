import { prisma } from "@/lib/prisma"
import type { CashBoxEntry, CashBox, Prisma } from "@/generated/prisma"
import { createUser } from "./user.factory"

type CreateCashBoxOpts = Partial<Prisma.CashBoxUncheckedCreateInput>

let dayOffset = 0
const nextDate = () => {
  const d = new Date()
  d.setDate(d.getDate() - dayOffset++)
  // Strip time — CashBox.date is @db.Date (date only)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export async function createCashBox(
  overrides?: CreateCashBoxOpts,
): Promise<CashBox> {
  return prisma.cashBox.create({
    data: {
      date: nextDate(),
      initialBalance: 0,
      status: "OPEN",
      ...overrides,
    },
  })
}

type CreateCashBoxEntryOpts = Partial<Prisma.CashBoxEntryUncheckedCreateInput> & {
  cashBoxId?: string
  createdById?: string
}

export async function createCashFlowEntry(
  opts?: CreateCashBoxEntryOpts,
): Promise<CashBoxEntry> {
  const { cashBoxId: providedCashBoxId, createdById: providedUserId, ...overrides } =
    opts ?? {}

  const cashBoxId = providedCashBoxId ?? (await createCashBox()).id
  const createdById = providedUserId ?? (await createUser()).id

  return prisma.cashBoxEntry.create({
    data: {
      type: "INCOME",
      amount: 10000,
      currency: "CLP",
      description: "Test income entry",
      cashBoxId,
      createdById,
      ...overrides,
    },
  })
}
