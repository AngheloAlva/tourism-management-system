import { es } from "date-fns/locale"
import { format } from "date-fns"
import { CalendarIcon, AlertTriangle } from "lucide-react"

import { DialogTitle, DialogHeader, DialogDescription } from "@/shared/components/ui/dialog"
import { Badge } from "@/shared/components/ui/badge"
import { getEventDisplayName } from "@/project/events/utils/event-display"

interface EventDetailHeaderProps {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	event: any
	registeredPassengers: number
	chargedPassengers: number
	incompletePassengersCount: number
}

export function EventDetailHeader({
	event,
	registeredPassengers,
	chargedPassengers,
	incompletePassengersCount,
}: EventDetailHeaderProps) {
	const passengerGap = registeredPassengers - chargedPassengers
	return (
		<DialogHeader className="flex-shrink-0 border-b px-6 py-4">
			<div className="flex items-start justify-between">
				<div className="space-y-1">
					<div className="text-muted-foreground flex items-center gap-2 text-sm">
						<CalendarIcon className="h-4 w-4" />
						<span>
							{event.date
						? format(
								// Reconstruct from UTC components so the day label is always correct,
								// independent of the client's local timezone (event.date is @db.Date = UTC midnight).
								new Date(
									(event.date as Date).getUTCFullYear(),
									(event.date as Date).getUTCMonth(),
									(event.date as Date).getUTCDate()
								),
								"EEEE d 'de' MMMM, yyyy",
								{ locale: es }
							)
						: ""}
						</span>
					</div>
					<DialogTitle className="text-xl">{getEventDisplayName(event)}</DialogTitle>
					<DialogDescription className="flex items-center gap-3">
						<span>
							{registeredPassengers}/{event.maxCapacity} pasajeros
						</span>
						{passengerGap !== 0 && (
							<Badge
								variant="outline"
								className="gap-1 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
							>
								<AlertTriangle className="h-3 w-3" />
								{passengerGap > 0
									? `${passengerGap} pasajero(s) sin cobrar`
									: `Faltan registrar ${-passengerGap} pasajero(s)`}
							</Badge>
						)}
						{incompletePassengersCount > 0 && (
							<Badge variant="destructive" className="gap-1">
								<AlertTriangle className="h-3 w-3" />
								{incompletePassengersCount} pasajero(s) incompleto(s)
							</Badge>
						)}
						{event.status === "CANCELLED" && (
							<Badge variant="destructive">Evento anulado</Badge>
						)}
					</DialogDescription>
					{event.status === "CANCELLED" && event.cancelReason && (
						<p className="text-destructive text-sm">Motivo: {event.cancelReason}</p>
					)}
				</div>
			</div>
		</DialogHeader>
	)
}
