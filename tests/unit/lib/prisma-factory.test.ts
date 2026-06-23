/**
 * Spec: DEMO_MODE Toggle Isolation — factory branch isolation
 *
 * Verifies that the prisma singleton picks the correct adapter depending on
 * the DEMO_MODE environment variable WITHOUT actually connecting to any DB.
 *
 * Strategy: mock both adapter constructors so they are cheap no-ops and just
 * check which one was called. The real PGlite / pg adapter are never invoked.
 */

import { describe, it, expect, vi, afterEach } from "vitest"

afterEach(() => {
  vi.resetModules()
  vi.restoreAllMocks()
  delete process.env.DEMO_MODE
  // Reset the global singleton
  const g = global as unknown as Record<string, unknown>
  delete g.prisma
})

describe("createPrismaClient() factory — adapter branch isolation", () => {
  it("uses PrismaPg (production adapter) when DEMO_MODE is absent", async () => {
    delete process.env.DEMO_MODE

    let pgAdapterConstructorCalled = false
    let pgliteConstructorCalled = false

    function MockPrismaPg(this: unknown) { pgAdapterConstructorCalled = true }
    function MockPrismaPGlite(this: unknown) { /* noop */ }
    function MockPGlite(this: unknown) { pgliteConstructorCalled = true }
    function MockPrismaClient(this: unknown) { /* noop */ }

    vi.doMock("@prisma/adapter-pg", () => ({ PrismaPg: MockPrismaPg }))
    vi.doMock("pglite-prisma-adapter", () => ({ PrismaPGlite: MockPrismaPGlite }))
    vi.doMock("@electric-sql/pglite", () => ({ PGlite: MockPGlite }))
    vi.doMock("@/generated/prisma/client", () => ({ PrismaClient: MockPrismaClient }))
    vi.doMock("node:fs", () => ({ default: { readFileSync: () => Buffer.from("snap") }, readFileSync: () => Buffer.from("snap") }))
    vi.doMock("node:path", () => ({ default: { join: () => "/x/snapshot.tgz" }, join: () => "/x/snapshot.tgz" }))

    await import("@/lib/prisma")

    expect(pgAdapterConstructorCalled).toBe(true)
    expect(pgliteConstructorCalled).toBe(false)
  })

  it("uses PrismaPg when DEMO_MODE is \"false\"", async () => {
    process.env.DEMO_MODE = "false"

    let pgAdapterConstructorCalled = false
    let pgliteConstructorCalled = false

    function MockPrismaPg(this: unknown) { pgAdapterConstructorCalled = true }
    function MockPrismaPGlite(this: unknown) { /* noop */ }
    function MockPGlite(this: unknown) { pgliteConstructorCalled = true }
    function MockPrismaClient(this: unknown) { /* noop */ }

    vi.doMock("@prisma/adapter-pg", () => ({ PrismaPg: MockPrismaPg }))
    vi.doMock("pglite-prisma-adapter", () => ({ PrismaPGlite: MockPrismaPGlite }))
    vi.doMock("@electric-sql/pglite", () => ({ PGlite: MockPGlite }))
    vi.doMock("@/generated/prisma/client", () => ({ PrismaClient: MockPrismaClient }))
    vi.doMock("node:fs", () => ({ default: { readFileSync: () => Buffer.from("snap") }, readFileSync: () => Buffer.from("snap") }))
    vi.doMock("node:path", () => ({ default: { join: () => "/x/snapshot.tgz" }, join: () => "/x/snapshot.tgz" }))

    await import("@/lib/prisma")

    expect(pgAdapterConstructorCalled).toBe(true)
    expect(pgliteConstructorCalled).toBe(false)
  })

  it("uses PrismaPGlite with loadDataDir from snapshot when DEMO_MODE is \"true\"", async () => {
    process.env.DEMO_MODE = "true"

    let pgliteConstructorCalled = false
    let pgliteLoadDataDir: unknown = undefined
    let pgAdapterConstructorCalled = false
    let fsReadFileSyncCalled = false

    function MockPGlite(this: unknown, opts?: { loadDataDir?: unknown }) {
      pgliteConstructorCalled = true
      pgliteLoadDataDir = opts?.loadDataDir
    }
    function MockPrismaPGlite(this: unknown) { /* noop */ }
    function MockPrismaPg(this: unknown) { pgAdapterConstructorCalled = true }
    function MockPrismaClient(this: unknown) { /* noop */ }

    const snapshotBuffer = Buffer.from("fake-snapshot-content")

    vi.doMock("@electric-sql/pglite", () => ({ PGlite: MockPGlite }))
    vi.doMock("pglite-prisma-adapter", () => ({ PrismaPGlite: MockPrismaPGlite }))
    vi.doMock("@prisma/adapter-pg", () => ({ PrismaPg: MockPrismaPg }))
    vi.doMock("@/generated/prisma/client", () => ({ PrismaClient: MockPrismaClient }))
    vi.doMock("node:fs", () => ({
      default: {
        readFileSync: (p: string) => { fsReadFileSyncCalled = true; return snapshotBuffer },
      },
      readFileSync: (p: string) => { fsReadFileSyncCalled = true; return snapshotBuffer },
    }))
    vi.doMock("node:path", () => ({
      default: { join: (...args: string[]) => args.join("/") },
      join: (...args: string[]) => args.join("/"),
    }))

    await import("@/lib/prisma")

    // Must use PrismaPGlite, not PrismaPg
    expect(pgAdapterConstructorCalled).toBe(false)
    // Must have read the snapshot file
    expect(fsReadFileSyncCalled).toBe(true)
    // PGlite constructor must have been called
    expect(pgliteConstructorCalled).toBe(true)
    // PGlite must have received loadDataDir (a Blob wrapping the snapshot)
    expect(pgliteLoadDataDir).toBeInstanceOf(Blob)
  })
})
