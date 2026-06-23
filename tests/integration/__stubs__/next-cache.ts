/**
 * Stub for next/cache — used via Vite resolve.alias in integration tests.
 * vi.mock("next/cache") in vitest.setup.integration.ts overrides this for test files.
 * This stub handles dynamic imports from third-party packages.
 */

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function revalidatePath(_path: string, _type?: string): void {}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function revalidateTag(_tag: string): void {}
