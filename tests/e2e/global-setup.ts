import { FullConfig } from "@playwright/test"
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql"
import { execSync } from "node:child_process"
import { writeFileSync } from "node:fs"
import { join } from "node:path"

/**
 * Playwright globalSetup: starts a dedicated postgres:16 testcontainer for E2E tests.
 *
 * Why a separate container from the integration harness?
 *   - Integration tests (Vitest) and E2E tests (Playwright) run in different Node processes.
 *   - They MUST NOT share state: integration tests truncate+reset aggressively; E2E tests
 *     need stable seed data across the whole suite run.
 *   - Two containers → clean isolation boundary.
 *
 * Why not docker-compose?
 *   - Would require contributors to run `docker compose up` manually before tests.
 *   - testcontainers starts/stops automatically, same as the integration setup — consistent DX.
 *
 * Why write to a state file instead of just process.env?
 *   - globalTeardown runs in a separate process context and cannot read variables set here.
 *   - The state file (JSON) is the cross-process communication channel.
 *   - We also set process.env.E2E_DATABASE_URL here; playwright.config.ts reads it for
 *     webServer.env, which Playwright evaluates after globalSetup completes.
 */

// State file path — read by global-teardown.ts to stop the container.
const STATE_FILE = join(process.cwd(), "tests/e2e/.db-state.json")

let container: StartedPostgreSqlContainer

export default async function globalSetup(_config: FullConfig): Promise<void> {
  console.log("\n[e2e-setup] Starting E2E postgres:16 testcontainer...")

  // Port 54320 is reserved for E2E tests. If it's in use, tear down first or
  // set E2E_DB_PORT to a different port before running.
  const E2E_DB_PORT = parseInt(process.env.E2E_DB_PORT ?? "54320", 10)

  container = await new PostgreSqlContainer("postgres:16")
    .withDatabase("tct_e2e")
    .withUsername("e2e")
    .withPassword("e2e")
    .withExposedPorts({ container: 5432, host: E2E_DB_PORT })
    .withTmpFs({ "/var/lib/postgresql/data": "rw,noexec,nosuid,size=512m" })
    .start()

  const connectionUri = container.getConnectionUri()
  console.log(`[e2e-setup] Container started on port ${E2E_DB_PORT}. Running migrations...`)

  // Set E2E_DATABASE_URL for use in auth.setup.ts and test specs (Prisma direct access).
  // Note: webServer.env.DATABASE_URL in playwright.config.ts is already hardcoded to the
  // same fixed-port URL, so the Next.js server connects correctly without needing this env var.
  process.env.E2E_DATABASE_URL = connectionUri

  // Apply schema migrations to the E2E database.
  execSync("pnpm prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: connectionUri },
  })

  // Also ensure the Prisma client is generated (may already be done, but safe to repeat).
  // Pass DATABASE_URL explicitly — prisma.config.ts reads it via PrismaConfigEnv and CI
  // does not inject it into the e2e job env.
  execSync("pnpm prisma generate", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: connectionUri },
  })

  // Persist container ID and connection info so globalTeardown can stop it.
  writeFileSync(
    STATE_FILE,
    JSON.stringify({
      containerId: container.getId(),
      connectionUri,
    }),
  )

  console.log("[e2e-setup] E2E database ready.")
}
