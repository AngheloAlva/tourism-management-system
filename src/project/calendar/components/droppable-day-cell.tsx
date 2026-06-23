"use client"

import { useDroppable } from "@dnd-kit/core"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { buildDayDroppableId } from "../utils/droppable-id"

// --- Props ---

interface DroppableDayCellProps {
	date: Date
	children: ReactNode
	className?: string
	disabled?: boolean
}

// --- Component ---

export function DroppableDayCell({ date, children, className, disabled }: DroppableDayCellProps) {
	const { setNodeRef, isOver } = useDroppable({
		id: buildDayDroppableId(date),
		data: { kind: "day", date },
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
