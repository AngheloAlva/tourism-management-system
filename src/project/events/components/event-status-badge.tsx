"use client"

import { Badge } from "@/shared/components/ui/badge"
import { cn } from "@/lib/utils"

interface EventStatusBadgeProps {
	status: "SCHEDULED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "TRANSFERRED"
	className?: string
}

const statusConfig = {
	SCHEDULED: {
		label: "Programado",
		variant: "secondary" as const,
		className: "bg-blue-100 text-blue-800 border-blue-200",
	},
	CONFIRMED: {
		label: "Confirmado",
		variant: "default" as const,
		className: "bg-green-100 text-green-800 border-green-200",
	},
	IN_PROGRESS: {
		label: "En Progreso",
		variant: "default" as const,
		className: "bg-yellow-100 text-yellow-800 border-yellow-200",
	},
	COMPLETED: {
		label: "Completado",
		variant: "default" as const,
		className: "bg-emerald-100 text-emerald-800 border-emerald-200",
	},
	CANCELLED: {
		label: "Cancelado",
		variant: "destructive" as const,
		className: "bg-red-100 text-red-800 border-red-200",
	},
	TRANSFERRED: {
		label: "Traspasado",
		variant: "outline" as const,
		className: "bg-purple-100 text-purple-800 border-purple-300 font-semibold",
	},
}

export function EventStatusBadge({ status, className }: EventStatusBadgeProps) {
	const config = statusConfig[status]

	return (
		<Badge variant={config.variant} className={cn(config.className, className)}>
			{config.label}
		</Badge>
	)
}
