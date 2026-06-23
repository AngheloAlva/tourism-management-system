import { NextRequest, NextResponse } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

import { IS_DEMO } from "@/lib/demo"

/** Long-lived session token seeded into the PGlite snapshot (see seed/users.ts). */
const DEMO_SESSION_TOKEN = "demo-session-token-atacama-2026"
/** Better Auth session cookie name (un-prefixed: demo disables secure cookies). */
const BA_COOKIE_NAME = "better-auth.session_token"

/**
 * Better Auth stores the session token as a SIGNED cookie, so the raw token is
 * rejected by getSession. Reproduce better-call's signed-cookie format —
 * `${token}.${base64(HMAC-SHA256(secret, token))}` — using the same
 * BETTER_AUTH_SECRET the server verifies with. The token has no "." and base64
 * has no "%", so no URL-encoding ambiguity: the raw value round-trips through
 * cookie parsing untouched.
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

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl
	const isProtected = pathname.startsWith("/dashboard") || pathname === "/cambiar-contrasena"

	const requestHeaders = new Headers(request.headers)
	requestHeaders.set("x-pathname", pathname)

	// ── Demo: transparent auto-login ─────────────────────────────────────────
	// Inject a correctly-signed session cookie here (middleware may set cookies;
	// a layout may NOT). Add it to the forwarded request headers so this SAME
	// render resolves the session (no redirect, no loop) and to the response so
	// the browser persists it for later requests.
	if (IS_DEMO) {
		const secret = process.env.BETTER_AUTH_SECRET
		if (isProtected && secret && !request.cookies.get(BA_COOKIE_NAME)) {
			const signed = await signDemoSessionCookie(secret)
			const existing = requestHeaders.get("cookie")
			requestHeaders.set(
				"cookie",
				existing ? `${existing}; ${BA_COOKIE_NAME}=${signed}` : `${BA_COOKIE_NAME}=${signed}`,
			)

			const response = NextResponse.next({ request: { headers: requestHeaders } })
			response.cookies.set(BA_COOKIE_NAME, signed, {
				httpOnly: true,
				sameSite: "lax",
				path: "/",
				// Max-age: 1 year (the seeded session itself expires 2099).
				maxAge: 60 * 60 * 24 * 365,
			})
			return response
		}

		return NextResponse.next({ request: { headers: requestHeaders } })
	}

	// ── Production: auth gate for protected areas ────────────────────────────
	if (isProtected) {
		const sessionCookie = getSessionCookie(request)

		if (!sessionCookie) {
			return NextResponse.redirect(new URL("/", request.url))
		}
	}

	return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
	// Broad matcher so maintenance mode can lock the entire app. Build assets,
	// the favicon, and the brand logo are excluded so the maintenance page
	// renders cleanly (the logo must stay reachable while locked).
	matcher: ["/((?!_next/static|_next/image|favicon.ico|full-logo).*)"],
}
