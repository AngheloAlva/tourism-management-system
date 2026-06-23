import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

// Static imports so Turbopack includes PGlite/WASM in the build graph.
// These are top-level (not dynamic) so the bundler walks into them.
import { PGlite } from "@electric-sql/pglite"
import { PrismaPGlite } from "pglite-prisma-adapter"
import fs from "node:fs"
import path from "node:path"

const globalForPrisma = global as unknown as { prisma: PrismaClient }

/**
 * Build a PGlite instance loaded from the committed snapshot tarball.
 *
 * `new PGlite({ loadDataDir: blob })` starts loading the snapshot
 * synchronously in the constructor — internal queries await `waitReady`
 * automatically, so callers do not need to await anything here.
 *
 * This is the single source of truth for snapshot loading. Both the initial
 * singleton boot path and `reloadDemoClient()` use this helper so they stay
 * in sync with each other.
 *
 * The snapshot is bundled via `outputFileTracingIncludes` in next.config.ts
 * so it is readable from `process.cwd()` inside a deployed Vercel Function.
 */
function createPGliteFromSnapshot(): PGlite {
	const snapshotPath = path.join(process.cwd(), "prisma/demo/snapshot.tgz")
	const snapshotBuffer = fs.readFileSync(snapshotPath)
	const snapshotBlob = new Blob([snapshotBuffer])
	return new PGlite({ loadDataDir: snapshotBlob })
}

function createPrismaClient(): PrismaClient {
	if (process.env.DEMO_MODE === "true") {
		// Demo path: load the committed snapshot so queries return seeded data.
		// new PGlite({ loadDataDir }) starts the load in the constructor;
		// internal operations await the built-in waitReady promise automatically.
		const pglite = createPGliteFromSnapshot()
		const adapter = new PrismaPGlite(pglite)
		return new PrismaClient({ adapter })
	}

	// Production path: Neon PostgreSQL via @prisma/adapter-pg
	const adapter = new PrismaPg({
		connectionString: process.env.DATABASE_URL,
	})
	return new PrismaClient({ adapter })
}

/**
 * Reload the PGlite client from the bundled snapshot. Used by `resetDemo()`.
 * Only safe to call when DEMO_MODE === "true".
 */
export async function reloadDemoClient(): Promise<PrismaClient> {
	const pglite = createPGliteFromSnapshot()
	const adapter = new PrismaPGlite(pglite)
	return new PrismaClient({ adapter })
}

const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

export { prisma }
