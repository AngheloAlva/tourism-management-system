import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    // Native Vite 8+ tsconfig path resolution. Uses tsconfig.tests.json so that
    // test files get the same @/* aliases as source files without adding tests/**
    // to the main tsconfig.json (which would break `tsc --noEmit` for prod builds).
    tsconfigPaths: true,
  },
  test: {
    name: "unit",
    environment: "node",
    globals: false,
    include: ["tests/unit/**/*.test.ts"],
    exclude: ["tests/integration/**", "tests/e2e/**", "node_modules/**"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/generated/**",
        "src/components/ui/**",
        "src/app/**/layout.tsx",
        "src/app/**/page.tsx",
        "tests/**",
        "**/*.d.ts",
        "**/*.config.*",
      ],
    },
  },
})
