"use client"

import { useDroppable } from "@dnd-kit/core"

import { cn } from "@/lib/utils"

import type { ReactNode } from "react"
import type { CalendarViewEvent } from "../types/calendar.types"
import type { DragProviderData, ProviderRole } from "../types/provider-assignment.types"

// --- Helpers ---

function isDropValid(
	event: CalendarViewEvent,
	providerRole: ProviderRole
): boolean {
	// Guides can NOT be dropped on TRANSFER events
	if (providerRole === "guide" && event.serviceKind === "TRANSFER") {
		return false
	}
	return true
}

function isAlreadyAssigned(
	event: CalendarViewEvent,
	providerRole: ProviderRole,
	providerId: string
): boolean {
	if (providerRole === "guide" && event.guideId === providerId) return true
	if (providerRole === "driver" && event.driverId === providerId) return true
	if (providerRole === "vehicle" && event.vehicleId === providerId) return true
	return false
}

// --- Props ---

interface DroppableEventWrapperProps {
	event: CalendarViewEvent
	children: ReactNode
	hasConflict?: boolean
}

// --- Component ---

export function DroppableEventWrapper({
	event,
	children,
	hasConflict,
}: DroppableEventWrapperProps) {
	const { isOver, active, setNodeRef } = useDroppable({
		id: `event-drop-${event.id}`,
		data: { eventId: event.id, event },
	})

	// Determine visual feedback
	const dragData = active?.data.current as DragProviderData | undefined
	const isDragging = !!active

	let dropFeedback: "none" | "valid" | "invalid" | "conflict" = "none"

	if (isOver && isDragging && dragData?.providerType) {
		const valid = isDropValid(event, dragData.providerType)
		const alreadyAssigned = isAlreadyAssigned(
			event,
			dragData.providerType,
			dragData.providerId
		)

		if (!valid || alreadyAssigned) {
			dropFeedback = "invalid"
		} else if (hasConflict) {
			dropFeedback = "conflict"
		} else {
			dropFeedback = "valid"
		}
	}

	return (
		<div
			ref={setNodeRef}
			className={cn(
				"rounded-md transition-all",
				dropFeedback === "valid" &&
					"ring-2 ring-emerald-500/70 dark:ring-emerald-400/60",
				dropFeedback === "conflict" &&
					"ring-2 ring-amber-500/70 dark:ring-amber-400/60",
				dropFeedback === "invalid" &&
					"ring-2 ring-red-500/50 opacity-60 dark:ring-red-400/40"
			)}
		>
			{children}
		</div>
	)
}
