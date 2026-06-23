"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"

import { cn } from "@/lib/utils"

import type { ProviderRole, DragProviderData } from "../types/provider-assignment.types"

// --- Props ---

interface DraggableProviderItemProps {
	id: string
	name: string
	role: ProviderRole
	cost: number
	subtitle?: string
}

// --- Component ---

export function DraggableProviderItem({
	id,
	name,
	role,
	cost,
	subtitle,
}: DraggableProviderItemProps) {
	const dragData: DragProviderData = {
		kind: "provider",
		providerId: id,
		providerType: role,
		providerName: name,
		defaultCost: cost,
	}

	const { attributes, listeners, setNodeRef, transform, isDragging } =
		useDraggable({
			id: `provider-${role}-${id}`,
			data: dragData,
		})

	const style = transform
		? {
				transform: CSS.Translate.toString(transform),
			}
		: undefined

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				"flex cursor-grab items-center gap-2 rounded-md border px-2 py-1.5 transition-all",
				"hover:bg-muted/50 active:cursor-grabbing",
				"border-border bg-background",
				isDragging && "z-50 opacity-50 shadow-lg"
			)}
			{...listeners}
			{...attributes}
		>
			<GripVertical className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
			<div className="min-w-0 flex-1">
				<p className="truncate text-xs font-medium">{name}</p>
				{subtitle && (
					<p className="text-muted-foreground truncate text-[10px]">
						{subtitle}
					</p>
				)}
			</div>
			{cost > 0 && (
				<span className="text-muted-foreground shrink-0 text-[10px]">
					${cost.toLocaleString()}
				</span>
			)}
		</div>
	)
}
