/**
 * Demo snapshot builder — runs at build time (not at runtime).
 *
 * Usage: pnpm demo:snapshot
 *   (or via production:build when DEMO_MODE=true)
 *
 * What this script does:
 *   1. Guard: exits 0 when DEMO_MODE !== "true" (no-op in production builds).
 *   2. Spins up an in-memory PGlite instance.
 *   3. Applies the full Prisma schema DDL via `prisma migrate diff --script`.
 *   4. Runs the seed entry point to populate all domain data.
 *   5. Dumps the data directory as a tar.gz snapshot.
 *   6. Writes the snapshot to prisma/demo/snapshot.tgz (committed to repo).
 *
 * Runtime (Slice 3) loads the snapshot via:
 *   PGlite.create({ loadDataDir: fs.readFileSync("prisma/demo/snapshot.tgz") })
 *
 * This file is a scaffold for Slice 1 (Infra).
 * Real DDL application and seed wiring are completed in Slice 2.
 */

import { execFileSync } from "node:child_process"
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { PrismaClient } from "@generated/prisma/client"
import { PrismaPGlite } from "pglite-prisma-adapter"
import { runSeed } from "./seed/index"

const SNAPSHOT_PATH = join(process.cwd(), "prisma/demo/snapshot.tgz")

async function buildSnapshot(): Promise<void> {
  // Guard: no-op when not in demo mode
  if (process.env.DEMO_MODE !== "true") {
    console.log("DEMO_MODE is not 'true' — snapshot build skipped.")
    process.exit(0)
  }

  console.log("Building demo snapshot...")

  // Step 1: Spin up in-memory PGlite
  const pglite = new PGlite()

  // Step 2: Apply schema DDL
  // Generate SQL from the Prisma schema without needing migrations directory.
  // `prisma migrate diff --from-empty --to-schema-datamodel` produces CREATE TABLE
  // statements for the full schema.
  const ddl = execFileSync(
    "pnpm",
    [
      "prisma",
      "migrate",
      "diff",
      "--from-empty",
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--script",
    ],
    { encoding: "utf8" },
  )
  await pglite.exec(ddl)
  console.log("DDL applied.")

  // Step 3: Run seed via Prisma client backed by PGlite
  const adapter = new PrismaPGlite(pglite)
  const prisma = new PrismaClient({ adapter })
  await runSeed(prisma)
  await prisma.$disconnect()
  console.log("Seed complete.")

  // Step 4: Dump snapshot
  const blob = await pglite.dumpDataDir("tar.gz")
  const buffer = Buffer.from(await blob.arrayBuffer())
  writeFileSync(SNAPSHOT_PATH, buffer)
  console.log(`Snapshot written to ${SNAPSHOT_PATH} (${buffer.length} bytes).`)

  await pglite.close()
}

buildSnapshot().catch((err: unknown) => {
  console.error("Snapshot build failed:", err)
  process.exit(1)
})
