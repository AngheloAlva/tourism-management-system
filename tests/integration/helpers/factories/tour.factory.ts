import { prisma } from "@/lib/prisma"
import type { Tour, Prisma } from "@/generated/prisma"

let counter = 0
const uniq = () => `tour-${Date.now()}-${++counter}`

export async function createTour(
  overrides?: Partial<Prisma.TourCreateInput>,
): Promise<Tour> {
  return prisma.tour.create({
    data: {
      name: uniq(),
      active: true,
      maxCapacity: 12,
      ...overrides,
    },
  })
}
