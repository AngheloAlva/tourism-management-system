export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { IS_DEMO } from "@/lib/demo"
import { getCurrentUserAccess } from "@/project/roles/actions/role.actions"
import { getModuleKeyFromPath } from "@/project/roles/constants/modules"

import { SidebarInset, SidebarProvider } from "@/shared/components/ui/sidebar"
import SidebarHeader from "@/shared/components/sidebar/sidebar-header"
import { AppSidebar } from "@/shared/components/sidebar/app-sidebar"
import { TooltipProvider } from "@/shared/components/ui/tooltip"

import DemoBanner from "@/project/demo/components/demo-banner"

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	// In demo mode the proxy injects the pre-seeded session cookie into the
	// request, so getSession resolves transparently on the first render.
	const session = await auth.api.getSession({
		headers: await headers(),
	})

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
