import { prisma } from "@/lib/prisma"
import type { Event, Prisma } from "@/generated/prisma"
import { createTour } from "./tour.factory"

type CreateEventOpts = Partial<Prisma.EventUncheckedCreateInput> & {
  tourId?: string
}

export async function createEvent(opts?: CreateEventOpts): Promise<Event> {
  const { tourId: providedTourId, ...overrides } = opts ?? {}

  const tourId = providedTourId ?? (await createTour()).id

  return prisma.event.create({
    data: {
      serviceKind: "TOUR",
      mode: "REGULAR",
      date: new Date(),
      maxCapacity: 12,
      currentBookings: 0,
      status: "SCHEDULED",
      tourId,
      ...overrides,
    },
  })
}
