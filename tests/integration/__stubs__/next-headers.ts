/**
 * Stub for next/headers — used via Vite resolve.alias in integration tests.
 * The real next/headers only works inside a Next.js request context.
 * vi.mock("next/headers") in vitest.setup.integration.ts overrides this for test files,
 * but third-party packages (e.g. better-auth's nextCookies plugin) use dynamic import()
 * which bypasses vi.mock. This stub provides a safe no-op fallback.
 */

export async function headers(): Promise<Headers> {
  return new Headers()
}

export async function cookies(): Promise<{
  get: (name: string) => { value: string } | undefined
  set: () => void
  delete: () => void
  has: (name: string) => boolean
  getAll: () => Array<{ name: string; value: string }>
}> {
  return {
    get: () => undefined,
    set: () => {},
    delete: () => {},
    has: () => false,
    getAll: () => [],
  }
}
