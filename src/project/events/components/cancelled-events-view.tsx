"use client"

import { CalendarIcon } from "lucide-react"
import { endOfMonth, format, startOfMonth } from "date-fns"
import { formatCalendarDay } from "@/shared/utils/calendar-day"
import { es } from "date-fns/locale"
import { useState } from "react"
import type { DateRange } from "react-day-picker"

import { useCancelledEvents } from "../hooks/use-cancelled-events"
import { getEventDisplayName } from "@/project/events/utils/event-display"

import { cn } from "@/lib/utils"
import { Calendar } from "@/shared/components/ui/calendar"
import { Badge } from "@/shared/components/ui/badge"
import { Button } from "@/shared/components/ui/button"
import {
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	CardDescription,
} from "@/shared/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/components/ui/table"

export function CancelledEventsView() {
	const today = new Date()
	const [dateRange, setDateRange] = useState<DateRange>({
		from: startOfMonth(today),
		to: endOfMonth(today),
	})

	const startDate = dateRange.from ?? startOfMonth(today)
	const endDate = dateRange.to ?? dateRange.from ?? endOfMonth(today)

	const { data: cancelledEvents = [], isLoading } = useCancelledEvents(startDate, endDate)
	const rows = cancelledEvents as Array<any>
	const serviceKindLabel = {
		TOUR: "Tour",
		TRANSFER: "Transfer",
	} as const

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Eventos Anulados</h1>
					<p className="text-muted-foreground mt-1">
						Historial de anulaciones, motivos y trazabilidad operativa.
					</p>
				</div>

				<Popover>
					<PopoverTrigger asChild>
						<Button
							variant="outline"
							className={cn(
								"w-[300px] justify-start text-left font-normal",
								!dateRange.from && "text-muted-foreground"
							)}
						>
							<CalendarIcon className="h-4 w-4" />
							{dateRange.from && dateRange.to ? (
								<>
									{format(dateRange.from, "dd/MM/yyyy", { locale: es })} -{" "}
									{format(dateRange.to, "dd/MM/yyyy", { locale: es })}
								</>
							) : (
								"Seleccionar rango"
							)}
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-auto p-0" align="end">
						<Calendar
							mode="range"
							selected={dateRange}
							onSelect={(range) => {
								if (!range?.from) return
								setDateRange({ from: range.from, to: range.to ?? range.from })
							}}
							numberOfMonths={2}
							locale={es}
							initialFocus
						/>
					</PopoverContent>
				</Popover>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Listado de Anulaciones</CardTitle>
					<CardDescription>
						{rows.length} evento(s) anulados en el rango seleccionado
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="bg-muted/30 rounded-md border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Evento</TableHead>
									<TableHead>Fecha Evento</TableHead>
									<TableHead>Anulado</TableHead>
									<TableHead>Motivo</TableHead>
									<TableHead>Anulado por</TableHead>
									<TableHead>Ventas</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading ? (
									<TableRow>
										<TableCell colSpan={6} className="h-24 text-center">
											Cargando eventos anulados...
										</TableCell>
									</TableRow>
								) : rows.length === 0 ? (
									<TableRow>
										<TableCell colSpan={6} className="h-24 text-center">
											No hay eventos anulados en este rango.
										</TableCell>
									</TableRow>
								) : (
									rows.map((event) => (
										<TableRow key={event.id}>
											<TableCell>
												<div className="space-y-1">
													<p className="font-medium">{getEventDisplayName(event)}</p>
													<Badge variant="outline">
														{serviceKindLabel[event.serviceKind as keyof typeof serviceKindLabel] ||
															event.serviceKind}
													</Badge>
												</div>
											</TableCell>
											<TableCell>
												{formatCalendarDay(event.date, "dd/MM/yyyy")}
											</TableCell>
											<TableCell>
												{event.cancelledAt
													? format(new Date(event.cancelledAt), "dd/MM/yyyy HH:mm", { locale: es })
													: "-"}
											</TableCell>
											<TableCell className="max-w-[320px] whitespace-normal">
												{event.cancelReason || "Sin motivo"}
											</TableCell>
											<TableCell>{event.cancelledBy?.name || "No registrado"}</TableCell>
											<TableCell>
												{event.bookings.length} (
												{event.bookings.map((b: any) => `V-${b.saleRecord.voucher}`).join(", ")})
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
