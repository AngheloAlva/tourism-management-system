/**
 * Spec: "Company info returns fictional brand in demo mode"
 *      "Company info returns real brand in production mode"
 */

import { describe, it, expect, afterEach, vi } from "vitest"

afterEach(() => {
  vi.resetModules()
  delete process.env.DEMO_MODE
})

describe("COMPANY_INFO brand switching", () => {
  it("returns the real production brand when DEMO_MODE is absent", async () => {
    delete process.env.DEMO_MODE
    const { COMPANY_INFO } = await import("@/lib/company-info")
    expect(COMPANY_INFO.name).toBe("TurismoChileTours")
    expect(COMPANY_INFO.name).not.toMatch(/Atacama Demo/i)
  })

  it("returns the fictional brand when DEMO_MODE is \"true\"", async () => {
    process.env.DEMO_MODE = "true"
    const { COMPANY_INFO } = await import("@/lib/company-info")
    expect(COMPANY_INFO.name).not.toBe("TurismoChileTours")
    expect(COMPANY_INFO.name).toMatch(/Atacama/i)
  })

  it("returns fictional email domain under demo mode", async () => {
    process.env.DEMO_MODE = "true"
    const { COMPANY_INFO } = await import("@/lib/company-info")
    expect(COMPANY_INFO.email).not.toMatch(/turismochiletours\.cl/)
    expect(COMPANY_INFO.email).toMatch(/atacama-demo\.cl/)
  })

  it("returns real email domain when DEMO_MODE is absent", async () => {
    delete process.env.DEMO_MODE
    const { COMPANY_INFO } = await import("@/lib/company-info")
    expect(COMPANY_INFO.email).toMatch(/turismochiletours\.cl/)
  })
})
