import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright E2E configuration.
 *
 * DB strategy:
 *   globalSetup starts a postgres:16 testcontainer bound to a FIXED host port (default 54320).
 *   This is required because playwright.config.ts is evaluated at startup, BEFORE globalSetup
 *   runs, so we cannot use a runtime env var for DATABASE_URL in webServer.env — it would be
 *   undefined at evaluation time.
 *
 *   By binding the container to port 54320 (via withExposedPorts in global-setup.ts),
 *   the DATABASE_URL is deterministic and can be hardcoded here.
 *   Use E2E_DB_PORT env var to override the port if 54320 is already in use.
 *
 * Why `next build --turbopack && next start` instead of `next dev`:
 *   - Production build catches compilation errors that turbopack dev mode may mask.
 *   - Server actions behave identically to production (no HMR interference).
 *   - webServer.reuseExistingServer=true when not in CI lets you skip rebuilding locally.
 *
 * Why workers: 1 / fullyParallel: false:
 *   Single shared E2E database; parallel specs would produce race conditions.
 */

const E2E_DB_PORT = process.env.E2E_DB_PORT ?? "54320"
const E2E_DATABASE_URL = `postgresql://e2e:e2e@localhost:${E2E_DB_PORT}/tct_e2e`

export default defineConfig({
  // testDir covers both specs/ and auth.setup.ts (which is one level up from specs/).
  // The setup project uses testMatch: /auth\.setup\.ts/ to select only the setup file.
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    testIdAttribute: "data-testid",
  },

  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Storage state is saved by auth.setup.ts; all chromium tests run as admin by default.
        // Specs that need a different role use test.use({ storageState }) locally.
        storageState: "tests/e2e/.auth/admin.json",
      },
      dependencies: ["setup"],
    },
  ],

  webServer: {
    command: "pnpm exec next build --turbopack && pnpm exec next start -p 3001",
    url: "http://localhost:3001",
    timeout: 420_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      BETTER_AUTH_SECRET: "e2e-test-secret-do-not-use-in-prod-min32chars",
      BETTER_AUTH_URL: "http://localhost:3001",
      BETTER_AUTH_BASE_URL: "http://localhost:3001",
      // NEXT_PUBLIC_BASE_URL is used by auth.ts as baseURL. Required to avoid
      // "Base URL could not be determined" warning which can affect cookie validation.
      NEXT_PUBLIC_BASE_URL: "http://localhost:3001",
      NODE_ENV: "test",
      // Disable Better Auth rate limiter in E2E so spec registrations don't hit 429.
      // next start forces NODE_ENV=production at runtime, so we use a dedicated env var.
      DISABLE_RATE_LIMIT: "1",
      // RESEND_API_KEY intentionally empty — canSendEmails() no-ops without it.
      RESEND_API_KEY: "",
    },
  },

  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
})
