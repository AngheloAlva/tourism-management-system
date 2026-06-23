"use client"

import Link from "next/link"
import { ArrowRight, Calendar, CalendarOff, Users } from "lucide-react"
import { es } from "date-fns/locale"
import { format } from "date-fns"

import { useUpcomingEvents } from "../hooks/use-home"

import { Button } from "@/shared/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { EmptyState } from "@/shared/components/empty-state"

export function UpcomingEvents() {
	const { data: events, isLoading } = useUpcomingEvents()

	if (isLoading) {
		return (
			<Card className="col-span-4 h-fit md:col-span-2">
				<CardHeader>
					<div className="bg-muted mb-2 h-6 w-48 rounded" />
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{Array.from({ length: 3 }).map((_, i) => (
							<div key={i} className="flex items-center space-x-4">
								<div className="bg-muted h-10 w-10 rounded-full" />
								<div className="space-y-2">
									<div className="bg-muted h-4 w-32 rounded" />
									<div className="bg-muted h-3 w-24 rounded" />
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card className="col-span-4 h-fit md:col-span-2">
			<CardHeader>
				<CardTitle>Próximos Eventos</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-8">
					{events?.length === 0 ? (
						<EmptyState
							icon={CalendarOff}
							title="No tenés eventos en los próximos 15 días"
							description="Cuando registres una venta con tour, el evento aparece acá."
							action={
								<Button asChild variant="outline" size="sm">
									<Link href="/dashboard/calendario">
										Ver calendario completo
										<ArrowRight className="h-4 w-4" />
									</Link>
								</Button>
							}
						/>
					) : (
						events?.map((event) => (
							<div key={event.id} className="flex items-center">
								<div className="bg-primary/10 flex h-9 w-9 items-center justify-center rounded-full">
									<Calendar className="text-primary h-4 w-4" />
								</div>
								<div className="ml-4 space-y-1">
									<p className="text-sm leading-none font-medium">{event.tourName}</p>
									<p className="text-muted-foreground text-xs">
										{/* event.date is @db.Date (UTC midnight); reconstruct for locale-aware format */}
										{format(
											new Date(event.date.getUTCFullYear(), event.date.getUTCMonth(), event.date.getUTCDate()),
											"PPP",
											{ locale: es },
										)}
										{event.startTime && ` • ${event.startTime}`}
									</p>
								</div>
								<div className="ml-auto font-medium">
									<div className="text-muted-foreground flex items-center gap-2 text-sm">
										<Users className="h-3 w-3" />
										<span>{event.passengers}</span>
									</div>
								</div>
							</div>
						))
					)}
				</div>
			</CardContent>
		</Card>
	)
}
