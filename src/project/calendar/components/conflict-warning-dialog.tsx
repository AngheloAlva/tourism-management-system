import { format } from "date-fns"
import { es } from "date-fns/locale"
import { AlertTriangle } from "lucide-react"

import { Button } from "@/shared/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog"

import type { ConflictInfo } from "../types/provider-assignment.types"

// --- Provider Role Labels ---

const PROVIDER_ROLE_LABEL = {
	guide: "Guía",
	driver: "Conductor",
	vehicle: "Vehículo",
} as const

// --- Props ---

interface ConflictWarningDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	conflicts: ConflictInfo[]
	onConfirm: () => void
	onCancel: () => void
}

// --- Helpers ---

function formatTimeRange(startTime: string | null, endTime: string | null): string {
	if (!startTime && !endTime) return "Sin hora definida"
	if (startTime && endTime) return `${startTime} – ${endTime}`
	if (startTime) return `Desde ${startTime}`
	return `Hasta ${endTime}`
}

function formatConflictDate(date: Date): string {
	return format(new Date(date), "EEEE d 'de' MMMM", { locale: es })
}

// --- Component ---

export function ConflictWarningDialog({
	open,
	onOpenChange,
	conflicts,
	onConfirm,
	onCancel,
}: ConflictWarningDialogProps) {
	if (conflicts.length === 0) return null

	const firstConflict = conflicts[0]
	const providerLabel = PROVIDER_ROLE_LABEL[firstConflict.providerType] ?? firstConflict.providerType

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20">
						<AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
					</div>
					<DialogTitle className="text-center">Conflicto de asignación</DialogTitle>
					<DialogDescription className="text-center">
						{firstConflict.providerName
							? `${providerLabel} "${firstConflict.providerName}" ya está asignado/a en otro evento que se superpone.`
							: `El ${providerLabel.toLowerCase()} seleccionado ya está asignado/a en otro evento que se superpone.`}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-2">
					{conflicts.map((conflict, index) => (
						<div
							key={`${conflict.conflictingEvent.id}-${index}`}
							className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10"
						>
							<p className="text-sm font-medium">
								{conflict.conflictingEvent.tourName}
							</p>
							<p className="text-muted-foreground mt-0.5 text-xs capitalize">
								{formatConflictDate(conflict.conflictingEvent.date)}
							</p>
							<p className="text-muted-foreground text-xs">
								{formatTimeRange(
									conflict.conflictingEvent.startTime,
									conflict.conflictingEvent.endTime
								)}
							</p>
						</div>
					))}
				</div>

				<DialogFooter className="gap-2 sm:gap-0">
					<Button variant="outline" onClick={onCancel}>
						Cancelar
					</Button>
					<Button
						variant="default"
						className="bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700"
						onClick={onConfirm}
					>
						Asignar de todos modos
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
