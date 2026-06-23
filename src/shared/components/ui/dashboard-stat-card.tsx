import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"

interface DashboardStatCardProps {
	title: string
	value: string | number
	icon: LucideIcon
	description?: string
	cardClassName?: string
	iconClassName?: string
	iconWrapperClassName?: string
	valueClassName?: string
}

export function DashboardStatCard({
	title,
	value,
	icon: Icon,
	description,
	cardClassName,
	iconClassName,
	iconWrapperClassName,
	valueClassName,
}: DashboardStatCardProps) {
	return (
		<Card className={cn("gap-2", cardClassName)}>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-medium">{title}</CardTitle>
				<div className={cn("bg-muted/30 rounded-full p-1.5", iconWrapperClassName)}>
					<Icon className={cn("text-muted-foreground h-5 w-5", iconClassName)} />
				</div>
			</CardHeader>
			<CardContent>
				<div className={cn("text-2xl font-bold", valueClassName)}>{value}</div>
				{description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
			</CardContent>
		</Card>
	)
}
