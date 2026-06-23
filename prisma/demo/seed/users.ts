/**
 * Seed: users, accounts, and sessions.
 *
 * Creates the demo user (auto-login target) and a cast of internal sellers.
 * Passwords are bcrypt-hashed with cost 10 (fast for build-time).
 *
 * Better Auth requires an `account` row with providerId = "credential"
 * for email+password login. A long-lived `session` row is also inserted
 * for the demo user so the runtime can restore it directly.
 */

import { createHash } from "node:crypto"
// Direct relative path — @generated/* alias is resolved by Next/tsc but not by tsx at runtime.
import type { PrismaClient } from "../../../src/generated/prisma/client"
import { DEMO_USER_EMAIL, DEMO_USER_PASSWORD, SELLER_NAMES } from "./constants"

/** Deterministic bcrypt-compatible hash placeholder.
 *  At runtime, Better Auth uses argon2/bcrypt for verification.
 *  We use a static pre-hashed value (bcrypt, cost 10) so the seed
 *  has no native binary dependency at build time. */
const BCRYPT_DEMO =
  "$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0YbFEIZAqem"

/** Derive a stable fake password hash for internal sellers (they cannot log in externally). */
function stableHash(name: string): string {
  const hex = createHash("sha256").update(name + "demo-seed").digest("hex")
  // Format as a bcrypt-looking string (won't pass BA verification — intentional)
  return `$2b$10$${hex.substring(0, 53)}`
}

/** Demo session token — stable across builds so Slice 3 can inject it. */
export const DEMO_SESSION_TOKEN = "demo-session-token-atacama-2026"

export interface SeededUsers {
  demoUserId: string
  adminUserId: string
  sellerUserIds: string[]
}

export async function seedUsers(prisma: PrismaClient): Promise<SeededUsers> {
  console.log("  Seeding users...")

  // 1. Demo user (admin role, used for auto-login)
  const demoUser = await prisma.user.create({
    data: {
      name: "Demo Admin",
      email: DEMO_USER_EMAIL,
      emailVerified: true,
      role: "admin",
      mustChangePassword: false,
      banned: false,
    },
  })

  // Account row required by Better Auth for credential login
  await prisma.account.create({
    data: {
      accountId: demoUser.id,
      providerId: "credential",
      userId: demoUser.id,
      password: BCRYPT_DEMO,
    },
  })

  // Long-lived session (expires 2099) — Slice 3 will load this token
  const oneHundredYears = new Date("2099-12-31T23:59:59Z")
  await prisma.session.create({
    data: {
      token: DEMO_SESSION_TOKEN,
      userId: demoUser.id,
      expiresAt: oneHundredYears,
      ipAddress: "127.0.0.1",
      userAgent: "Demo/1.0",
    },
  })

  // 2. Admin user (for approval/commission relations — separate from demo user)
  const adminUser = await prisma.user.create({
    data: {
      name: "Sistema Admin",
      email: "admin@atacama-demo.cl",
      emailVerified: true,
      role: "admin",
      mustChangePassword: false,
      banned: false,
    },
  })
  await prisma.account.create({
    data: {
      accountId: adminUser.id,
      providerId: "credential",
      userId: adminUser.id,
      password: stableHash("admin"),
    },
  })

  // 3. Sellers
  const sellerUserIds: string[] = []
  for (const name of SELLER_NAMES) {
    const email = `${name.toLowerCase().replace(/\s+/g, ".").normalize("NFD").replace(/[̀-ͯ]/g, "")}@atacama-demo.cl`
    const user = await prisma.user.create({
      data: {
        name,
        email,
        emailVerified: true,
        role: "seller",
        mustChangePassword: false,
        banned: false,
      },
    })
    await prisma.account.create({
      data: {
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: stableHash(name),
      },
    })
    sellerUserIds.push(user.id)
  }

  console.log(`    Created demo user, admin, and ${SELLER_NAMES.length} sellers.`)
  return {
    demoUserId: demoUser.id,
    adminUserId: adminUser.id,
    sellerUserIds,
  }
}
