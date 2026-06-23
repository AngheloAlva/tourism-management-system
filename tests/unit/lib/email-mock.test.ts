/**
 * Spec: "Email send is intercepted in demo mode"
 *
 * Asserts that `canSendEmails()` returns false and `resendClient` is null
 * when DEMO_MODE is active, even if RESEND_API_KEY is set.
 */

import { describe, it, expect, afterEach, vi } from "vitest"

afterEach(() => {
  vi.resetModules()
  delete process.env.DEMO_MODE
  delete process.env.RESEND_API_KEY
})

describe("Email mock — demo mode", () => {
  it("canSendEmails() is false when DEMO_MODE is \"true\", regardless of API key", async () => {
    process.env.DEMO_MODE = "true"
    process.env.RESEND_API_KEY = "re_test_key"
    // When IS_DEMO=true, Resend constructor is never called — no mock needed
    const { canSendEmails, resendClient } = await import("@/lib/email/resend")
    expect(canSendEmails()).toBe(false)
    expect(resendClient).toBeNull()
  })

  it("canSendEmails() is false in production mode when no API key", async () => {
    delete process.env.DEMO_MODE
    delete process.env.RESEND_API_KEY
    // When no API key, Resend constructor is not called — no mock needed
    const { canSendEmails } = await import("@/lib/email/resend")
    expect(canSendEmails()).toBe(false)
  })

  it("resendClient is non-null when DEMO_MODE is absent and API key is present", async () => {
    delete process.env.DEMO_MODE
    process.env.RESEND_API_KEY = "re_test_key"
    // Need to mock Resend here before importing
    vi.doMock("resend", () => {
      function MockResend() { return { emails: { send: vi.fn() } } }
      return { Resend: MockResend }
    })
    const { canSendEmails, resendClient } = await import("@/lib/email/resend")
    expect(canSendEmails()).toBe(true)
    expect(resendClient).not.toBeNull()
  })
})
