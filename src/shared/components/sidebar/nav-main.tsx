"use client"

import Link from "next/link"

import {
	SidebarMenu,
	SidebarGroup,
	SidebarMenuItem,
	SidebarGroupLabel,
	SidebarMenuButton,
	SidebarMenuSub,
	SidebarMenuSubItem,
	SidebarMenuSubButton,
} from "@/shared/components/ui/sidebar"
import { MenuItem } from "./sidebar-data"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible"
import { ChevronRightIcon } from "lucide-react"

export function NavMain({ items, activePath }: { items: Array<MenuItem>; activePath: string }) {
	return (
		<SidebarGroup>
			<SidebarGroupLabel>Menú principal</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) =>
					item.items ? (
						<Collapsible asChild key={item.title} className="group/collapsible">
							<SidebarMenuItem>
								<CollapsibleTrigger asChild>
									<SidebarMenuButton tooltip={item.title}>
										{item.icon && <item.icon />}
										<span>{item.title}</span>
										<ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
									</SidebarMenuButton>
								</CollapsibleTrigger>

								<CollapsibleContent>
									<SidebarMenuSub>
										{item.items?.map((subItem) => (
											<SidebarMenuSubItem key={subItem.title}>
												<SidebarMenuSubButton
													asChild
													className={
														activePath === subItem.url
															? "bg-sidebar-primary text-sidebar-primary-foreground [&>svg]:text-sidebar-primary-foreground"
															: ""
													}
												>
													<Link
														href={subItem.url !== "/" ? "/dashboard" + subItem.url : "#"}
														title={subItem.title}
													>
														{subItem.icon && <subItem.icon />}
														<span>{subItem.title}</span>
													</Link>
												</SidebarMenuSubButton>
											</SidebarMenuSubItem>
										))}
									</SidebarMenuSub>
								</CollapsibleContent>
							</SidebarMenuItem>
						</Collapsible>
					) : (
						<SidebarMenuItem key={item.title}>
							<Link href={item.url !== "/" ? "/dashboard" + item.url : "#"} title={item.title}>
								<SidebarMenuButton
									tooltip={item.title}
									className={
										activePath === item.url
											? "bg-sidebar-primary text-sidebar-primary-foreground"
											: ""
									}
								>
									{item.icon && <item.icon />}
									<span>{item.title}</span>
								</SidebarMenuButton>
							</Link>
						</SidebarMenuItem>
					)
				)}
			</SidebarMenu>
		</SidebarGroup>
	)
}
