"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, Users, UserCheck, Car, Loader2, RefreshCw } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { Skeleton } from "@/shared/components/ui/skeleton"
import { ScrollArea } from "@/shared/components/ui/scroll-area"
import { Dialog, DialogContent, DialogTitle } from "@/shared/components/ui/dialog"
import {
	Select,
	SelectItem,
	SelectValue,
	SelectContent,
	SelectTrigger,
} from "@/shared/components/ui/select"

import { useProviders } from "@/project/providers/hooks/use-providers"
import { getEventById, bulkAssignProvider } from "@/project/events/actions/event.actions"
import { getProviderServiceCost } from "./event-detail-utils"
import { EventVouchersSection } from "./event-vouchers-section"
import { ProviderSuggestionBadge } from "./provider-suggestion-badge"
import { aggregateGroupBookings } from "../utils/aggregate-group-bookings"
import type { CollapsedGroupRow } from "../utils/tour-summary-groups"
import type { CalendarViewEvent } from "../types/calendar.types"
import type { ProviderRole } from "../types/provider-assignment.types"
import type { EventSuggestions, ProviderScore } from "../types/auto-assignment.types"

interface GroupAssignmentPanelProps {
	open: boolean
	group: CollapsedGroupRow | null
	calendarEvents: CalendarViewEvent[]
	getEventSuggestions?: (eventId: string) => EventSuggestions | undefined
	getAlternativesForEvent?: (eventId: string, role: ProviderRole) => ProviderScore[]
	onClose: () => void
	onSaved: () => void
}

interface ProviderFormState {
	guideId: string
	driverId: string
	vehicleId: string
	guideCost: number
	driverCost: number
	vehicleCost: number
}

const EMPTY_FORM: ProviderFormState = {
	guideId: "",
	driverId: "",
	vehicleId: "",
	guideCost: 0,
	driverCost: 0,
	vehicleCost: 0,
}

export function GroupAssignmentPanel({
	open,
	group,
	calendarEvents: _calendarEvents,
	getEventSuggestions,
	getAlternativesForEvent: _getAlternativesForEvent,
	onClose,
	onSaved,
}: GroupAssignmentPanelProps) {
	const router = useRouter()
	const queryClient = useQueryClient()
	const { data: providers } = useProviders()

	const [formData, setFormData] = useState<ProviderFormState>(EMPTY_FORM)
	const [isSubmitting, setIsSubmitting] = useState(false)

	// Voucher section state — tracked per event id
	const [openVouchers, setOpenVouchers] = useState<string[]>([])
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const [passengerEdits] = useState<Record<string, any>>({})
	const [savingPassengers] = useState<Record<string, boolean>>({})

	const eventIds = group?.eventIds ?? []
	const isTransfer = group?.serviceKind === "TRANSFER"

	// Fetch all events in the group — Promise.allSettled so partial failures still render
	const groupQueryKey = ["group-events", eventIds.join(",")]
	const { data: loadedEventsRaw, isLoading: isLoadingEvents, isError, error, refetch } = useQuery({
		queryKey: groupQueryKey,
		queryFn: async () => {
			const results = await Promise.allSettled(eventIds.map((id) => getEventById(id)))
			return results.map((r, idx) => ({
				eventId: eventIds[idx]!,
				event: r.status === "fulfilled" ? r.value : null,
				failed: r.status === "rejected",
				reason: r.status === "rejected" ? String((r as PromiseRejectedResult).reason) : null,
			}))
		},
		enabled: open && eventIds.length > 0,
	})

	const allLoaded = !isLoadingEvents && !!loadedEventsRaw
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const loadedEvents: any[] = (loadedEventsRaw ?? []).filter((r) => !r.failed && r.event).map((r) => r.event)
	const failedEventIds = (loadedEventsRaw ?? []).filter((r) => r.failed).map((r) => r.eventId)

	// Booking aggregation (pure — de-duped by id)
	const aggregatedBookings = allLoaded ? aggregateGroupBookings(loadedEvents) : []

	// Provider option lists (mirrors EventProvidersSection logic)
	const guides = (providers ?? []).filter((p) => p.guia && p.isActive)
	const drivers = (providers ?? []).filter((p) => {
		if (!p.isActive) return false
		const isDriver = p.conductor || p.conductorMaquina
		if (isTransfer) return isDriver && (p.transferIn || p.transferOut)
		return isDriver
	})
	const vehicles = (providers ?? []).filter((p) => {
		if (!p.isActive) return false
		const isVehicle = p.maquina || p.conductorMaquina
		if (isTransfer) return isVehicle && (p.transferIn || p.transferOut)
		return isVehicle
	})

	// Suggestions keyed on the FIRST eventId (group shares tourId+date; representative)
	const firstEventId = eventIds[0]
	const suggestions = firstEventId && getEventSuggestions ? getEventSuggestions(firstEventId) : undefined

	const handleProviderChange = (role: "guide" | "driver" | "vehicle", id: string) => {
		const provider = id && id !== "none" ? providers?.find((p) => p.id === id) : undefined
		const cost = provider ? getProviderServiceCost(provider, role) : 0
		setFormData((prev) => ({
			...prev,
			[`${role}Id`]: id === "none" ? "" : id,
			[`${role}Cost`]: cost,
		}))
	}

	const handleCostChange = (field: "guideCost" | "driverCost" | "vehicleCost", value: string) => {
		const parsed = parseFloat(value)
		setFormData((prev) => ({ ...prev, [field]: isNaN(parsed) ? 0 : parsed }))
	}

	const handleSubmit = async () => {
		if (!group) return
		setIsSubmitting(true)
		try {
			const result = await bulkAssignProvider({
				eventIds: group.eventIds,
				guideId: formData.guideId || null,
				driverId: formData.driverId || null,
				vehicleId: formData.vehicleId || null,
				// Use finite-number check so a legitimate 0 cost is preserved (not coerced to undefined)
				guideCost: Number.isFinite(formData.guideCost) ? formData.guideCost : undefined,
				driverCost: Number.isFinite(formData.driverCost) ? formData.driverCost : undefined,
				vehicleCost: Number.isFinite(formData.vehicleCost) ? formData.vehicleCost : undefined,
			})
			if (result.success) {
				toast.success(`Proveedor asignado a ${group.departures} salidas`)
				// M3: Invalidate group-events cache so reopening shows fresh provider data
				await queryClient.invalidateQueries({ queryKey: groupQueryKey })
				router.refresh()
				onSaved()
			} else {
				toast.error(result.error ?? "Error al guardar")
			}
		} catch {
			toast.error("Error al guardar")
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleOpenChange = (open: boolean) => {
		if (!open) onClose()
	}

	if (!group) return null

	const hasDistinctTimes = group.distinctStartTimes.length >= 2

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent data-testid="group-assignment-panel" className="flex max-h-[95vh] max-w-6xl min-w-[90vw] flex-col gap-0 p-0">
				<DialogTitle className="sr-only">Asignación de grupo — {group.displayName}</DialogTitle>

				{/* Header */}
				<div className="flex items-start justify-between border-b p-4">
					<div className="min-w-0 flex-1">
						<p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
							Asignación de grupo · {group.departures} salidas
						</p>
						<h2 className="mt-0.5 truncate text-lg font-bold">{group.displayName}</h2>
						<div className="mt-1 flex items-center gap-3 text-sm">
							<span className="flex items-center gap-1 text-muted-foreground">
								<Users className="h-3.5 w-3.5" />
								<span className="tabular-nums">
									{group.totalPax} / {group.totalCapacity} pax
								</span>
							</span>
							<Badge variant="secondary" className="text-xs">
								{group.departures} {group.departures === 1 ? "salida" : "salidas"}
							</Badge>
							{isTransfer && (
								<Badge variant="outline" className="text-xs">
									Transfer
								</Badge>
							)}
						</div>

						{/* Distinct-times warning */}
						{hasDistinctTimes && (
							<div className="mt-2 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
								<AlertTriangle className="h-3.5 w-3.5 shrink-0" />
								<span>
									este tour tiene {group.distinctStartTimes.length} salidas con horarios distintos
								</span>
							</div>
						)}
					</div>
				</div>

				{/* Two-column layout */}
				<div className="grid min-h-0 flex-1 grid-cols-3 divide-x">
					{/* LEFT COLUMN: Vouchers aggregated per event */}
					{isLoadingEvents ? (
						<div className="col-span-2 space-y-4 overflow-y-auto p-4">
							{/* Loading skeleton */}
							{[1, 2].map((i) => (
								<div key={i} className="space-y-3 rounded-lg border p-4">
									<div className="flex items-center gap-3">
										<Skeleton className="h-5 w-16" />
										<Skeleton className="h-4 w-12" />
										<Skeleton className="h-5 w-32 rounded-full" />
									</div>
									<Skeleton className="h-3 w-48" />
								</div>
							))}
						</div>
					) : isError && loadedEvents.length === 0 ? (
						/* C1: total failure — all events rejected */
						<div className="col-span-2 flex flex-col items-center justify-center gap-3 p-8 text-center">
							<AlertTriangle className="h-8 w-8 text-red-500" />
							<p className="text-sm font-medium">No se pudieron cargar las salidas del grupo</p>
							<p className="text-xs text-muted-foreground">{String(error)}</p>
							<Button variant="outline" size="sm" onClick={() => void refetch()}>
								<RefreshCw className="mr-2 h-3.5 w-3.5" />
								Reintentar
							</Button>
							<Button variant="ghost" size="sm" onClick={onClose}>
								Cerrar
							</Button>
						</div>
					) : (
						<ScrollArea className="col-span-2 h-[60vh]">
							<div className="space-y-4 p-4">
								{/* C1: notices for events that failed to load (partial failure) */}
								{failedEventIds.map((id) => (
									<div key={id} className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
										<AlertTriangle className="h-3.5 w-3.5 shrink-0" />
										<span>No se pudo cargar la salida {id}</span>
									</div>
								))}

								{loadedEvents.map((event, idx) => (
									<div key={event.id ?? idx}>
										{/* Per-event sub-header */}
										<p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
											Salida {idx + 1}
											{event.startTime ? ` · ${event.startTime}` : ""}
										</p>
										{/* H2: readOnly — group panel is for assignment only, not passenger editing */}
										<EventVouchersSection
											event={event}
											openVouchers={openVouchers}
											setOpenVouchers={setOpenVouchers}
											passengerEdits={passengerEdits}
											savingPassengers={savingPassengers}
											handleContactedChange={() => {}}
											handlePassengerChange={() => {}}
											readOnly
										/>
									</div>
								))}

								{loadedEvents.length === 0 && failedEventIds.length === 0 && (
									<p className="text-muted-foreground text-sm">Sin vouchers para este grupo</p>
								)}

								{/* Summary row */}
								{aggregatedBookings.length > 0 && (
									<div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
										Total agregado: <span className="font-semibold text-foreground">{aggregatedBookings.length}</span> vouchers en {group.departures} salidas
									</div>
								)}
							</div>
						</ScrollArea>
					)}

					{/* RIGHT COLUMN: Provider assignment */}
					<ScrollArea className="h-[60vh]">
						<div className="space-y-4 p-4">
							<h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
								<UserCheck className="h-4 w-4" />
								Asignación Operativa
							</h3>

							{/* Guide section — hidden for TRANSFER groups */}
							{!isTransfer && (
								<div data-testid="group-assign-guide-section" className="rounded-lg border">
									<div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
										<UserCheck className="h-4 w-4 text-blue-600" />
										<span className="text-sm font-medium">Guía</span>
										{formData.guideId && (
											<Badge variant="default" className="bg-green-600 text-xs">
												Asignado
											</Badge>
										)}
									</div>
									<div className="space-y-2 p-3">
										<Select
											value={formData.guideId || "none"}
											onValueChange={(v) => handleProviderChange("guide", v)}
										>
											<SelectTrigger className="h-9 w-full">
												<SelectValue placeholder="Seleccionar guía" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="none">Sin asignar</SelectItem>
												{guides.map((g) => {
													const cost = getProviderServiceCost(g, "guide")
													return (
														<SelectItem key={g.id} value={g.id}>
															{g.fullName || g.companyName}
															{cost > 0 && ` - $${cost.toLocaleString()}`}
														</SelectItem>
													)
												})}
											</SelectContent>
										</Select>

										{formData.guideId && formData.guideId !== "none" && (
											<div className="flex items-center gap-2">
												<Label className="w-16 shrink-0 text-xs text-muted-foreground">Costo</Label>
												<Input
													type="number"
													value={formData.guideCost || ""}
													onChange={(e) => handleCostChange("guideCost", e.target.value)}
													className="h-7 text-xs"
													placeholder="0"
												/>
											</div>
										)}

										{!formData.guideId && suggestions && (
											<ProviderSuggestionBadge
												suggestion={suggestions.guide ?? null}
												role="guide"
												onAccept={(id, cost) => {
													handleProviderChange("guide", id)
													setFormData((prev) => ({ ...prev, guideCost: cost }))
												}}
											/>
										)}
									</div>
								</div>
							)}

							{/* Driver section */}
							<div data-testid="group-assign-driver-section" className="rounded-lg border">
								<div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
									<Car className="h-4 w-4 text-purple-600" />
									<span className="text-sm font-medium">Conductor</span>
									{formData.driverId && (
										<Badge variant="default" className="bg-green-600 text-xs">
											Asignado
										</Badge>
									)}
								</div>
								<div className="space-y-2 p-3">
									<Select
										value={formData.driverId || "none"}
										onValueChange={(v) => handleProviderChange("driver", v)}
									>
										<SelectTrigger className="h-9 w-full">
											<SelectValue placeholder="Seleccionar conductor" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="none">Sin asignar</SelectItem>
											{drivers.map((d) => {
												const cost = getProviderServiceCost(d, "driver")
												return (
													<SelectItem key={d.id} value={d.id}>
														{d.fullName || d.companyName}
														{cost > 0 && ` - $${cost.toLocaleString()}`}
													</SelectItem>
												)
											})}
										</SelectContent>
									</Select>

									{formData.driverId && formData.driverId !== "none" && (
										<div className="flex items-center gap-2">
											<Label className="w-16 shrink-0 text-xs text-muted-foreground">Costo</Label>
											<Input
												type="number"
												value={formData.driverCost || ""}
												onChange={(e) => handleCostChange("driverCost", e.target.value)}
												className="h-7 text-xs"
												placeholder="0"
											/>
										</div>
									)}

									{!formData.driverId && suggestions && (
										<ProviderSuggestionBadge
											suggestion={suggestions.driver ?? null}
											role="driver"
											onAccept={(id, cost) => {
												handleProviderChange("driver", id)
												setFormData((prev) => ({ ...prev, driverCost: cost }))
											}}
										/>
									)}
								</div>
							</div>

							{/* Vehicle section */}
							<div className="rounded-lg border">
								<div
									className={cn(
										"flex items-center gap-2 border-b px-3 py-2",
										"bg-muted/30"
									)}
								>
									<Car className="h-4 w-4 text-orange-600" />
									<span className="text-sm font-medium">Vehículo</span>
									{formData.vehicleId && (
										<Badge variant="default" className="bg-green-600 text-xs">
											Asignado
										</Badge>
									)}
								</div>
								<div className="space-y-2 p-3">
									<Select
										value={formData.vehicleId || "none"}
										onValueChange={(v) => handleProviderChange("vehicle", v)}
									>
										<SelectTrigger className="h-9 w-full">
											<SelectValue placeholder="Seleccionar vehículo" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="none">Sin asignar</SelectItem>
											{vehicles.map((v) => {
												const cost = getProviderServiceCost(v, "vehicle")
												return (
													<SelectItem key={v.id} value={v.id}>
														{v.fullName || v.companyName}
														{cost > 0 && ` - $${cost.toLocaleString()}`}
													</SelectItem>
												)
											})}
										</SelectContent>
									</Select>

									{formData.vehicleId && formData.vehicleId !== "none" && (
										<div className="flex items-center gap-2">
											<Label className="w-16 shrink-0 text-xs text-muted-foreground">Costo</Label>
											<Input
												type="number"
												value={formData.vehicleCost || ""}
												onChange={(e) => handleCostChange("vehicleCost", e.target.value)}
												className="h-7 text-xs"
												placeholder="0"
											/>
										</div>
									)}

									{!formData.vehicleId && suggestions && (
										<ProviderSuggestionBadge
											suggestion={suggestions.vehicle ?? null}
											role="vehicle"
											onAccept={(id, cost) => {
												handleProviderChange("vehicle", id)
												setFormData((prev) => ({ ...prev, vehicleCost: cost }))
											}}
										/>
									)}
								</div>
							</div>

							{/* Scope notice */}
							<div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
								La asignación se aplicará a las {group.departures} salidas de forma atómica.
							</div>
						</div>
					</ScrollArea>
				</div>

				{/* Footer */}
				<div className="flex items-center justify-end gap-2 border-t p-4">
					<Button variant="outline" onClick={onClose} disabled={isSubmitting}>
						Cancelar
					</Button>
					<Button data-testid="group-assign-save" onClick={handleSubmit} disabled={isSubmitting}>
						{isSubmitting ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Guardando...
							</>
						) : (
							"Guardar"
						)}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
