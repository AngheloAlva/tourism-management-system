import { Save, Loader2, Ban } from "lucide-react"

// import { Switch } from "@/shared/components/ui/switch" // Uncomment when re-enabling the manual completion switch
import { Button } from "@/shared/components/ui/button"

import type { EventFormData } from "./event-detail-types"

interface EventDetailFooterProps {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	event: any
	formData: EventFormData
	setFormData: React.Dispatch<React.SetStateAction<EventFormData>>
	isSubmitting: boolean
	onSubmit: () => void
	onClose: () => void
	onCancelEvent: () => void
}

export function EventDetailFooter({
	event,
	// formData and setFormData are consumed only by the commented-out completion
	// Switch below — re-add them to the destructuring when re-enabling it.
	isSubmitting,
	onSubmit,
	onClose,
	onCancelEvent,
}: EventDetailFooterProps) {
	return (
		<div className="flex flex-shrink-0 items-center justify-between border-t px-6 py-4">
			{/* Completion is now automated nightly via the complete-events cron (7-day rule).
			    Uncomment the block below to re-enable the manual switch if needed.
			<div className="flex items-center gap-2">
				<Switch
					checked={formData.isCompleted}
					onCheckedChange={(checked) =>
						setFormData((p) => ({ ...p, isCompleted: checked }))
					}
					disabled={event.status === "CANCELLED"}
				/>
				<span className="text-sm">Marcar como completado</span>
			</div>
			*/}
			<div />

			<div className="flex gap-2">
				<Button
					variant="destructive"
					onClick={onCancelEvent}
					disabled={event.status === "CANCELLED"}
				>
					<Ban className="h-4 w-4" />
					Anular Evento
				</Button>
				<Button variant="outline" onClick={onClose}>
					Cerrar
				</Button>
				<Button
					onClick={onSubmit}
					disabled={isSubmitting || event.status === "CANCELLED"}
				>
					{isSubmitting ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Save className="h-4 w-4" />
					)}
					Guardar Todo
				</Button>
			</div>
		</div>
	)
}
