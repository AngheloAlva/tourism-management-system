import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ArrowRightLeft, AlertTriangle, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { getEventDisplayName } from "@/project/events/utils/event-display"
import {
	Dialog,
	DialogTitle,
	DialogHeader,
	DialogContent,
	DialogDescription,
} from "@/shared/components/ui/dialog"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select"
import { Textarea } from "@/shared/components/ui/textarea"
import { Button } from "@/shared/components/ui/button"
import { Label } from "@/shared/components/ui/label"
import { Checkbox } from "@/shared/components/ui/checkbox"
import { Badge } from "@/shared/components/ui/badge"

import type { EligibleTargetEvent } from "@/project/events/actions/event.actions"

// --- Interfaces ---

interface BookingToMove {
	id: string
	voucher: string
	passengerCount: number
}

interface SourceEventInfo {
	id: string
	tourName: string
	date: Date
}

interface CapacityWarning {
	exceeded: boolean
	info: string
}

interface BookingReassignmentDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	bookings: BookingToMove[]
	sourceEvent: SourceEventInfo | null
	availableEvents: EligibleTargetEvent[]
	isLoadingEvents: boolean
	targetEventId: string
	onTargetChange: (id: string) => void
	reason: string
	onReasonChange: (reason: string) => void
	forceOverbook: boolean
	onForceChange: (force: boolean) => void
	isReassigning: boolean
	onConfirm: () => void
	totalPassengersToMove: number
	capacityWarning: CapacityWarning | null
}

// --- Helpers ---

function formatEventOption(event: EligibleTargetEvent): string {
	const tourName = getEventDisplayName(event)
	const dateStr = format(
		new Date(
			(event.date as Date).getUTCFullYear(),
			(event.date as Date).getUTCMonth(),
			(event.date as Date).getUTCDate()
		),
		"d MMM",
		{ locale: es }
	)
	const timeStr = event.startTime ?? ""
	const capacity = `${event.currentBookings}/${event.maxCapacity} pax`

	return `${tourName} - ${dateStr}${timeStr ? ` - ${timeStr}` : ""} (${capacity})`
}

function getEventAvailableCapacity(event: EligibleTargetEvent): number {
	return event.maxCapacity - event.currentBookings
}

// --- Component ---

export function BookingReassignmentDialog({
	open,
	onOpenChange,
	bookings,
	sourceEvent,
	availableEvents,
	isLoadingEvents,
	targetEventId,
	onTargetChange,
	reason,
	onReasonChange,
	forceOverbook,
	onForceChange,
	isReassigning,
	onConfirm,
	totalPassengersToMove,
	capacityWarning,
}: BookingReassignmentDialogProps) {
	const isFormValid = !!targetEventId && reason.trim().length > 0
	const canSubmit = isFormValid && (!capacityWarning?.exceeded || forceOverbook)

	const selectedTarget = availableEvents.find((e) => e.id === targetEventId)

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<ArrowRightLeft className="h-4 w-4" />
						Reasignar {bookings.length === 1 ? "voucher" : `${bookings.length} vouchers`}{" "}
						({totalPassengersToMove} pasajeros)
					</DialogTitle>
					<DialogDescription>
						{sourceEvent && (
							<>
								Desde{" "}
								<span className="font-medium text-foreground">
									{sourceEvent.tourName}
								</span>{" "}
								del{" "}
								<span className="font-medium text-foreground">
									{format(
									new Date(
										(sourceEvent.date as Date).getUTCFullYear(),
										(sourceEvent.date as Date).getUTCMonth(),
										(sourceEvent.date as Date).getUTCDate()
									),
									"d 'de' MMMM",
									{ locale: es }
								)}
								</span>
							</>
						)}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{/* Bookings being moved */}
					<div className="flex flex-wrap gap-1.5">
						{bookings.map((b) => (
							<Badge key={b.id} variant="outline" className="text-xs">
								V-{b.voucher} ({b.passengerCount} pax)
							</Badge>
						))}
					</div>

					{/* Target event selector */}
					<div className="space-y-2">
						<Label htmlFor="target-event">Seleccionar evento destino</Label>
						{isLoadingEvents ? (
							<div className="flex items-center gap-2 rounded-md border p-3">
								<Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
								<span className="text-muted-foreground text-sm">
									Cargando eventos disponibles...
								</span>
							</div>
						) : availableEvents.length === 0 ? (
							<div className="rounded-md border border-dashed p-3">
								<p className="text-muted-foreground text-center text-sm">
									No hay eventos disponibles para este tour
								</p>
							</div>
						) : (
							<Select
								value={targetEventId}
								onValueChange={onTargetChange}
								disabled={isReassigning}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Seleccionar evento destino..." />
								</SelectTrigger>
								<SelectContent position="popper">
									{availableEvents.map((evt) => {
										const available = getEventAvailableCapacity(evt)
										const wouldExceed = available < totalPassengersToMove

										return (
											<SelectItem key={evt.id} value={evt.id}>
												<div className="flex w-full items-center justify-between gap-2">
													<span>{formatEventOption(evt)}</span>
													{wouldExceed && (
														<AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />
													)}
												</div>
											</SelectItem>
										)
									})}
								</SelectContent>
							</Select>
						)}
					</div>

					{/* Capacity impact summary */}
					{selectedTarget && (
						<div
							className={cn(
								"rounded-md border p-2.5 text-xs",
								capacityWarning?.exceeded
									? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
									: "border-green-300 bg-green-50 text-green-800 dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-200"
							)}
						>
							<div className="flex items-start gap-2">
								{capacityWarning?.exceeded ? (
									<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
								) : null}
								<div>
									<p className="font-medium">
										{capacityWarning?.exceeded
											? "Sobrecupo detectado"
											: "Capacidad disponible"}
									</p>
									<p className="mt-0.5">
										{selectedTarget.currentBookings}/{selectedTarget.maxCapacity}
										{" → "}
										{selectedTarget.currentBookings + totalPassengersToMove}/
										{selectedTarget.maxCapacity}
										{capacityWarning?.exceeded && (
											<span className="ml-1 font-semibold">
												(excede por{" "}
												{selectedTarget.currentBookings +
													totalPassengersToMove -
													selectedTarget.maxCapacity}
												)
											</span>
										)}
									</p>
								</div>
							</div>
						</div>
					)}

					{/* Force overbook checkbox */}
					{capacityWarning?.exceeded && (
						<div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 dark:border-amber-500/40 dark:bg-amber-500/10">
							<Checkbox
								id="force-overbook"
								checked={forceOverbook}
								onCheckedChange={(checked) => onForceChange(checked === true)}
								disabled={isReassigning}
								className="mt-0.5"
							/>
							<Label
								htmlFor="force-overbook"
								className="cursor-pointer text-xs leading-snug text-amber-800 dark:text-amber-200"
							>
								Entiendo que esto excederá la capacidad máxima del evento y deseo
								continuar
							</Label>
						</div>
					)}

					{/* Reason field */}
					<div className="space-y-2">
						<Label htmlFor="reassign-reason">
							Motivo <span className="text-destructive">*</span>
						</Label>
						<Textarea
							id="reassign-reason"
							placeholder="Motivo de la reasignación..."
							value={reason}
							onChange={(e) => onReasonChange(e.target.value)}
							disabled={isReassigning}
							className="min-h-[80px] resize-none"
						/>
					</div>
				</div>

				{/* Actions */}
				<div className="flex justify-end gap-2 pt-2">
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isReassigning}
					>
						Cancelar
					</Button>
					<Button
						onClick={onConfirm}
						disabled={!canSubmit || isReassigning}
					>
						{isReassigning ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<ArrowRightLeft className="h-4 w-4" />
						)}
						Reasignar
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
