"use client"

import { usePathname } from "next/navigation"

import { data, filterSidebarByPermissions, type ModulePermissionMap } from "./sidebar-data"

import { NavSecondary } from "@/shared/components/sidebar/nav-secondary"
import { NavMain } from "@/shared/components/sidebar/nav-main"
import { NavUser } from "@/shared/components/sidebar/nav-user"
import Logo from "@/shared/components/sidebar/logo"
import {
	Sidebar,
	SidebarRail,
	SidebarFooter,
	SidebarHeader,
	SidebarContent,
	SidebarMenuButton,
} from "@/shared/components/ui/sidebar"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
	user: {
		name: string
		email: string
		avatar?: string
		role?: string | null
	}
	permissions?: ModulePermissionMap
	isAdmin?: boolean
}

export function AppSidebar({ ...props }: AppSidebarProps) {
	const path = usePathname()
	const activePath = "/" + path.split("/")[2]
	const sidebarData = filterSidebarByPermissions(data, props.permissions, Boolean(props.isAdmin))

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<SidebarMenuButton
					size="lg"
					className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
				>
					<div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square h-10 w-6 items-center justify-center rounded-lg">
						<Logo className="min-h-8 min-w-5" />
					</div>

					<div className="grid flex-1 text-left text-sm leading-tight">
						<span className="truncate font-medium">TurismoChileTours</span>
						<span className="text-muted-foreground truncate text-xs">Dashboard de gestión</span>
					</div>
				</SidebarMenuButton>
			</SidebarHeader>

			<SidebarContent>
				<NavMain items={sidebarData.navMain} activePath={activePath} />
				<NavSecondary items={sidebarData.navSecondary} activePath={activePath} />
			</SidebarContent>

			<SidebarFooter>
				<NavUser user={props.user} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	)
}
