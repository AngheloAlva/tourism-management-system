"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"

import { CalendarEventCard } from "./calendar-event-card"
import { EventHoverCard } from "./event-hover-card"
import type { CalendarEventCardProps, CalendarViewEvent } from "../types/calendar.types"
import type { DragEventData } from "../types/provider-assignment.types"

// --- Props ---

interface DraggableEventCardProps extends CalendarEventCardProps {
	event: CalendarViewEvent
}

// --- Component ---

export function DraggableEventCard({ event, ...rest }: DraggableEventCardProps) {
	const dragData = {
		kind: "event",
		eventId: event.id,
		event,
	} satisfies DragEventData

	const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
		id: `event-drag-${event.id}`,
		data: dragData,
	})

	const style = {
		transform: CSS.Translate.toString(transform),
		opacity: isDragging ? 0.4 : 1,
	}

	return (
		<EventHoverCard eventId={event.id}>
			<div ref={setNodeRef} style={style} {...attributes} {...listeners}>
				<CalendarEventCard event={event} {...rest} />
			</div>
		</EventHoverCard>
	)
}
