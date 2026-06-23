import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pglite-prisma-adapter"],
}

export default nextConfig
