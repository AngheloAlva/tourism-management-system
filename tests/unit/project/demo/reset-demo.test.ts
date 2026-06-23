/**
 * Spec: "Reset is unavailable in production"
 *       "Reset reloads snapshot in demo mode (unit-level gate)"
 *
 * Unit test only: confirms the IS_DEMO gate rejects in production mode,
 * and confirms the function returns success in demo mode.
 * Actual PGlite snapshot reload is integration/E2E scope.
 */

import { describe, it, expect, afterEach, vi } from "vitest"

// Mock reloadDemoClient so we don't need real fs/PGlite in unit tests
const mockReloadDemoClient = vi.fn().mockResolvedValue({ __type: "prisma-client" })

vi.mock("@/lib/prisma", () => ({
  prisma: { $disconnect: vi.fn() },
  reloadDemoClient: mockReloadDemoClient,
}))

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  delete process.env.DEMO_MODE
})

describe("resetDemo() gate", () => {
  it("returns an error result when DEMO_MODE is absent", async () => {
    delete process.env.DEMO_MODE
    const { resetDemo } = await import(
      "@/project/demo/actions/reset.actions"
    )
    const result = await resetDemo()
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it("returns a success result when DEMO_MODE is \"true\"", async () => {
    process.env.DEMO_MODE = "true"
    const { resetDemo } = await import(
      "@/project/demo/actions/reset.actions"
    )
    const result = await resetDemo()
    expect(result.success).toBe(true)
    expect(mockReloadDemoClient).toHaveBeenCalled()
  })
})
