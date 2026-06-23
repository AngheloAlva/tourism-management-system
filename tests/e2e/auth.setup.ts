/**
 * Playwright "setup" project — runs before all chromium specs.
 *
 * Seeds an admin user and a regular user in the E2E database, signs in via the browser UI,
 * and saves the resulting storage state (cookies) to disk.
 *
 * Why HTTP calls for user creation instead of direct auth import?
 *   The production auth object (`@/lib/auth`) includes the `nextCookies()` Better Auth plugin,
 *   which calls `import("next/headers")` at module-load time. This only works inside the
 *   Next.js server runtime — importing it in a plain Node process (like this Playwright setup)
 *   throws: "Cannot find module 'next/headers'".
 *
 *   Solution: use Better Auth's HTTP API (POST /api/auth/sign-up/email) which runs in the
 *   Next.js context (via the webServer already started by Playwright), and use the Prisma
 *   client directly (no Next.js deps) for role + flag updates.
 *
 * IMPORTANT: This file runs in the Playwright runner process, which already has
 * process.env.E2E_DATABASE_URL set by global-setup.ts. We copy it to DATABASE_URL
 * so that @/lib/prisma connects to the E2E container, not Neon production.
 */

// Must happen BEFORE any @/lib/* import — prisma singleton reads DATABASE_URL at init.
// Use the same fixed-port URL that playwright.config.ts hardcodes for the webServer.
const E2E_DB_PORT = process.env.E2E_DB_PORT ?? "54320"
process.env.DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? `postgresql://e2e:e2e@localhost:${E2E_DB_PORT}/tct_e2e`

import { test as setup, expect } from "@playwright/test"
import path from "node:path"
import fs from "node:fs"

import { prisma } from "@/lib/prisma"

const AUTH_DIR = path.join(process.cwd(), "tests/e2e/.auth")
const ADMIN_AUTH = path.join(AUTH_DIR, "admin.json")
const USER_AUTH = path.join(AUTH_DIR, "user.json")
const OPERADORA_AUTH = path.join(AUTH_DIR, "operadora.json")

if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true })
}

export const ADMIN_EMAIL = "e2e-admin@test.local"
export const ADMIN_PASSWORD = "AdminPass1!"
export const ADMIN_NAME = "E2E Admin"

export const E2E_USER_EMAIL = "e2e-user@test.local"
export const E2E_USER_PASSWORD = "UserPass1!"
export const E2E_USER_NAME = "E2E User"

export const OPERADORA_EMAIL = "e2e-operadora@test.local"
export const OPERADORA_PASSWORD = "OperPass1!"
export const OPERADORA_NAME = "E2E Operadora"

const BASE_URL = "http://localhost:3001"

/**
 * Registers a user via the Better Auth HTTP API (runs in the Next.js server context).
 * Idempotent: if the user already exists, the sign-up will return an error which we ignore.
 */
async function registerUser(
  email: string,
  name: string,
  password: string,
  retries = 3,
): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Better Auth requires a non-null Origin header for CSRF protection.
        Origin: BASE_URL,
      },
      body: JSON.stringify({ email, name, password }),
    })
    // 200 = created, 422 = already exists (user already seeded) — both acceptable.
    if (res.ok || res.status === 422) return
    // 429 = rate limited — fail fast (rate limiter is disabled in NODE_ENV=test).
    if (res.status === 429 && attempt < retries) {
      throw new Error(`Rate limit hit for ${email} — check rateLimit config in src/lib/auth.ts`)
    }
    const text = await res.text()
    throw new Error(`Failed to register ${email}: ${res.status} ${text}`)
  }
}

setup("authenticate as admin", async ({ page }) => {
  await registerUser(ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD)

  // Patch via prisma: set role=admin, mustChangePassword=false, emailVerified=true.
  await prisma.user.update({
    where: { email: ADMIN_EMAIL },
    data: { role: "admin", mustChangePassword: false, emailVerified: true },
  })

  await page.goto("/")
  await page.waitForLoadState("networkidle")

  // TODO (PR6): replace with getByTestId("auth-input-email") etc. once data-testid attrs are added.
  await page.locator('input[name="email"]').fill(ADMIN_EMAIL)
  await page.locator('input[name="password"]').fill(ADMIN_PASSWORD)
  await page.locator('button[type="submit"]').click()

  // Admin has mustChangePassword=false → redirects to /dashboard/inicio.
  await page.waitForURL("**/dashboard/**", { timeout: 30_000 })

  await page.context().storageState({ path: ADMIN_AUTH })
})

setup("authenticate as regular user", async ({ page }) => {
  await registerUser(E2E_USER_EMAIL, E2E_USER_NAME, E2E_USER_PASSWORD)

  // Regular user: no forced password change for the base session.
  await prisma.user.update({
    where: { email: E2E_USER_EMAIL },
    data: { role: "user", mustChangePassword: false, emailVerified: true },
  })

  await page.goto("/")
  await page.waitForLoadState("networkidle")

  await page.locator('input[name="email"]').fill(E2E_USER_EMAIL)
  await page.locator('input[name="password"]').fill(E2E_USER_PASSWORD)
  await page.locator('button[type="submit"]').click()

  await page.waitForURL("**/dashboard/**", { timeout: 30_000 })

  await page.context().storageState({ path: USER_AUTH })
})

setup("authenticate as operadora", async ({ page }) => {
  await registerUser(OPERADORA_EMAIL, OPERADORA_NAME, OPERADORA_PASSWORD)

  // Operadora role: canInteract=true for sales/quotes/receptions/calendar modules.
  // Setting role="operadora" causes getCurrentUserAccess to load the operadora
  // system role from the DB, which has canInteract=true for all OPERADORA_VISIBLE_MODULES.
  await prisma.user.update({
    where: { email: OPERADORA_EMAIL },
    data: { role: "operadora", mustChangePassword: false, emailVerified: true },
  })

  await page.goto("/")
  await page.waitForLoadState("networkidle")

  await page.locator('input[name="email"]').fill(OPERADORA_EMAIL)
  await page.locator('input[name="password"]').fill(OPERADORA_PASSWORD)
  await page.locator('button[type="submit"]').click()

  await page.waitForURL("**/dashboard/**", { timeout: 30_000 })

  await page.context().storageState({ path: OPERADORA_AUTH })
})
