import { vi, beforeEach } from "vitest"
import dotenv from "dotenv"

// Loaded BEFORE any @/lib/* import. `.env.test` does NOT define DATABASE_URL final value
// (it's a placeholder); globalSetup writes the real one onto process.env.
dotenv.config({ path: ".env.test" })

// 1. next/cache — required globally, all actions call revalidatePath
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

// 2. next/headers — getAuthUser() awaits headers(); real impl throws outside Next runtime.
//    Return a real Headers instance so Better Auth can read .get() / .has().
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
  cookies: vi.fn(async () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    has: vi.fn(),
    getAll: vi.fn(() => []),
  })),
}))

// 3. @/lib/auth — hoisted controllable spy on auth.api.getSession.
//    vi.hoisted ensures the ref is defined before the mocked module is evaluated.
const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}))

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")
  return {
    ...actual,
    auth: {
      ...actual.auth,
      api: {
        ...actual.auth.api,
        getSession: mockGetSession,
        // signUpEmail is INTENTIONALLY left as the real implementation
        // so the user factory creates real User+Account rows.
      },
    },
  }
})

// Reset mocks between tests so a leaked session never bleeds into the next test.
beforeEach(() => {
  mockGetSession.mockReset()
})

// Export the controllable ref so helpers/auth.ts can configure it.
export { mockGetSession }
