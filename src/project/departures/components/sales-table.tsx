"use client"

import { Users, ShoppingBag } from "lucide-react"

import { channelTypeLabels } from "@/project/sales/utils/channel-type-labels"

import { Badge } from "@/shared/components/ui/badge"
import {
	Table,
	TableRow,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
} from "@/shared/components/ui/table"

import type { DepartureEvent } from "../types/departure.types"
import { getEventDisplayName } from "@/project/events/utils/event-display"

interface SalesTableProps {
	selectedEvent: DepartureEvent | null
	onSelectSale: (saleId: string) => void
}

export function SalesTable({ selectedEvent, onSelectSale }: SalesTableProps) {
	if (!selectedEvent) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-center">
					<ShoppingBag className="text-muted-foreground mx-auto h-12 w-12" />
					<h3 className="text-muted-foreground mt-4 text-lg font-medium">Selecciona un evento</h3>
					<p className="text-muted-foreground mt-2 text-sm">
						Selecciona un evento de la lista para ver sus ventas asociadas
					</p>
				</div>
			</div>
		)
	}

	const bookings = selectedEvent.bookings

	if (bookings.length === 0) {
		return (
			<div className="h-full space-y-4">
				<h2 className="flex items-center gap-2 text-lg font-semibold">
					<ShoppingBag className="h-5 w-5" />
					Ventas del Evento
				</h2>
				<div className="flex h-full items-center justify-center">
					<p className="text-muted-foreground">No hay ventas asociadas a este evento</p>
				</div>
			</div>
		)
	}

	return (
		<div className="h-full space-y-4">
			<div>
				<h2 className="flex items-center gap-2 text-lg font-semibold">
					<ShoppingBag className="h-5 w-5" />
					Ventas del Evento ({bookings.length})
				</h2>
				<p className="text-muted-foreground text-sm">{getEventDisplayName(selectedEvent)}</p>
			</div>
			<div className="bg-muted/30 rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Voucher</TableHead>
							<TableHead>Tipo</TableHead>
							<TableHead>Canal</TableHead>
							<TableHead>Pasajeros</TableHead>
							<TableHead>Vendedor</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{bookings.map((booking) => {
							const sale = booking.saleRecord
							return (
								<TableRow
									key={booking.id}
									className="hover:bg-muted/50 cursor-pointer"
									onClick={() => onSelectSale(sale.id)}
								>
									<TableCell className="font-medium">V-{sale.voucher}</TableCell>
									<TableCell>
										<Badge variant={sale.type === "SALE" ? "default" : "secondary"}>
											{sale.type === "SALE" ? "Venta" : "Cotización"}
										</Badge>
									</TableCell>
									<TableCell>
										<span className="text-sm">
											{channelTypeLabels[sale.channel as keyof typeof channelTypeLabels]}
										</span>
									</TableCell>
									<TableCell>
										<div className="flex items-center gap-2">
											<Users className="text-muted-foreground h-4 w-4" />
											<span className="font-medium">{booking.passengerCount}</span>
											<span className="text-muted-foreground text-xs">
												({booking.adultsCount}A {booking.childrenCount}N {booking.seniorsCount}S)
											</span>
										</div>
									</TableCell>
									<TableCell>
										<span className="text-sm">{sale.seller.name}</span>
									</TableCell>
								</TableRow>
							)
						})}
					</TableBody>
				</Table>
			</div>

			<div className="bg-muted/30 mt-4 rounded-md p-4">
				<div className="grid grid-cols-3 gap-4 text-sm">
					<div>
						<p className="text-muted-foreground">Total Ventas</p>
						<p className="text-lg font-semibold">{bookings.length}</p>
					</div>
					<div>
						<p className="text-muted-foreground">Total Pasajeros</p>
						<p className="text-lg font-semibold">
							{bookings.reduce((acc, b) => acc + b.passengerCount, 0)}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground">Capacidad Restante</p>
						<p className="text-lg font-semibold">
							{selectedEvent.maxCapacity - selectedEvent.currentBookings}
						</p>
					</div>
				</div>
			</div>
		</div>
	)
}
