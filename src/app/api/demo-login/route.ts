import { NextResponse } from "next/server"

import { IS_DEMO } from "@/lib/demo"

/** Long-lived session token seeded into the PGlite snapshot (see seed/users.ts). */
const DEMO_SESSION_TOKEN = "demo-session-token-atacama-2026"
/** Better Auth session cookie name (un-prefixed: demo disables secure cookies). */
const BA_COOKIE_NAME = "better-auth.session_token"

/**
 * Reproduce better-call's signed-cookie format —
 * `${token}.${base64(HMAC-SHA256(secret, token))}` — so Better Auth's
 * getSession accepts the injected cookie. Runs in the same serverless runtime
 * as `@/lib/auth`, so it signs with the exact BETTER_AUTH_SECRET that the
 * server verifies with.
 */
async function signDemoSessionCookie(secret: string): Promise<string> {
	const encoder = new TextEncoder()
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	)
	const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(DEMO_SESSION_TOKEN))
	const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)))
	return `${DEMO_SESSION_TOKEN}.${base64Signature}`
}

export async function GET(request: Request) {
	const secret = process.env.BETTER_AUTH_SECRET

	if (!IS_DEMO || !secret) {
		return NextResponse.redirect(new URL("/", request.url))
	}

	const signed = await signDemoSessionCookie(secret)
	const response = NextResponse.redirect(new URL("/dashboard/inicio", request.url))
	response.cookies.set(BA_COOKIE_NAME, signed, {
		httpOnly: true,
		sameSite: "lax",
		path: "/",
		// Max-age: 1 year (the seeded session itself expires 2099).
		maxAge: 60 * 60 * 24 * 365,
	})
	return response
}
