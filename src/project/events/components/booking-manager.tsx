"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { formatCalendarDay } from "@/shared/utils/calendar-day"
import { ArrowRight, Users, Calendar } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { Button } from "@/shared/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Textarea } from "@/shared/components/ui/textarea"
import { Checkbox } from "@/shared/components/ui/checkbox"
import { Label } from "@/shared/components/ui/label"

import { getFutureEventsForTour, moveBooking } from "@/project/events/actions/event.actions"

interface BookingManagerProps {
	eventId: string
	tourId: string
	bookings: Array<{
		id: string
		passengerCount: number
		saleRecord: {
			voucher: number
			clientEmail: string | null
		}
	}>
	onUpdate?: () => void
}

export function BookingManager({ eventId, tourId, bookings, onUpdate }: BookingManagerProps) {
	const router = useRouter()
	const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
	const [targetEventId, setTargetEventId] = useState<string>("")
	const [reason, setReason] = useState("")
	const [forceOverbook, setForceOverbook] = useState(false)
	const [isMoving, setIsMoving] = useState(false)

	const { data: futureEvents } = useQuery({
		queryKey: ["future-events", tourId, eventId],
		queryFn: () => getFutureEventsForTour(tourId, eventId),
		enabled: !!tourId,
	})

	const handleMove = async () => {
		if (!selectedBookingId || !targetEventId || !reason.trim()) return

		setIsMoving(true)
		try {
			const result = await moveBooking({
				bookingId: selectedBookingId,
				targetEventId,
				reason: reason.trim(),
				force: forceOverbook,
			})
			if (result.success) {
				toast.success("Reserva movida correctamente")
				setSelectedBookingId(null)
				setTargetEventId("")
				setReason("")
				setForceOverbook(false)
				if (onUpdate) onUpdate()
				router.refresh()
			} else if (result.capacityExceeded) {
				toast.error("Capacidad excedida. Active la opción de sobrecupo para continuar.")
			} else {
				toast.error(result.error || "Error al mover la reserva")
			}
		} catch (error) {
			toast.error("Error inesperado")
			console.error(error)
		} finally {
			setIsMoving(false)
		}
	}

	const selectedBooking = bookings.find((b) => b.id === selectedBookingId)
	const availableEvents = futureEvents?.filter((e) => e.id !== eventId) || []

	const targetEvent = availableEvents.find((e) => e.id === targetEventId)
	const capacityExceeded =
		targetEvent && selectedBooking
			? targetEvent.currentBookings + selectedBooking.passengerCount > targetEvent.maxCapacity
			: false

	return (
		<>
			<Card className="gap-2">
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>Pasajeros y Reservas</CardTitle>
						<span className="text-muted-foreground text-sm font-normal">
							Total: {bookings.reduce((acc, b) => acc + b.passengerCount, 0)} pax
						</span>
					</div>
				</CardHeader>
				<CardContent>
					{bookings.length === 0 ? (
						<p className="text-muted-foreground text-sm">No hay reservas en este evento.</p>
					) : (
						<div className="space-y-2">
							{bookings.map((booking) => (
								<div
									key={booking.id}
									className="bg-muted/40 hover:bg-muted/60 flex items-center justify-between rounded-lg border p-3 transition-colors"
								>
									<div className="space-y-1">
										<p className="font-medium">Voucher #{booking.saleRecord.voucher}</p>
										<div className="flex items-center gap-3 text-sm">
											<div className="text-muted-foreground flex items-center gap-1">
												<Users className="h-4 w-4" />
												{booking.passengerCount} pax
											</div>
											{booking.saleRecord.clientEmail && (
												<span className="text-muted-foreground max-w-[150px] truncate">
													{booking.saleRecord.clientEmail}
												</span>
											)}
										</div>
									</div>
									<Button
										size="sm"
										type="button"
										variant="ghost"
										className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
										onClick={() => setSelectedBookingId(booking.id)}
									>
										<ArrowRight className="h-4 w-4" />
										Mover
									</Button>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			<Dialog
				open={!!selectedBookingId}
				onOpenChange={(open) => {
					if (!open) {
						setSelectedBookingId(null)
						setTargetEventId("")
						setReason("")
						setForceOverbook(false)
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Mover Reserva</DialogTitle>
						<DialogDescription>
							Selecciona el evento destino para mover la reserva del Voucher #
							{selectedBooking?.saleRecord.voucher} ({selectedBooking?.passengerCount} pax).
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div>
							<Label className="mb-2 block text-sm font-medium">Evento Destino</Label>
							<Select value={targetEventId} onValueChange={setTargetEventId}>
								<SelectTrigger>
									<SelectValue placeholder="Seleccionar evento..." />
								</SelectTrigger>
								<SelectContent>
									{availableEvents.length === 0 ? (
										<div className="text-muted-foreground p-2 text-center text-sm">
											No hay otros eventos disponibles
										</div>
									) : (
										availableEvents.map((event) => (
											<SelectItem key={event.id} value={event.id}>
												<span className="flex items-center gap-2">
													<Calendar className="h-4 w-4 opacity-50" />
													{formatCalendarDay(event.date, "dd/MM/yyyy")} -{" "}
													{event.startTime || ""} ({event.currentBookings}/{event.maxCapacity})
												</span>
											</SelectItem>
										))
									)}
								</SelectContent>
							</Select>
						</div>

						{/* Capacity warning */}
						{capacityExceeded && targetEvent && selectedBooking && (
							<div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/10">
								<p className="text-xs font-medium text-amber-800 dark:text-amber-200">
									Capacidad excedida: {targetEvent.currentBookings}/{targetEvent.maxCapacity} →{" "}
									{targetEvent.currentBookings + selectedBooking.passengerCount}/{targetEvent.maxCapacity}
								</p>
								<div className="flex items-center gap-2">
									<Checkbox
										id="force-overbook"
										checked={forceOverbook}
										onCheckedChange={(checked) => setForceOverbook(checked === true)}
									/>
									<Label htmlFor="force-overbook" className="text-xs text-amber-700 dark:text-amber-300">
										Permitir sobrecupo
									</Label>
								</div>
							</div>
						)}

						<div>
							<Label className="mb-2 block text-sm font-medium">
								Motivo <span className="text-destructive">*</span>
							</Label>
							<Textarea
								value={reason}
								onChange={(e) => setReason(e.target.value)}
								placeholder="Motivo de la reasignación..."
								className="min-h-[80px] text-sm"
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setSelectedBookingId(null)
								setTargetEventId("")
								setReason("")
								setForceOverbook(false)
							}}
						>
							Cancelar
						</Button>
						<Button
							onClick={handleMove}
							disabled={!targetEventId || !reason.trim() || isMoving || (capacityExceeded && !forceOverbook)}
						>
							{isMoving ? "Moviendo..." : "Mover Reserva"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}
