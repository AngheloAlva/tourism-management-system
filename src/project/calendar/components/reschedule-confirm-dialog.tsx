"use client"

import { useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { AlertTriangle, AlertCircle, Info } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/shared/components/ui/button"
import { Textarea } from "@/shared/components/ui/textarea"
import { Switch } from "@/shared/components/ui/switch"
import { Label } from "@/shared/components/ui/label"
import { Alert, AlertTitle, AlertDescription } from "@/shared/components/ui/alert"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/shared/components/ui/dialog"

import { rescheduleEvent } from "@/project/events/actions/event.actions"
import type { CalendarViewEvent } from "../types/calendar.types"
import type {
	PassengerConflict,
	ProviderConflictSummary,
} from "@/project/events/schemas/reschedule-event.schema"
import type { AffectedVoucher } from "../hooks/use-reschedule-preview"
import { getEventDisplayName } from "@/project/events/utils/event-display"

// --- Props ---

interface RescheduleConfirmDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	originEvent: CalendarViewEvent
	destination: { date: Date; startTime?: string; endTime?: string }
	passengerConflicts: PassengerConflict[]
	providerConflicts: ProviderConflictSummary[]
	affectedVouchers: AffectedVoucher[]
	hasAssociatedTransfers: boolean
	events: CalendarViewEvent[]
}

// --- Helpers ---

function formatDateTime(date: Date, time?: string | null): string {
	const datePart = format(date, "dd/MM/yyyy", { locale: es })
	if (time) return `${datePart} ${time}`
	return datePart
}

// --- Component ---

export function RescheduleConfirmDialog({
	open,
	onOpenChange,
	originEvent,
	destination,
	passengerConflicts,
	providerConflicts,
	affectedVouchers,
	hasAssociatedTransfers,
}: RescheduleConfirmDialogProps) {
	const router = useRouter()
	const [reason, setReason] = useState("")
	const [overrideProviderConflict, setOverrideProviderConflict] = useState(false)
	const [isPending, setIsPending] = useState(false)
	const [serverError, setServerError] = useState<string | null>(null)

	const hasPassengerConflicts = passengerConflicts.length > 0
	const hasProviderConflicts = providerConflicts.length > 0
	const hasVoucherSent = affectedVouchers.some((v) => v.voucherSent)
	const isConfirmed = originEvent.status === "CONFIRMED"

	const canConfirm =
		reason.trim().length > 0 &&
		!hasPassengerConflicts &&
		!isPending

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) {
			// Reset local state on close
			setReason("")
			setOverrideProviderConflict(false)
			setServerError(null)
			setIsPending(false)
		}
		onOpenChange(nextOpen)
	}

	const handleConfirm = async () => {
		if (!canConfirm) return

		setIsPending(true)
		setServerError(null)

		const result = await rescheduleEvent({
			eventId: originEvent.id,
			newDate: destination.date,
			newStartTime: destination.startTime ?? null,
			newEndTime: destination.endTime ?? null,
			reason: reason.trim(),
			overrideProviderConflict,
		})

		if (result.success) {
			toast.success("Evento reagendado exitosamente")
			router.refresh()
			handleOpenChange(false)
		} else {
			setServerError(result.error)
			setIsPending(false)
		}
	}

	const originLabel = formatDateTime(new Date(originEvent.date), originEvent.startTime)
	const destLabel = formatDateTime(destination.date, destination.startTime)

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Reagendar evento</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					{/* 1. Origen → Destino */}
					<div className="rounded-md border p-3 text-sm">
						<p className="font-semibold">{getEventDisplayName(originEvent)}</p>
						<p className="text-muted-foreground mt-1">
							<span className="font-medium">{originLabel}</span>
							<span className="mx-2">→</span>
							<span className="font-medium text-foreground">{destLabel}</span>
						</p>
					</div>

					{/* 2. Vouchers afectados */}
					{affectedVouchers.length > 0 && (
						<div className="space-y-1">
							<p className="text-sm font-medium">Vouchers afectados</p>
							<ul className="space-y-0.5 text-sm text-muted-foreground">
								{affectedVouchers.map((v) => (
									<li key={v.saleRecordId} className="flex items-center gap-1">
										<span>
											{v.voucher != null ? `V-${v.voucher}` : "Sin voucher"} · {v.passengerCount} pax
										</span>
									</li>
								))}
							</ul>
						</div>
					)}

					{/* 3. Provider conflicts (amber, with override switch) */}
					{hasProviderConflicts && (
						<Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
							<AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
							<AlertTitle>Conflicto de proveedor</AlertTitle>
							<AlertDescription>
								<ul className="mt-1 space-y-0.5 text-xs">
									{providerConflicts.map((c, i) => (
										<li key={i}>
											{c.role} <span className="font-medium">{c.providerName}</span> tiene otro
											evento{c.conflictingTourName ? `: ${c.conflictingTourName}` : ""}
										</li>
									))}
								</ul>
								<div className="mt-3 flex items-center gap-2">
									<Switch
										id="override-provider"
										checked={overrideProviderConflict}
										onCheckedChange={setOverrideProviderConflict}
										size="sm"
									/>
									<Label htmlFor="override-provider" className="cursor-pointer text-xs">
										Confirmar de todas formas (anular conflicto de proveedor)
									</Label>
								</div>
							</AlertDescription>
						</Alert>
					)}

					{/* 4. Passenger conflicts (red, disables confirm) */}
					{hasPassengerConflicts && (
						<Alert className="border-destructive/40 bg-destructive/5 text-destructive dark:border-destructive/30 dark:bg-destructive/10">
							<AlertCircle className="size-4" />
							<AlertTitle>Conflicto de pasajero — operación bloqueada</AlertTitle>
							<AlertDescription>
								<ul className="mt-1 space-y-0.5 text-xs">
									{passengerConflicts.map((c, i) => (
										<li key={i}>
											{c.voucher != null ? `V-${c.voucher}` : "Sin voucher"} ya tiene otro evento en{" "}
											{c.tourName} — {c.startTime ?? "?"} – {c.endTime ?? "?"}
										</li>
									))}
								</ul>
							</AlertDescription>
						</Alert>
					)}

					{/* 5. CONFIRMED status warning */}
					{isConfirmed && (
						<Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
							<AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
							<AlertTitle>Evento confirmado</AlertTitle>
							<AlertDescription className="text-xs">
								Este evento está en estado CONFIRMADO. Al reagendarlo quedará actualizado pero los
								proveedores asignados pueden no estar al tanto del cambio.
							</AlertDescription>
						</Alert>
					)}

					{/* 6. AgencyTransfer notice */}
					{hasAssociatedTransfers && (
						<Alert className="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
							<Info className="size-4 text-blue-600 dark:text-blue-400" />
							<AlertTitle>Traslados asociados</AlertTitle>
							<AlertDescription className="text-xs">
								Este evento tiene {originEvent._count?.transfers ?? 0} traslado(s) asociado(s) que
								deberán actualizarse manualmente.
							</AlertDescription>
						</Alert>
					)}

					{/* 7. Voucher-already-sent notice */}
					{hasVoucherSent && (
						<Alert className="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
							<Info className="size-4 text-blue-600 dark:text-blue-400" />
							<AlertTitle>Vouchers ya enviados</AlertTitle>
							<AlertDescription className="text-xs">
								Los vouchers ya enviados quedarán desactualizados. Podrás reenviarlos desde el detalle
								de la venta.
							</AlertDescription>
						</Alert>
					)}

					{/* 8. Reason textarea */}
					<div className="space-y-1.5">
						<Label htmlFor="reschedule-reason" className="text-sm font-medium">
							Motivo del reagendamiento <span className="text-destructive">*</span>
						</Label>
						<Textarea
							id="reschedule-reason"
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							placeholder="Ej: Cambio de clima, solicitud del cliente..."
							rows={3}
							className="resize-none"
						/>
					</div>

					{/* Server error */}
					{serverError && (
						<p className="text-sm text-destructive">{serverError}</p>
					)}
				</div>

				{/* 9. Footer */}
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => handleOpenChange(false)}
						disabled={isPending}
					>
						Cancelar
					</Button>
					<Button
						onClick={handleConfirm}
						disabled={!canConfirm || (hasProviderConflicts && !overrideProviderConflict)}
					>
						{isPending ? "Reagendando..." : "Confirmar reagendamiento"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
