import { FullConfig } from "@playwright/test"
import { readFileSync, unlinkSync, existsSync } from "node:fs"
import { join } from "node:path"

/**
 * Playwright globalTeardown: stops the E2E postgres testcontainer.
 *
 * Reads the container ID from the state file written by global-setup.ts.
 * Runs in a separate process, so we use testcontainers' GenericContainer.fromExistingId
 * to get a handle on the running container.
 */

const STATE_FILE = join(process.cwd(), "tests/e2e/.db-state.json")

export default async function globalTeardown(_config: FullConfig): Promise<void> {
  if (!existsSync(STATE_FILE)) {
    console.log("[e2e-teardown] No state file found — container may have already been stopped.")
    return
  }

  const state = JSON.parse(readFileSync(STATE_FILE, "utf-8")) as {
    containerId: string
    connectionUri: string
  }

  try {
    // Use dockerode directly to stop the container by ID.
    // testcontainers doesn't expose a clean "stop by ID" without re-starting the container,
    // so we shell out to docker stop which is always available when testcontainers works.
    const { execSync } = await import("node:child_process")
    execSync(`docker stop ${state.containerId}`, { stdio: "pipe" })
    console.log(`[e2e-teardown] Container ${state.containerId.slice(0, 12)} stopped.`)
  } catch (err) {
    console.warn("[e2e-teardown] Could not stop container:", err)
  }

  try {
    unlinkSync(STATE_FILE)
  } catch {
    // Ignore — cleanup is best-effort
  }
}
