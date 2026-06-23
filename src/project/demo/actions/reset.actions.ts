"use server"

import { IS_DEMO } from "@/lib/demo"

interface ResetDemoResult {
	success: boolean
	error?: string
}

/**
 * Resets the PGlite in-memory database to the seeded baseline by reloading
 * the committed snapshot. Only available in demo mode.
 *
 * The reset works by clearing the global singleton and re-creating the
 * PrismaClient from the snapshot — the next request will get a fresh instance.
 * This only affects the current warm Function instance.
 */
export async function resetDemo(): Promise<ResetDemoResult> {
	if (!IS_DEMO) {
		return { success: false, error: "Reset is only available in demo mode" }
	}

	try {
		// Clear the global singleton so the next access re-creates from snapshot
		const g = global as unknown as Record<string, unknown>
		g.prisma = undefined

		// Eagerly reload the snapshot so the new client is ready immediately
		const { reloadDemoClient } = await import("@/lib/prisma")
		const freshClient = await reloadDemoClient()
		g.prisma = freshClient

		return { success: true }
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err)
		return { success: false, error: `Reset failed: ${message}` }
	}
}
