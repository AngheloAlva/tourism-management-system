"use client"

import { usePathname } from "next/navigation"

import { ThemeSwitcher } from "../theme-switcher"
import { SidebarTrigger } from "../ui/sidebar"
import { Separator } from "../ui/separator"
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "@/shared/components/ui/breadcrumb"

export default function SidebarHeader(): React.ReactElement {
	const path = usePathname()

	return (
		<header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
			<div className="flex items-center gap-2">
				<SidebarTrigger className="-ml-1" />
				<Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />

				<Breadcrumb>
					<BreadcrumbList>
						{path.split("/").map((item, index) => (
							<div key={index} className="flex items-center gap-2">
								<BreadcrumbItem key={index} className="capitalize">
									<BreadcrumbLink>{item.replaceAll("-", " ")}</BreadcrumbLink>
								</BreadcrumbItem>

								{index < path.split("/").length - 1 && index !== 0 && (
									<BreadcrumbSeparator className="hidden md:block" />
								)}
							</div>
						))}
					</BreadcrumbList>
				</Breadcrumb>
			</div>

			<ThemeSwitcher />
		</header>
	)
}
