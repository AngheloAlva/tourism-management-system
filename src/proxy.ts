import { NextRequest, NextResponse } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

import { IS_DEMO } from "@/lib/demo"

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl

	// Auth gate for protected areas (preserves the original behavior).
	// Skipped in demo mode: the dashboard layout performs transparent
	// auto-login by injecting the pre-seeded session cookie. If the gate ran
	// here it would bounce the first cookie-less /dashboard request back to "/",
	// which redirects to /dashboard/inicio in demo — an infinite loop.
	if (!IS_DEMO && (pathname.startsWith("/dashboard") || pathname === "/cambiar-contrasena")) {
		const sessionCookie = getSessionCookie(request)

		if (!sessionCookie) {
			return NextResponse.redirect(new URL("/", request.url))
		}
	}

	const requestHeaders = new Headers(request.headers)
	requestHeaders.set("x-pathname", pathname)

	return NextResponse.next({
		request: {
			headers: requestHeaders,
		},
	})
}

export const config = {
	// Broad matcher so maintenance mode can lock the entire app. Build assets,
	// the favicon, and the brand logo are excluded so the maintenance page
	// renders cleanly (the logo must stay reachable while locked).
	matcher: ["/((?!_next/static|_next/image|favicon.ico|full-logo).*)"],
}
