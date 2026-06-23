"use client"

import { useDroppable } from "@dnd-kit/core"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { buildHourDroppableId } from "../utils/droppable-id"

// --- Props ---

interface DroppableHourSlotProps {
	date: Date
	hhmm: string
	children?: ReactNode
	className?: string
	disabled?: boolean
}

// --- Component ---

export function DroppableHourSlot({
	date,
	hhmm,
	children,
	className,
	disabled,
}: DroppableHourSlotProps) {
	const { setNodeRef, isOver } = useDroppable({
		id: buildHourDroppableId(date, hhmm),
		data: { kind: "hour", date, startTime: hhmm },
		disabled,
	})

	return (
		<div
			ref={setNodeRef}
			className={cn(
				className,
				isOver && !disabled && "bg-primary/5 ring-1 ring-primary/30"
			)}
		>
			{children}
		</div>
	)
}
