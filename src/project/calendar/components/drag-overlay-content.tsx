import { GripVertical } from "lucide-react"

import { Badge } from "@/shared/components/ui/badge"

import type { DragProviderData } from "../types/provider-assignment.types"

// --- Role Labels ---

const ROLE_LABEL = {
	guide: "Guía",
	driver: "Conductor",
	vehicle: "Vehículo",
} as const

const ROLE_COLOR = {
	guide: "bg-blue-600",
	driver: "bg-orange-600",
	vehicle: "bg-purple-600",
} as const

// --- Props ---

interface DragOverlayContentProps {
	data: DragProviderData
}

// --- Component ---

export function DragOverlayContent({ data }: DragOverlayContentProps) {
	return (
		<div className="flex cursor-grabbing items-center gap-2 rounded-md border bg-white px-3 py-2 shadow-xl dark:bg-slate-900">
			<GripVertical className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
			<span className="text-xs font-medium">{data.providerName}</span>
			<Badge
				className={`${ROLE_COLOR[data.providerType]} text-[10px] text-white`}
			>
				{ROLE_LABEL[data.providerType]}
			</Badge>
		</div>
	)
}
