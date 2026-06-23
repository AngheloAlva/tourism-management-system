import { Separator } from "@/shared/components/ui/separator"
import { Skeleton } from "@/shared/components/ui/skeleton"
import {
	Sidebar,
	SidebarInset,
	SidebarFooter,
	SidebarHeader,
	SidebarContent,
	SidebarTrigger,
	SidebarProvider,
	SidebarMenuSkeleton,
} from "@/shared/components/ui/sidebar"

export default function DashboardSkeleton(): React.ReactElement {
	return (
		<SidebarProvider>
			<AppSidebarSkeleton />

			<SidebarInset>
				<header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
					<div className="flex items-center gap-2">
						<SidebarTrigger className="-ml-1" />
						<Separator orientation="vertical" className="mr-2 h-4" />
						<Skeleton className="h-4 w-32" />
						<span className="text-muted-foreground">/</span>
						<Skeleton className="h-4 w-24" />
					</div>
				</header>

				<main className="flex flex-1 flex-col gap-4 p-4">
					{/* Row 1: 4 Stats Cards */}
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						{Array.from({ length: 4 }).map((_, i) => (
							<Skeleton key={i} className="h-32 rounded-xl" />
						))}
					</div>

					{/* Row 2: 4 Stats Cards */}
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						{Array.from({ length: 4 }).map((_, i) => (
							<Skeleton key={i} className="h-32 rounded-xl" />
						))}
					</div>

					{/* Row 3: Chart + Sidebar List */}
					<div className="grid h-full gap-4 md:grid-cols-3 lg:grid-cols-7">
						{/* Main Chart Area (2/3 roughly) */}
						<Skeleton className="col-span-4 h-[500px] rounded-xl" />

						{/* Right Side Event List (1/3 roughly) */}
						<div className="col-span-3 space-y-4">
							<Skeleton className="h-[500px] rounded-xl" />
						</div>
					</div>
				</main>
			</SidebarInset>
		</SidebarProvider>
	)
}

function AppSidebarSkeleton() {
	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<div className="flex items-center gap-2 p-2">
					<Skeleton className="size-8 rounded-lg" />
					<div className="flex flex-col gap-1">
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-3 w-24" />
					</div>
				</div>
			</SidebarHeader>

			<SidebarContent>
				<div className="flex flex-col gap-4 p-2">
					{Array.from({ length: 10 }).map((_, i) => (
						<SidebarMenuSkeleton key={i} showIcon />
					))}
				</div>
			</SidebarContent>

			<SidebarFooter>
				<div className="p-2">
					<SidebarMenuSkeleton showIcon />
				</div>
			</SidebarFooter>
		</Sidebar>
	)
}
