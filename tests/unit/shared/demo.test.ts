import { describe, it, expect, afterEach, vi } from "vitest"

describe("IS_DEMO flag", () => {
  afterEach(() => {
    vi.resetModules()
    delete process.env.DEMO_MODE
  })

  it('is true when DEMO_MODE equals the string "true"', async () => {
    process.env.DEMO_MODE = "true"
    const { IS_DEMO } = await import("@/lib/demo")
    expect(IS_DEMO).toBe(true)
  })

  it("is false when DEMO_MODE is absent", async () => {
    delete process.env.DEMO_MODE
    const { IS_DEMO } = await import("@/lib/demo")
    expect(IS_DEMO).toBe(false)
  })

  it('is false when DEMO_MODE is "false"', async () => {
    process.env.DEMO_MODE = "false"
    const { IS_DEMO } = await import("@/lib/demo")
    expect(IS_DEMO).toBe(false)
  })

  it('is false when DEMO_MODE is "1"', async () => {
    process.env.DEMO_MODE = "1"
    const { IS_DEMO } = await import("@/lib/demo")
    expect(IS_DEMO).toBe(false)
  })

  it('is false when DEMO_MODE is "TRUE" (case-sensitive)', async () => {
    process.env.DEMO_MODE = "TRUE"
    const { IS_DEMO } = await import("@/lib/demo")
    expect(IS_DEMO).toBe(false)
  })
})
