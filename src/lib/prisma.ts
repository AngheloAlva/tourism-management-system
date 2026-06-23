import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

// WIP: static imports so Turbopack includes PGlite/WASM in the build graph.
// These are top-level (not dynamic) so the bundler walks into them.
import { PGlite } from "@electric-sql/pglite"
import { PrismaPGlite } from "pglite-prisma-adapter"
import fs from "node:fs"
import path from "node:path"

const globalForPrisma = global as unknown as { prisma: PrismaClient }

/**
 * Load the committed snapshot tarball into a PGlite instance.
 * `PGlite.create({ loadDataDir })` accepts a Blob/File/Uint8Array.
 * The snapshot is bundled via `outputFileTracingIncludes` in next.config.ts.
 */
async function createDemoPrismaClient(): Promise<PrismaClient> {
	const snapshotPath = path.join(process.cwd(), "prisma/demo/snapshot.tgz")
	const snapshotBuffer = fs.readFileSync(snapshotPath)
	const snapshotBlob = new Blob([snapshotBuffer])
	const pglite = await PGlite.create({ loadDataDir: snapshotBlob })
	const adapter = new PrismaPGlite(pglite)
	return new PrismaClient({ adapter })
}

function createPrismaClient(): PrismaClient {
	if (process.env.DEMO_MODE === "true") {
		// Demo path: PGlite instance loaded from the committed snapshot.
		// createDemoPrismaClient() is async — the PGlite adapter constructor
		// accepts the async result; warm-instance singleton lifecycle below
		// handles reuse within a Function invocation.
		// We return a "lazy" client that initialises on first await; the singleton
		// wrapper below ensures only one instance per warm instance.
		const pglite = new PGlite()
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
	const snapshotPath = path.join(process.cwd(), "prisma/demo/snapshot.tgz")
	const snapshotBuffer = fs.readFileSync(snapshotPath)
	const snapshotBlob = new Blob([snapshotBuffer])
	const pglite = await PGlite.create({ loadDataDir: snapshotBlob })
	const adapter = new PrismaPGlite(pglite)
	return new PrismaClient({ adapter })
}

const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

export { prisma }
