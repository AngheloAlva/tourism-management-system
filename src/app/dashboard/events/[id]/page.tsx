import { getEventById } from "@/project/events/actions/event.actions"
import { notFound } from "next/navigation"

import { EventDetailForm } from "@/project/events/components/event-detail-form"
import { getEventDisplayName } from "@/project/events/utils/event-display"

interface EventDetailPageProps {
	params: Promise<{
		id: string
	}>
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
	const { id } = await params
	const event = await getEventById(id)

	if (!event) {
		notFound()
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Detalle del Evento</h1>
					<p className="text-muted-foreground mt-1">
						Actualizar el evento {getEventDisplayName(event)}
					</p>
				</div>
			</div>

			<EventDetailForm event={event} />
		</div>
	)
}
