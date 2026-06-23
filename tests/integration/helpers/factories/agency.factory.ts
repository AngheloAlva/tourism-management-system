import { prisma } from "@/lib/prisma"
import type { Agency, Prisma } from "@/generated/prisma"

let counter = 0
const uniq = () => `agency-${Date.now()}-${++counter}`

export async function createAgency(
  overrides?: Partial<Prisma.AgencyCreateInput>,
): Promise<Agency> {
  return prisma.agency.create({
    data: {
      name: uniq(),
      contactEmails: [],
      active: true,
      ...overrides,
    },
  })
}
