import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"
import { admin, twoFactor } from "better-auth/plugins"
import { betterAuth } from "better-auth"

import { prisma } from "./prisma"
import { IS_DEMO } from "./demo"
import { COMPANY_INFO } from "./company-info"

export const auth = betterAuth({
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),
	baseURL: process.env.NEXT_PUBLIC_BASE_URL,
	advanced: {
		// Demo auto-login injects a raw, pre-seeded session cookie
		// (`better-auth.session_token`) from the dashboard layout. On HTTPS
		// Better Auth would prefix the cookie with `__Secure-`, so the injected
		// name would never resolve and the dashboard would loop. Disabling
		// secure cookies in demo keeps the un-prefixed name consistent.
		// Production keeps Better Auth's default (auto-secure on HTTPS).
		useSecureCookies: IS_DEMO ? false : undefined,
	},
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
