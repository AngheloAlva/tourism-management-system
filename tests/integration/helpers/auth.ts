import type { User } from "@/generated/prisma"
import { mockGetSession } from "../../../vitest.setup.integration"

type ForgedSession = {
  session: {
    id: string
    userId: string
    expiresAt: Date
    token: string
  }
  user: Pick<User, "id" | "name" | "email" | "role" | "mustChangePassword">
}

export function loginAs(user: User): void {
  const forged: ForgedSession = {
    session: {
      id: `test-session-${user.id}`,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      token: `test-token-${user.id}`,
    },
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
  }
  mockGetSession.mockResolvedValue(forged)
}

export function logout(): void {
  mockGetSession.mockResolvedValue(null)
}
