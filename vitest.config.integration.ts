import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: {
    // Native Vite 8+ tsconfig path resolution. Uses tsconfig.tests.json so that
    // test files get the same @/* aliases as source files without adding tests/**
    // to the main tsconfig.json (which would break `tsc --noEmit` for prod builds).
    tsconfigPaths: true,
    alias: {
      // next/headers and next/cache are Next.js runtime modules that don't exist in Node.
      // The alias points them to stubs so Vite/Vitest resolves them without errors.
      // This covers both static imports in test files and vi.mock() replacements.
      "next/headers": path.resolve("./tests/integration/__stubs__/next-headers.ts"),
      "next/cache": path.resolve("./tests/integration/__stubs__/next-cache.ts"),
    },
  },
  test: {
    server: {
      deps: {
        // Inline better-auth so Vite processes its dynamic imports and our resolve.alias
        // applies to import("next/headers") inside nextCookies plugin.
        inline: ["better-auth"],
      },
    },
    name: "integration",
    environment: "node",
    include: [
      "tests/integration/project/**/*.test.ts",
      "tests/integration/migrations/**/*.test.ts",
    ],
    exclude: ["tests/unit/**", "tests/e2e/**"],
    globalSetup: ["./tests/integration/setup.ts"],
    setupFiles: ["./vitest.setup.integration.ts"],
    pool: "forks",
    // singleFork: one container, all tests share it. Avoids Prisma singleton across workers.
    // poolOptions was renamed to top-level in Vitest 4 — using forkOptions directly.
    forks: { singleFork: true },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    teardownTimeout: 30_000,
    fileParallelism: false,
  },
})
