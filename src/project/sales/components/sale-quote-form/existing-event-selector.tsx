"use client"

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select"
import { Badge } from "@/shared/components/ui/badge"
import { cn } from "@/lib/utils"

import type { ExistingEventOption } from "@/project/sales/actions/event-query.actions"

interface ExistingEventSelectorProps {
	events: ExistingEventOption[] | undefined
	isLoading: boolean
	selectedEventId: string | undefined
	onSelectEvent: (
		eventId: string | undefined,
		startTime: string | null,
		endTime: string | null
	) => void
	allowNewEvent?: boolean
}

export function ExistingEventSelector({
	events,
	isLoading,
	selectedEventId,
	onSelectEvent,
	allowNewEvent = true,
}: ExistingEventSelectorProps) {
	if (isLoading) {
		return (
			<div className="text-muted-foreground text-sm">Cargando eventos existentes...</div>
		)
	}

	if (!events || events.length === 0) {
		return null
	}

	const formatTime = (start: string | null, end: string | null) => {
		if (!start && !end) return "Sin horario"
		return `${start || "?"} - ${end || "?"}`
	}

	return (
		<div className="space-y-2">
			<label className="text-sm font-medium">Evento existente</label>
			<Select
				value={selectedEventId || "new"}
				onValueChange={(value) => {
					if (value === "new") {
						onSelectEvent(undefined, null, null)
						return
					}
					const event = events.find((e) => e.id === value)
					if (event) {
						onSelectEvent(event.id, event.startTime, event.endTime)
					}
				}}
			>
				<SelectTrigger className="w-full">
					<SelectValue placeholder="Seleccione un evento" />
				</SelectTrigger>
				<SelectContent>
					{allowNewEvent && (
						<SelectItem value="new">Nuevo evento (horario personalizado)</SelectItem>
					)}
					{events.map((event) => {
						const isFull = event.currentBookings >= event.maxCapacity
						return (
							<SelectItem key={event.id} value={event.id} disabled={isFull}>
								<span className="flex items-center gap-2">
									<span>{formatTime(event.startTime, event.endTime)}</span>
									<Badge
										variant={isFull ? "destructive" : "secondary"}
										className="text-xs"
									>
										{isFull
											? "LLENO"
											: `${event.currentBookings}/${event.maxCapacity} pax`}
									</Badge>
									{event.guideName && (
										<span className="text-muted-foreground text-xs">
											{event.guideName}
										</span>
									)}
								</span>
							</SelectItem>
						)
					})}
				</SelectContent>
			</Select>
		</div>
	)
}
