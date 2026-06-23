import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"
import { admin, twoFactor } from "better-auth/plugins"
import { betterAuth } from "better-auth"

import { prisma } from "./prisma"
import { COMPANY_INFO } from "./company-info"

export const auth = betterAuth({
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),
	baseURL: process.env.NEXT_PUBLIC_BASE_URL,
	rateLimit: {
		enabled: process.env.DISABLE_RATE_LIMIT !== "1",
	},
	emailAndPassword: {
		enabled: true,
	},
	user: {
		additionalFields: {
			mustChangePassword: {
				type: "boolean",
				required: false,
				defaultValue: false,
				input: false,
			},
		},
	},
	plugins: [admin(), twoFactor({ issuer: COMPANY_INFO.name }), nextCookies()],
})

export type Session = typeof auth.$Infer.Session
