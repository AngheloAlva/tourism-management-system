export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { headers, cookies } from "next/headers"

import { auth } from "@/lib/auth"
import { IS_DEMO } from "@/lib/demo"
import { getCurrentUserAccess } from "@/project/roles/actions/role.actions"
import { getModuleKeyFromPath } from "@/project/roles/constants/modules"

import { SidebarInset, SidebarProvider } from "@/shared/components/ui/sidebar"
import SidebarHeader from "@/shared/components/sidebar/sidebar-header"
import { AppSidebar } from "@/shared/components/sidebar/app-sidebar"
import { TooltipProvider } from "@/shared/components/ui/tooltip"

import DemoBanner from "@/project/demo/components/demo-banner"

/** Long-lived session token seeded into the PGlite snapshot. */
const DEMO_SESSION_TOKEN = "demo-session-token-atacama-2026"
/** Better Auth default session cookie name. */
const BA_COOKIE_NAME = "better-auth.session_token"

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	let session = await auth.api.getSession({
		headers: await headers(),
	})

	// ── Demo: transparent auto-login ─────────────────────────────────────────
	// When no session exists in demo mode, inject the pre-seeded session cookie
	// so Better Auth can resolve it on subsequent requests. We call getSession
	// again with the demo token to validate it against the PGlite snapshot.
	if (IS_DEMO && !session) {
		const cookieStore = await cookies()
		const alreadyTriedDemoLogin =
			cookieStore.get(BA_COOKIE_NAME)?.value === DEMO_SESSION_TOKEN

		// First visit: the request carries no session cookie. Set the pre-seeded
		// demo token and redirect. The Set-Cookie reaches the browser via the
		// redirect response, and the NEXT request carries the cookie in its
		// headers for Better Auth to resolve. Re-calling getSession in this same
		// request can't work — the request's already-parsed headers don't include
		// the cookie we just set.
		if (!alreadyTriedDemoLogin) {
			cookieStore.set(BA_COOKIE_NAME, DEMO_SESSION_TOKEN, {
				httpOnly: true,
				sameSite: "lax",
				path: "/",
				// Max-age: 1 year (the seeded session itself expires 2099)
				maxAge: 60 * 60 * 24 * 365,
			})
			redirect("/dashboard/inicio")
		}
		// Cookie already present but still no session → the seeded token didn't
		// resolve. Fall through to redirect("/") below instead of looping.
	}

	if (!session) {
		return redirect("/")
	}

	if (session.user.mustChangePassword) {
		return redirect("/cambiar-contrasena")
	}

	const requestHeaders = await headers()
	const pathname = requestHeaders.get("x-pathname") || "/dashboard/inicio"

	// Paths accessible by any authenticated user, regardless of role or module permissions
	const ROLE_BYPASS_PATHS = ["/dashboard/mi-cuenta"] as const
	const isBypass = ROLE_BYPASS_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))

	const access = await getCurrentUserAccess()
	if (!isBypass) {
		const moduleKey = getModuleKeyFromPath(pathname)
		const canAccess = access.isAdmin || !moduleKey || Boolean(access.permissions[moduleKey]?.visible)
		if (!canAccess) {
			return redirect("/dashboard/inicio")
		}
	}

	return (
		<SidebarProvider>
			<TooltipProvider>
				<AppSidebar user={session.user} permissions={access.permissions} isAdmin={access.isAdmin} />

				<SidebarInset className="w-auto min-w-0">
					<SidebarHeader />

					{IS_DEMO && <DemoBanner />}

					<main className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden p-6">{children}</main>
				</SidebarInset>
			</TooltipProvider>
		</SidebarProvider>
	)
}
