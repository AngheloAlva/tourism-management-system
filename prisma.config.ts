import { defineConfig, env } from "prisma/config"
import { config } from "dotenv"

config({ path: ".env.local" })

export default defineConfig({
	datasource: {
		url: env("DATABASE_URL"),
	},
	schema: "./prisma/schema.prisma",
	migrations: {
		path: "./prisma/migrations",
		seed: "tsx ./prisma/seed.ts",
	},
})
