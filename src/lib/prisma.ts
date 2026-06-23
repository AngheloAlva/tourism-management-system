import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

// WIP: static imports so Turbopack includes PGlite/WASM in the build graph.
// These are top-level (not dynamic) so the bundler walks into them.
import { PGlite } from "@electric-sql/pglite"
import { PrismaPGlite } from "pglite-prisma-adapter"

const globalForPrisma = global as unknown as { prisma: PrismaClient }

function createPrismaClient(): PrismaClient {
	if (process.env.DEMO_MODE === "true") {
		// Demo path: in-memory PGlite instance (no real DB needed).
		// Snapshot wiring goes here later — for now just in-memory.
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

const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

export { prisma }
