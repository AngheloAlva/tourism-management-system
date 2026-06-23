import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pglite-prisma-adapter"],
  // Bundle the PGlite snapshot into the Vercel Function so it is readable from
  // `process.cwd()` at runtime. Without this, Next.js output file tracing
  // would not copy the .tgz into the serverless bundle.
  outputFileTracingIncludes: {
    // Apply to all routes — the snapshot is only read when DEMO_MODE=true but
    // must be present in the bundle when the flag is enabled on Vercel.
    "/**": ["./prisma/demo/snapshot.tgz"],
  },
}

export default nextConfig
