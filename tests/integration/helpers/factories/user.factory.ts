import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { User } from "@/generated/prisma"

type CreateUserOpts = {
  email?: string
  name?: string
  password?: string
  role?: "admin" | "user" | "operadora"
  mustChangePassword?: boolean
}

let counter = 0
const uniq = () => `test-${Date.now()}-${++counter}`

export async function createUser(opts: CreateUserOpts = {}): Promise<User> {
  const email = opts.email ?? `${uniq()}@test.local`
  const name = opts.name ?? "Test User"
  const password = opts.password ?? "Password123!"

  // LOCKED: must go through Better Auth so Account row + password hash are created correctly.
  await auth.api.signUpEmail({
    body: { email, name, password },
  })

  const where = { email }

  if (opts.role !== undefined || opts.mustChangePassword !== undefined) {
    await prisma.user.update({
      where,
      data: {
        ...(opts.role !== undefined ? { role: opts.role } : {}),
        ...(opts.mustChangePassword !== undefined
          ? { mustChangePassword: opts.mustChangePassword }
          : {}),
      },
    })
  }

  const user = await prisma.user.findUniqueOrThrow({ where })
  return user
}
