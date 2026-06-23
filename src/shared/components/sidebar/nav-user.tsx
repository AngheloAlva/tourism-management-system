"use client"

import { BellIcon, LogOutIcon, ChevronsUpDownIcon, UserIcon } from "lucide-react"
import { redirect } from "next/navigation"
import Link from "next/link"

import { authClient } from "@/lib/auth-client"

import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar"
import {
	DropdownMenu,
	DropdownMenuItem,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuSeparator,
} from "@/shared/components/ui/dropdown-menu"
import {
	useSidebar,
	SidebarMenu,
	SidebarMenuItem,
	SidebarMenuButton,
} from "@/shared/components/ui/sidebar"

export function NavUser({
	user,
}: {
	user: {
		name: string
		email: string
		avatar?: string
	}
}) {
	const { isMobile } = useSidebar()
	const avatarText = user.name.slice(0, 2)

	const handleLogout = async () => {
		await authClient.signOut()
		redirect("/")
	}

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							<Avatar className="h-8 w-8 rounded-lg">
								<AvatarImage src={user.avatar} alt={user.name} />
								<AvatarFallback className="rounded-lg">{avatarText}</AvatarFallback>
							</Avatar>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">{user.name}</span>
								<span className="truncate text-xs">{user.email}</span>
							</div>
							<ChevronsUpDownIcon className="ml-auto size-4" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
						side={isMobile ? "bottom" : "right"}
						align="end"
						sideOffset={4}
					>
						<DropdownMenuLabel className="p-0 font-normal">
							<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
								<Avatar className="h-8 w-8 rounded-lg">
									<AvatarImage src={user.avatar} alt={user.name} />
									<AvatarFallback className="rounded-lg">{avatarText}</AvatarFallback>
								</Avatar>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-medium">{user.name}</span>
									<span className="truncate text-xs">{user.email}</span>
								</div>
							</div>
						</DropdownMenuLabel>

						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem asChild>
								<Link href="/dashboard/mi-cuenta">
									<UserIcon />
									Cuenta
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem>
								<BellIcon />
								Notificaciones
							</DropdownMenuItem>
						</DropdownMenuGroup>

						<DropdownMenuSeparator />

						<DropdownMenuItem onClick={handleLogout} data-testid="nav-user-button-signout">
							<LogOutIcon />
							Cerrar sesión
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	)
}
