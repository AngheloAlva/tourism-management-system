import { NextRequest, NextResponse } from "next/server"

/**
 * Auth gate for protected areas. Checks for the presence of a Better Auth
 * session cookie (prefixed `__Secure-` on HTTPS in production, un-prefixed in
 * demo where secure cookies are disabled). The demo's transparent auto-login
 * is handled by the `/api/demo-login` route handler — NOT here — so the proxy
 * stays free of any environment / crypto dependency that the middleware
 * runtime cannot reliably resolve.
 */
export function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl
	const isProtected = pathname.startsWith("/dashboard") || pathname === "/cambiar-contrasena"

	if (isProtected) {
		const hasSession =
			request.cookies.get("better-auth.session_token") ||
			request.cookies.get("__Secure-better-auth.session_token")

		if (!hasSession) {
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
