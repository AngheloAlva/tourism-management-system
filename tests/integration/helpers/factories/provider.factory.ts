import { prisma } from "@/lib/prisma"
import type { Provider, Prisma } from "@/generated/prisma"

let counter = 0
const uniq = () => `${Date.now()}-${++counter}`

export async function createProvider(
  overrides?: Partial<Prisma.ProviderCreateInput>,
): Promise<Provider> {
  return prisma.provider.create({
    data: {
      type: "NATURAL",
      rut: `1234567${uniq().slice(-3)}-8`,
      fullName: "Test Provider",
      isActive: true,
      ...overrides,
    },
  })
}
