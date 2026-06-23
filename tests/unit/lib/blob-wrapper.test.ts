/**
 * Spec: "File upload is intercepted in demo mode"
 *
 * Asserts that `uploadBlob()` returns a fake URL (no-op) in demo mode,
 * and delegates to the real `put()` in production mode.
 */

import { describe, it, expect, afterEach, vi } from "vitest"

const mockPut = vi.fn().mockResolvedValue({
  url: "https://real-blob.vercel.app/file.pdf",
  pathname: "file.pdf",
})

vi.mock("@vercel/blob", () => ({
  put: mockPut,
}))

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  delete process.env.DEMO_MODE
})

describe("uploadBlob() wrapper", () => {
  it("returns a demo placeholder URL without calling put() when DEMO_MODE is \"true\"", async () => {
    process.env.DEMO_MODE = "true"
    const { uploadBlob } = await import("@/lib/blob")
    const result = await uploadBlob("test/file.pdf", Buffer.from("data"), {
      contentType: "application/pdf",
    })
    expect(result.url).toContain("demo")
    expect(result.simulated).toBe(true)
    expect(mockPut).not.toHaveBeenCalled()
  })

  it("delegates to real put() when DEMO_MODE is absent", async () => {
    delete process.env.DEMO_MODE
    const { uploadBlob } = await import("@/lib/blob")
    const result = await uploadBlob("test/file.pdf", Buffer.from("data"), {
      contentType: "application/pdf",
    })
    expect(result.url).toBe("https://real-blob.vercel.app/file.pdf")
    expect(result.simulated).toBeUndefined()
    expect(mockPut).toHaveBeenCalledOnce()
  })
})
