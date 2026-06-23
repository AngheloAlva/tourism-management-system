import { prisma } from "@/lib/prisma"
import type { EventBookingCommission, Prisma } from "@/generated/prisma"
import { createUser } from "./user.factory"
import { createEvent } from "./event.factory"
import { createSaleRecord } from "./sale-record.factory"

type CreateCommissionOpts = Partial<
  Prisma.EventBookingCommissionUncheckedCreateInput
> & {
  eventBookingId?: string
  paidById?: string
}

export async function createCommission(
  opts?: CreateCommissionOpts,
): Promise<EventBookingCommission> {
  const {
    eventBookingId: providedBookingId,
    paidById: providedUserId,
    ...overrides
  } = opts ?? {}

  let eventBookingId = providedBookingId
  if (!eventBookingId) {
    // Create dependencies: event + sale record → event booking
    const event = await createEvent()
    const sale = await createSaleRecord()
    const booking = await prisma.eventBooking.create({
      data: {
        passengerCount: 1,
        eventId: event.id,
        saleRecordId: sale.id,
      },
    })
    eventBookingId = booking.id
  }

  const paidById = providedUserId ?? (await createUser()).id

  return prisma.eventBookingCommission.create({
    data: {
      kind: "REGULAR",
      percentage: 10,
      baseAmount: 50000,
      commissionAmount: 5000,
      totalPaid: 5000,
      paidAt: new Date(),
      eventBookingId,
      paidById,
      ...overrides,
    },
  })
}
