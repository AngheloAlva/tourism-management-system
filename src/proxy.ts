import { NextRequest, NextResponse } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

import { IS_DEMO } from "@/lib/demo"

/** Long-lived session token seeded into the PGlite snapshot (see seed/users.ts). */
const DEMO_SESSION_TOKEN = "demo-session-token-atacama-2026"
/** Better Auth session cookie name (un-prefixed: demo disables secure cookies). */
const BA_COOKIE_NAME = "better-auth.session_token"

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl
	const isProtected = pathname.startsWith("/dashboard") || pathname === "/cambiar-contrasena"

	const requestHeaders = new Headers(request.headers)
	requestHeaders.set("x-pathname", pathname)

	// ── Demo: transparent auto-login ─────────────────────────────────────────
	// Inject the pre-seeded session cookie here. Middleware/proxy is allowed to
	// set cookies (a layout is NOT — that throws "Cookies can only be modified
	// in a Server Action or Route Handler"). We add it to the forwarded request
	// headers so this SAME render resolves the session, and to the response so
	// the browser persists it for later requests.
	if (IS_DEMO) {
		if (isProtected && !request.cookies.get(BA_COOKIE_NAME)) {
			const injected = `${BA_COOKIE_NAME}=${DEMO_SESSION_TOKEN}`
			const existing = requestHeaders.get("cookie")
			requestHeaders.set("cookie", existing ? `${existing}; ${injected}` : injected)

			const response = NextResponse.next({ request: { headers: requestHeaders } })
			response.cookies.set(BA_COOKIE_NAME, DEMO_SESSION_TOKEN, {
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
