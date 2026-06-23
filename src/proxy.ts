import { NextRequest, NextResponse } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl

	// Auth gate for protected areas (preserves the original behavior).
	if (pathname.startsWith("/dashboard") || pathname === "/cambiar-contrasena") {
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
