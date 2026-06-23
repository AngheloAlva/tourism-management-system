"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
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
	SelectItem,
	SelectValue,
	SelectContent,
	SelectTrigger,
} from "@/shared/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"

import { useProviders } from "@/project/providers/hooks/use-providers"
import { bulkAssignProvider } from "@/project/events/actions/event.actions"
import { useConflictDetection } from "../hooks/use-conflict-detection"
import { getSortableCost, getProviderServiceCost } from "./event-detail-utils"
import type { CalendarViewEvent } from "../types/calendar.types"
import type { ConflictInfo } from "../types/provider-assignment.types"

// --- Provider Role Labels ---

const PROVIDER_ROLE_LABEL = {
	guide: "Guia",
	driver: "Conductor",
	vehicle: "Vehiculo",
} as const

// --- Props ---

interface BulkAssignmentDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	selectedEventIds: Set<string>
	allEvents: CalendarViewEvent[]
	onSuccess: () => void
	/**
	 * When "transfer", the Guía tab is hidden and guide is forced to null on
	 * submit. Mirrors the server-side behaviour in bulkAssignProvider which
	 * already skips guide for TRANSFER events. Defaults to "all".
	 */
	roleScope?: "all" | "transfer"
}

// --- Component ---

export function BulkAssignmentDialog({
	open,
	onOpenChange,
	selectedEventIds,
	allEvents,
	onSuccess,
	roleScope = "all",
}: BulkAssignmentDialogProps) {
	const router = useRouter()
	const { data: providers } = useProviders()
	const { checkBulkConflicts } = useConflictDetection(allEvents)

	const [selectedGuideId, setSelectedGuideId] = useState<string>("")
	const [selectedDriverId, setSelectedDriverId] = useState<string>("")
	const [selectedVehicleId, setSelectedVehicleId] = useState<string>("")
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [conflicts, setConflicts] = useState<ConflictInfo[]>([])
	const [conflictsChecked, setConflictsChecked] = useState(false)

	const selectedEvents = useMemo(
		() => allEvents.filter((e) => selectedEventIds.has(e.id)),
		[allEvents, selectedEventIds]
	)

	const hasTransfers = selectedEvents.some((e) => e.serviceKind === "TRANSFER")
	const allTransfers =
		roleScope === "transfer" || selectedEvents.every((e) => e.serviceKind === "TRANSFER")

	// --- Provider lists ---

	const guides = useMemo(() => {
		const list = providers?.filter((p) => p.guia && p.isActive) ?? []
		return [...list].sort(
			(a, b) =>
				getSortableCost(getProviderServiceCost(a, "guide")) -
				getSortableCost(getProviderServiceCost(b, "guide"))
		)
	}, [providers])

	const drivers = useMemo(
		() =>
			[
				...(providers?.filter((p) => {
					if (!p.isActive) return false
					return p.conductor || p.conductorMaquina
				}) ?? []),
			].sort(
				(a, b) =>
					getSortableCost(getProviderServiceCost(a, "driver")) -
					getSortableCost(getProviderServiceCost(b, "driver"))
			),
		[providers]
	)

	const vehicles = useMemo(
		() =>
			[
				...(providers?.filter((p) => {
					if (!p.isActive) return false
					return p.maquina || p.conductorMaquina
				}) ?? []),
			].sort(
				(a, b) =>
					getSortableCost(getProviderServiceCost(a, "vehicle")) -
					getSortableCost(getProviderServiceCost(b, "vehicle"))
			),
		[providers]
	)

	// --- Conflict detection ---

	const runConflictCheck = useCallback(() => {
		const allConflicts: ConflictInfo[] = []

		if (selectedGuideId && selectedGuideId !== "none") {
			const provider = providers?.find((p) => p.id === selectedGuideId)
			const name = provider?.fullName ?? provider?.companyName ?? ""
			const guideConflicts = checkBulkConflicts(selectedGuideId, "guide", name, selectedEvents)
			allConflicts.push(...guideConflicts)
		}

		if (selectedDriverId && selectedDriverId !== "none") {
			const provider = providers?.find((p) => p.id === selectedDriverId)
			const name = provider?.fullName ?? provider?.companyName ?? ""
			const driverConflicts = checkBulkConflicts(selectedDriverId, "driver", name, selectedEvents)
			allConflicts.push(...driverConflicts)
		}

		if (selectedVehicleId && selectedVehicleId !== "none") {
			const provider = providers?.find((p) => p.id === selectedVehicleId)
			const name = provider?.fullName ?? provider?.companyName ?? ""
			const vehicleConflicts = checkBulkConflicts(selectedVehicleId, "vehicle", name, selectedEvents)
			allConflicts.push(...vehicleConflicts)
		}

		setConflicts(allConflicts)
		setConflictsChecked(true)
		return allConflicts
	}, [selectedGuideId, selectedDriverId, selectedVehicleId, providers, checkBulkConflicts, selectedEvents])

	// --- Submit ---

	const handleSubmit = async (force = false) => {
		if (!force) {
			const foundConflicts = runConflictCheck()
			if (foundConflicts.length > 0) return
		}

		// When roleScope is "transfer" the guide field is hidden but will be forced to null.
		// In that case only driver or vehicle needs to be selected.
		const hasAnySelection =
			roleScope === "transfer"
				? Boolean(selectedDriverId || selectedVehicleId)
				: Boolean(selectedGuideId || selectedDriverId || selectedVehicleId)
		if (!hasAnySelection) {
			toast.error("Selecciona al menos un proveedor para asignar")
			return
		}

		setIsSubmitting(true)

		try {
			// Build the input — only send fields the user actually selected
			const input: Record<string, unknown> = {
				eventIds: Array.from(selectedEventIds),
			}

			// When roleScope is "transfer" the guide tab is hidden — force guide to null
			// so the server always receives an explicit instruction to clear any guide.
			if (roleScope === "transfer") {
				input.guideId = null
			} else if (selectedGuideId) {
				input.guideId = selectedGuideId === "none" ? null : selectedGuideId
				if (selectedGuideId !== "none") {
					const provider = providers?.find((p) => p.id === selectedGuideId)
					input.guideCost = getProviderServiceCost(provider, "guide")
				}
			}

			if (selectedDriverId) {
				input.driverId = selectedDriverId === "none" ? null : selectedDriverId
				if (selectedDriverId !== "none") {
					const provider = providers?.find((p) => p.id === selectedDriverId)
					input.driverCost = getProviderServiceCost(provider, "driver")
				}
			}

			if (selectedVehicleId) {
				input.vehicleId = selectedVehicleId === "none" ? null : selectedVehicleId
				if (selectedVehicleId !== "none") {
					const provider = providers?.find((p) => p.id === selectedVehicleId)
					input.vehicleCost = getProviderServiceCost(provider, "vehicle")
				}
			}

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const result = await bulkAssignProvider(input as any)

			if (result.success) {
				toast.success(`${result.updated} eventos actualizados`)
				resetState()
				onOpenChange(false)
				onSuccess()
				router.refresh()
			} else {
				toast.error(result.error ?? "Error al asignar proveedores")
			}
		} catch {
			toast.error("Error inesperado al asignar proveedores")
		} finally {
			setIsSubmitting(false)
		}
	}

	const resetState = () => {
		setSelectedGuideId("")
		setSelectedDriverId("")
		setSelectedVehicleId("")
		setConflicts([])
		setConflictsChecked(false)
	}

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) resetState()
		onOpenChange(nextOpen)
	}

	// Reset conflict check when provider changes
	const handleGuideChange = (value: string) => {
		setSelectedGuideId(value)
		setConflictsChecked(false)
		setConflicts([])
	}
	const handleDriverChange = (value: string) => {
		setSelectedDriverId(value)
		setConflictsChecked(false)
		setConflicts([])
	}
	const handleVehicleChange = (value: string) => {
		setSelectedVehicleId(value)
		setConflictsChecked(false)
		setConflicts([])
	}

	const formatCost = (cost: number) =>
		cost > 0 ? `$${cost.toLocaleString()}` : ""

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Asignar proveedor</DialogTitle>
					<DialogDescription>
						Asignar proveedor a {selectedEventIds.size}{" "}
						{selectedEventIds.size === 1 ? "evento" : "eventos"}
						{hasTransfers && !allTransfers && " (incluye transfers)"}
					</DialogDescription>
				</DialogHeader>

				<Tabs defaultValue={allTransfers ? "driver" : "guide"} className="w-full">
					<TabsList className="w-full">
						{!allTransfers && (
							<TabsTrigger value="guide" className="flex-1">
								Guia
							</TabsTrigger>
						)}
						<TabsTrigger value="driver" className="flex-1">
							Conductor
						</TabsTrigger>
						<TabsTrigger value="vehicle" className="flex-1">
							Vehiculo
						</TabsTrigger>
					</TabsList>

					{!allTransfers && (
						<TabsContent value="guide" className="mt-3">
							<Select value={selectedGuideId} onValueChange={handleGuideChange}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Seleccionar guia..." />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">Sin guia</SelectItem>
									{guides.map((g) => (
										<SelectItem key={g.id} value={g.id}>
											{g.fullName ?? g.companyName}
											{" "}
											<span className="text-muted-foreground text-xs">
												{formatCost(getProviderServiceCost(g, "guide"))}
											</span>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</TabsContent>
					)}

					<TabsContent value="driver" className="mt-3">
						<Select value={selectedDriverId} onValueChange={handleDriverChange}>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Seleccionar conductor..." />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">Sin conductor</SelectItem>
								{drivers.map((d) => (
									<SelectItem key={d.id} value={d.id}>
										{d.fullName ?? d.companyName}
										{" "}
										<span className="text-muted-foreground text-xs">
											{formatCost(getProviderServiceCost(d, "driver"))}
										</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</TabsContent>

					<TabsContent value="vehicle" className="mt-3">
						<Select value={selectedVehicleId} onValueChange={handleVehicleChange}>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Seleccionar vehiculo..." />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">Sin vehiculo</SelectItem>
								{vehicles.map((v) => (
									<SelectItem key={v.id} value={v.id}>
										{v.fullName ?? v.companyName}
										{" "}
										<span className="text-muted-foreground text-xs">
											{formatCost(getProviderServiceCost(v, "vehicle"))}
										</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</TabsContent>
				</Tabs>

				{/* Conflict warnings */}
				{conflictsChecked && conflicts.length > 0 && (
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
							<AlertTriangle className="h-4 w-4" />
							{conflicts.length} {conflicts.length === 1 ? "conflicto detectado" : "conflictos detectados"}
						</div>
						<div className="max-h-[200px] space-y-1.5 overflow-y-auto">
							{conflicts.map((conflict, index) => (
								<div
									key={`${conflict.conflictingEvent.id}-${index}`}
									className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs dark:border-amber-500/30 dark:bg-amber-500/10"
								>
									<p className="font-medium">
										{PROVIDER_ROLE_LABEL[conflict.providerType]}: {conflict.providerName}
									</p>
									<p className="text-muted-foreground">
										Conflicto con &quot;{conflict.conflictingEvent.tourName}&quot;
										{conflict.conflictingEvent.startTime &&
											` (${conflict.conflictingEvent.startTime}${conflict.conflictingEvent.endTime ? ` – ${conflict.conflictingEvent.endTime}` : ""})`}
									</p>
								</div>
							))}
						</div>
					</div>
				)}

				<DialogFooter className="gap-2 sm:gap-0">
					<Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
						Cancelar
					</Button>

					{conflictsChecked && conflicts.length > 0 ? (
						<Button
							onClick={() => handleSubmit(true)}
							disabled={isSubmitting}
							className="bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700"
						>
							{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Asignar de todos modos
						</Button>
					) : (
						<Button onClick={() => handleSubmit(false)} disabled={isSubmitting}>
							{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Asignar
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
