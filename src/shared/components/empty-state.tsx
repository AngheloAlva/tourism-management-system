import { Inbox, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface EmptyStateProps {
	icon?: LucideIcon
	title?: string
	description?: string
	action?: ReactNode
	className?: string
}

export function EmptyState({
	icon: Icon = Inbox,
	title = "No hay datos para mostrar",
	description,
	action,
	className,
}: EmptyStateProps) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-3 py-10 text-center",
				className
			)}
		>
			<Icon className="text-muted-foreground/60 h-10 w-10" aria-hidden="true" />
			<div className="space-y-1">
				<p className="text-foreground text-sm font-medium">{title}</p>
				{description ? (
					<p className="text-muted-foreground mx-auto max-w-sm text-xs">{description}</p>
				) : null}
			</div>
			{action ? <div className="mt-2">{action}</div> : null}
		</div>
	)
}
