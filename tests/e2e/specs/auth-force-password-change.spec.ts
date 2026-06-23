/**
 * E2E spec: force-password-change on first login.
 *
 * Covers the `force-change-password-first-login` SDD change:
 *   - A user with mustChangePassword=true is blocked from /dashboard/*.
 *   - After login, they are redirected to /cambiar-contrasena instead of /dashboard/inicio.
 *   - Filling in valid current + new passwords and submitting clears the flag.
 *   - After successful change they land on /dashboard/inicio.
 *   - mustChangePassword is false in the database post-change.
 *   - A user with mustChangePassword=false navigates the dashboard freely.
 *   - Navigating to /cambiar-contrasena when mustChangePassword=false redirects away.
 *   - Unauthenticated access to /cambiar-contrasena redirects to /.
 *
 * Selector strategy:
 *   The login form (login-form.tsx) uses name="email" / name="password" attributes.
 *   The change-password form (change-password-form.tsx) uses name="currentPassword" /
 *   name="newPassword" / name="confirmPassword".
 *   No data-testid attributes exist yet — selectors use input[name] as fallback.
 *   TODO (PR6): add data-testid to form inputs and replace selectors here.
 *
 * DB seeding:
 *   User registration goes through the Better Auth HTTP API (POST /api/auth/sign-up/email).
 *   Role and mustChangePassword updates go directly through Prisma (no Next.js deps).
 *   This avoids importing @/lib/auth which includes nextCookies() — a Next.js-runtime-only plugin.
 *
 * Test isolation:
 *   Two users are seeded:
 *   1. FORCED_USER — has mustChangePassword=true, used for redirect/change tests.
 *   2. NORMAL_USER — has mustChangePassword=false, used for dashboard-access and
 *      reverse-guard tests (no dependency on prior test state).
 */

// Ensure DATABASE_URL points to the E2E container before importing prisma.
// Uses the same fixed-port URL as playwright.config.ts (deterministic, set by global-setup.ts).
const E2E_DB_PORT = process.env.E2E_DB_PORT ?? "54320"
process.env.DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? `postgresql://e2e:e2e@localhost:${E2E_DB_PORT}/tct_e2e`

import { test, expect } from "@playwright/test"
import { prisma } from "@/lib/prisma"
import { AuthPage } from "../pages/auth-page"

// This spec does NOT use the shared admin storageState — sign in fresh to observe redirects.
test.use({ storageState: { cookies: [], origins: [] } })

const BASE_URL = "http://localhost:3001"

// Unique per run to avoid state collisions between re-runs.
const RUN_ID = Date.now()
const FORCED_USER_EMAIL = `forced-pwd-${RUN_ID}@test.local`
const FORCED_USER_PASSWORD = "Temporal.2026"
const FORCED_USER_NEW_PASSWORD = "NewSecure1!"
const FORCED_USER_NAME = "Forced Password User"

// A second user that starts with mustChangePassword=false.
// Used for tests that verify non-forced behavior (no dependency on test 3 state).
const NORMAL_USER_EMAIL = `normal-user-${RUN_ID}@test.local`
const NORMAL_USER_PASSWORD = "NormalPass1!"
const NORMAL_USER_NAME = "Normal User"

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
    // 200 = created, 422 = already exists — both acceptable.
    if (res.ok || res.status === 422) return
    // 429 = rate limited — fail fast (rate limiter is disabled in NODE_ENV=test).
    if (res.status === 429 && attempt < retries) {
      throw new Error(`Rate limit hit for ${email} — check rateLimit config in src/lib/auth.ts`)
    }
    const text = await res.text()
    throw new Error(`Failed to register ${email}: ${res.status} ${text}`)
  }
}

test.describe("force-password-change on first login", () => {
  test.beforeAll(async () => {
    // Register the forced-change user.
    await registerUser(FORCED_USER_EMAIL, FORCED_USER_NAME, FORCED_USER_PASSWORD)
    await prisma.user.update({
      where: { email: FORCED_USER_EMAIL },
      data: { mustChangePassword: true, emailVerified: true, role: "user" },
    })

    // Register the normal user (mustChangePassword=false from the start).
    await registerUser(NORMAL_USER_EMAIL, NORMAL_USER_NAME, NORMAL_USER_PASSWORD)
    await prisma.user.update({
      where: { email: NORMAL_USER_EMAIL },
      data: { mustChangePassword: false, emailVerified: true, role: "user" },
    })

    // Disconnect Prisma to release DB connections before tests start.
    // The Next.js server uses its own Prisma connection pool; an open connection from
    // the test process is not a problem, but releasing it keeps the pool clean.
    await prisma.$disconnect()
  })

  // ─── Tests for mustChangePassword=true path ─────────────────────────────────

  test("redirects to /cambiar-contrasena after login when mustChangePassword is true", async ({
    page,
  }) => {
    const authPage = new AuthPage(page)

    await authPage.gotoLogin()
    await authPage.signIn(FORCED_USER_EMAIL, FORCED_USER_PASSWORD)

    // The login form redirects to /dashboard/inicio; dashboard layout intercepts and
    // redirects to /cambiar-contrasena because mustChangePassword=true.
    await authPage.expectOnChangePassword()
    await authPage.expectHeadingVisible("Cambiar contraseña")
  })

  test("direct navigation to /dashboard/* is blocked while mustChangePassword is true", async ({
    page,
  }) => {
    const authPage = new AuthPage(page)

    // Sign in (ends on /cambiar-contrasena as above).
    await authPage.gotoLogin()
    await authPage.signIn(FORCED_USER_EMAIL, FORCED_USER_PASSWORD)
    await authPage.expectOnChangePassword()

    // Attempt direct navigation to a dashboard route.
    await page.goto("/dashboard/registro-de-ventas")
    await page.waitForLoadState("networkidle")

    // Should be redirected back to /cambiar-contrasena.
    await expect(page).toHaveURL(/cambiar-contrasena/)
  })

  test("changing password clears flag and redirects to dashboard", async ({ page }) => {
    const authPage = new AuthPage(page)

    // Sign in → lands on /cambiar-contrasena.
    await authPage.gotoLogin()
    await authPage.signIn(FORCED_USER_EMAIL, FORCED_USER_PASSWORD)
    await authPage.expectOnChangePassword()

    // Fill the change-password form and submit.
    await authPage.setNewPassword({
      currentPassword: FORCED_USER_PASSWORD,
      newPassword: FORCED_USER_NEW_PASSWORD,
      confirmPassword: FORCED_USER_NEW_PASSWORD,
    })

    // After success, the form redirects to /dashboard/inicio.
    await authPage.expectOnDashboard()
    await expect(page).toHaveURL(/dashboard\/inicio/)

    // Verify the flag is cleared in the DB.
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: FORCED_USER_EMAIL },
    })
    expect(user.mustChangePassword).toBe(false)
  })

  // ─── Tests for mustChangePassword=false path (use admin storageState, state-independent) ─
  // These tests verify the reverse guard / normal navigation for a user with mustChangePassword=false.
  // They use the pre-authenticated admin storageState from auth.setup.ts to avoid
  // any Chromium in-process connection state that accumulates from prior sign-in tests.

  test("user with mustChangePassword=false is NOT redirected from dashboard", async ({
    browser,
  }) => {
    // Use a fresh browser context loaded with the admin's storageState.
    // The admin has mustChangePassword=false — correct fixture for this assertion.
    // We use browser.newContext() directly to explicitly load the storageState
    // rather than relying on test.use(), so this test is immune to accumulated
    // browser state from the preceding sign-in-heavy tests.
    const context = await browser.newContext({
      storageState: "tests/e2e/.auth/admin.json",
    })
    const page = await context.newPage()

    try {
      // Navigate to any dashboard route — should work without redirect.
      await page.goto("/dashboard/registro-de-ventas")
      await page.waitForLoadState("networkidle")
      await expect(page).not.toHaveURL(/cambiar-contrasena/)
    } finally {
      await context.close()
    }
  })

  test("unauthenticated access to /cambiar-contrasena redirects to /", async ({ page }) => {
    // Navigate directly without any session.
    await page.goto("/cambiar-contrasena")
    await page.waitForLoadState("networkidle")

    // The page server component redirects unauthenticated requests to /.
    await expect(page).toHaveURL("/")
  })

  test("user with mustChangePassword=false is redirected away from /cambiar-contrasena", async ({
    browser,
  }) => {
    // Use admin storageState (mustChangePassword=false) to avoid sign-in accumulation issue.
    const context = await browser.newContext({
      storageState: "tests/e2e/.auth/admin.json",
    })
    const page = await context.newPage()

    try {
      // Navigate to the change-password page directly.
      await page.goto("/cambiar-contrasena")
      await page.waitForLoadState("networkidle")

      // The page's reverse guard redirects to /dashboard/inicio when mustChangePassword=false.
      await expect(page).toHaveURL(/dashboard\/inicio/)
    } finally {
      await context.close()
    }
  })
})
