"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ClockIcon, UsersIcon, Loader2Icon } from "lucide-react"

import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/shared/components/ui/hover-card"
import { formatCurrency } from "@/shared/lib/format-currency"
import {
	getEventHoverDetails,
	type EventHoverDetails,
} from "@/project/events/actions/event.actions"

interface EventHoverCardProps {
	eventId: string
	children: React.ReactNode
}

export function EventHoverCard({ eventId, children }: EventHoverCardProps) {
	const [open, setOpen] = useState(false)

	const { data, isLoading } = useQuery<EventHoverDetails | null>({
		queryKey: ["event-hover", eventId],
		queryFn: () => getEventHoverDetails(eventId),
		enabled: open,
		staleTime: 30_000,
	})

	return (
		<HoverCard open={open} onOpenChange={setOpen} openDelay={250} closeDelay={100}>
			<HoverCardTrigger asChild>{children}</HoverCardTrigger>
			<HoverCardContent side="right" align="start" className="w-80">
				{isLoading || !data ? (
					<div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
						<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
						Cargando detalle...
					</div>
				) : (
					<div className="space-y-3">
						<div>
							<h4 className="text-sm font-semibold leading-tight">{data.name}</h4>
							<p className="text-xs text-muted-foreground">
								{/* Reconstruct from UTC parts so the day is correct on non-UTC clients (data.date is @db.Date = UTC midnight) */}
							{data.date
								? format(
										new Date(
											(data.date as Date).getUTCFullYear(),
											(data.date as Date).getUTCMonth(),
											(data.date as Date).getUTCDate()
										),
										"EEEE dd 'de' MMMM",
										{ locale: es }
									)
								: ""}
							</p>
						</div>

						<div className="flex items-center gap-4 text-xs text-muted-foreground">
							<span className="flex items-center gap-1">
								<ClockIcon className="h-3 w-3" />
								{data.startTime && data.endTime
									? `${data.startTime} – ${data.endTime}`
									: data.startTime || "Sin horario"}
							</span>
							<span className="flex items-center gap-1">
								<UsersIcon className="h-3 w-3" />
								{data.totalPax} pax
							</span>
						</div>

						<div>
							<p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
								Proveedores
							</p>
							{data.providers.length === 0 ? (
								<p className="text-xs italic text-muted-foreground">
									Sin proveedores asignados
								</p>
							) : (
								<ul className="space-y-1">
									{data.providers.map((p) => (
										<li
											key={`${p.role}-${p.name}`}
											className="flex items-center justify-between text-xs"
										>
											<span>
												<span className="text-muted-foreground">{p.role}:</span>{" "}
												<span className="font-medium">{p.name}</span>
											</span>
											<span className="font-medium tabular-nums">
												{formatCurrency(p.cost)}
											</span>
										</li>
									))}
								</ul>
							)}
						</div>
					</div>
				)}
			</HoverCardContent>
		</HoverCard>
	)
}
