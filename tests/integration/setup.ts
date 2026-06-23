import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql"
import { execSync } from "node:child_process"

let container: StartedPostgreSqlContainer

export async function setup(): Promise<void> {
  container = await new PostgreSqlContainer("postgres:16")
    .withDatabase("tct_test")
    .withUsername("test")
    .withPassword("test")
    .start()

  const url = container.getConnectionUri()
  process.env.DATABASE_URL = url

  // Apply schema. migrate deploy is safe for an empty DB and respects existing migrations.
  execSync("pnpm prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  })
}

export async function teardown(): Promise<void> {
  await container?.stop()
}
