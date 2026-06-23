"use client"

import { CalendarIcon, Clock, User, Car, DollarSign, Save } from "lucide-react"
import { useRouter } from "next/navigation"
import { formatCalendarDay } from "@/shared/utils/calendar-day"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { useProviders } from "@/project/providers/hooks/use-providers"
import { getEventById, updateEvent } from "@/project/events/actions/event.actions"
import { getEventDisplayName } from "@/project/events/utils/event-display"
import { cn } from "@/lib/utils"

import { Checkbox } from "@/shared/components/ui/checkbox"

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Separator } from "@/shared/components/ui/separator"
import { Textarea } from "@/shared/components/ui/textarea"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { BookingManager } from "./booking-manager"
import {
	Select,
	SelectItem,
	SelectValue,
	SelectTrigger,
	SelectContent,
} from "@/shared/components/ui/select"

import type { UpdateEventSchema } from "../schemas/update-event.schema"
import type { EVENT_STATUS } from "@/generated/prisma/client"
import type { ProviderWithCatering } from "@/project/providers/actions/provider.actions"

interface EventDetailFormProps {
	event: Awaited<ReturnType<typeof getEventById>>
	onCancel?: () => void
	onSuccess?: () => void
}

export function EventDetailForm({ event, onCancel, onSuccess }: EventDetailFormProps) {
	const [isSubmitting, setIsSubmitting] = useState(false)
	const router = useRouter()
	const { data: providers } = useProviders()

	const [formData, setFormData] = useState<UpdateEventSchema>({
		// CANCELLED is not a valid status for updateEvent — exclude it from initial state
		status: event?.status === "CANCELLED" ? undefined : event?.status,
		isCompleted: false,
		startTime: event?.startTime || "",
		endTime: event?.endTime || "",
		guideId: event?.guideId || "",
		driverId: event?.driverId || "",
		vehicleId: event?.vehicleId || "",
		cateringProviderId: event?.cateringProviderId || "",
		cateringCost: event?.cateringCost || 0,
		cateringSelection: event?.cateringSelection || [],
		comments: event?.comments || "",
		operationalNotes: event?.operationalNotes || "",
		cateringNotes: event?.cateringNotes || "",
		guideCost: event?.guideCost || 0,
		driverCost: event?.driverCost || 0,
		vehicleCost: event?.vehicleCost || 0,
	})

	const isTransfer = event?.serviceKind === "TRANSFER"

	const getSortableCost = (cost?: number | null) =>
		cost && cost > 0 ? cost : Number.POSITIVE_INFINITY

	const getProviderServiceCost = (
		provider: ProviderWithCatering | undefined,
		type: "guide" | "driver" | "vehicle"
	) => {
		if (!provider) return 0
		if (type === "guide") return provider.guideCost || provider.costPerDay || 0
		if (type === "driver") return provider.driverCost || provider.costPerDay || 0
		return provider.vehicleCost || provider.costPerDay || 0
	}

	const guides = useMemo(() => {
		const list = providers?.filter((p) => p.guia && p.isActive) || []
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
					const isDriver = p.conductor || p.conductorMaquina
					if (isTransfer) {
						return isDriver && (p.transferIn || p.transferOut)
					}
					return isDriver
				}) || []),
			].sort(
				(a, b) =>
					getSortableCost(getProviderServiceCost(a, "driver")) -
					getSortableCost(getProviderServiceCost(b, "driver"))
			),
		[providers, isTransfer]
	)

	const vehicles = useMemo(
		() =>
			[
				...(providers?.filter((p) => {
					if (!p.isActive) return false
					const isVehicle = p.maquina || p.conductorMaquina
					if (isTransfer) {
						return isVehicle && (p.transferIn || p.transferOut)
					}
					return isVehicle
				}) || []),
			].sort(
				(a, b) =>
					getSortableCost(getProviderServiceCost(a, "vehicle")) -
					getSortableCost(getProviderServiceCost(b, "vehicle"))
			),
		[providers, isTransfer]
	)

	const handleProviderChange = (type: "guide" | "driver" | "vehicle", id: string) => {
		const updates: Partial<UpdateEventSchema> = { [`${type}Id`]: id }

		if (id && id !== "none") {
			const provider = providers?.find((p) => p.id === id)
			const providerCost = getProviderServiceCost(provider, type)

			if (providerCost > 0) {
				if (type === "guide") updates.guideCost = providerCost
				if (type === "driver") updates.driverCost = providerCost
				if (type === "vehicle") updates.vehicleCost = providerCost
			}
		} else if (id === "none") {
			updates[`${type}Id`] = ""
		}

		setFormData((prev) => ({ ...prev, ...updates }))
	}

	const selectedProvider = providers?.find((p) => p.id === formData.cateringProviderId)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setIsSubmitting(true)
		try {
			const result = await updateEvent(event?.id || "", formData)
			if (result.success) {
				toast.success("Evento actualizado correctamente")
				if (onSuccess) {
					onSuccess()
				}
				router.refresh()
			} else {
				toast.error(result.error || "Error al actualizar el evento")
			}
		} finally {
			setIsSubmitting(false)
		}
	}

	const getStatusColor = (status: EVENT_STATUS) => {
		switch (status) {
			case "CONFIRMED":
				return "bg-green-100 text-green-800 border-green-200"
			case "SCHEDULED":
				return "bg-blue-100 text-blue-800 border-blue-200"
			case "IN_PROGRESS":
				return "bg-purple-100 text-purple-800 border-purple-200"
			case "COMPLETED":
				return "bg-gray-100 text-gray-800 border-gray-200"
			case "CANCELLED":
				return "bg-red-100 text-red-800 border-red-200"
			case "TRANSFERRED":
				return "bg-orange-100 text-orange-800 border-orange-200"
			default:
				return "bg-gray-100 text-gray-800"
		}
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-5">
			<Card className="border-l-primary border-l-4">
				<CardContent>
					<div className="grid grid-cols-1 gap-6 md:grid-cols-4">
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm font-medium">Tour</p>
							<p className="text-lg font-bold">{event ? getEventDisplayName(event) : "Transfer"}</p>
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm font-medium">Fecha</p>
							<div className="flex items-center gap-2">
								<CalendarIcon className="text-muted-foreground size-4 min-w-4" />
								<span className="font-medium">
									{event?.date ? formatCalendarDay(event.date, "dd/MM/yyyy") : ""}
								</span>
							</div>
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm font-medium">Horario</p>
							<div className="flex items-center gap-2">
								<Clock className="text-muted-foreground size-4 min-w-4" />

								<div className="flex items-center gap-2">
									<Input
										className="w-20"
										placeholder="Inicio"
										value={formData.startTime || ""}
										onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
									/>
									<span>-</span>
									<Input
										className="w-20"
										placeholder="Fin"
										value={formData.endTime || ""}
										onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
									/>
								</div>
							</div>
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm font-medium">Estado</p>
							<Select
								onValueChange={(val) => setFormData({ ...formData, status: val as UpdateEventSchema["status"] })}
								defaultValue={event?.status !== "CANCELLED" ? event?.status : undefined}
							>
								<SelectTrigger
									className={cn(
										"w-full font-medium",
										getStatusColor(formData.status as EVENT_STATUS)
									)}
								>
									<SelectValue placeholder="Estado" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="SCHEDULED">Programado</SelectItem>
									<SelectItem value="CONFIRMED">Confirmado</SelectItem>
									<SelectItem value="IN_PROGRESS">En Progreso</SelectItem>
									<SelectItem value="COMPLETED">Completado</SelectItem>
									<SelectItem value="TRANSFERRED">Traspasado</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</CardContent>
			</Card>

			<div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
				<Card className="flex h-full flex-col gap-2 pt-0">
					<CardHeader className="bg-muted/30 flex items-center py-3">
						<div className="flex items-center gap-2">
							<div className="rounded-full bg-blue-100 p-2 text-blue-600">
								<User className="h-5 w-5" />
							</div>
							<CardTitle className="text-lg">Guía</CardTitle>
						</div>
					</CardHeader>

					<CardContent className="flex-1 space-y-4">
						<div className="space-y-2">
							<label className="text-sm font-medium">Seleccionar Guía</label>
							<Select
								value={formData.guideId || "none"}
								onValueChange={(val) => handleProviderChange("guide", val)}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Seleccionar guía..." />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">Sin asignar</SelectItem>
									{guides.map((guide) => {
										const guideCost = getProviderServiceCost(guide, "guide")
										return (
											<SelectItem key={guide.id} value={guide.id}>
												{guide.fullName || guide.companyName}
												{guideCost > 0 && ` - $${guideCost.toLocaleString()}`}
											</SelectItem>
										)
									})}
								</SelectContent>
							</Select>
						</div>

						{formData.guideId && (
							<div className="bg-muted space-y-1 rounded-md p-3 text-sm">
								<p>
									<span className="font-medium">Teléfono:</span>{" "}
									{providers?.find((p) => p.id === formData.guideId)?.phone || "-"}
								</p>
								<p>
									<span className="font-medium">Email:</span>{" "}
									{providers?.find((p) => p.id === formData.guideId)?.email || "-"}
								</p>
							</div>
						)}

						<Separator />

						<div className="space-y-2">
							<label className="flex items-center gap-2 text-sm font-medium">
								<DollarSign className="h-4 w-4" /> Costo Servicio
							</label>
							<Input
								type="number"
								value={formData.guideCost || 0}
								onChange={(e) =>
									setFormData({ ...formData, guideCost: parseFloat(e.target.value) || 0 })
								}
								className="font-mono"
							/>
						</div>
					</CardContent>
				</Card>

				<Card className="flex h-full flex-col gap-2 pt-0">
					<CardHeader className="bg-muted/30 flex items-center py-3">
						<div className="flex items-center gap-2">
							<div className="rounded-full bg-green-100 p-2 text-green-600">
								<User className="h-5 w-5" />
							</div>
							<CardTitle className="text-lg">Conductor</CardTitle>
						</div>
					</CardHeader>
					<CardContent className="flex-1 space-y-4">
						<div className="space-y-2">
							<label className="text-sm font-medium">Seleccionar Conductor</label>
							<Select
								value={formData.driverId || "none"}
								onValueChange={(val) => handleProviderChange("driver", val)}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Seleccionar conductor..." />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">Sin asignar</SelectItem>
									{drivers.map((driver) => {
										const driverCost = getProviderServiceCost(driver, "driver")
										return (
											<SelectItem key={driver.id} value={driver.id}>
												{driver.fullName || driver.companyName}
												{driverCost > 0 && ` - $${driverCost.toLocaleString()}`}
											</SelectItem>
										)
									})}
								</SelectContent>
							</Select>
						</div>

						{formData.driverId && (
							<div className="bg-muted space-y-1 rounded-md p-3 text-sm">
								<p>
									<span className="font-medium">Teléfono:</span>{" "}
									{providers?.find((p) => p.id === formData.driverId)?.phone || "-"}
								</p>
								<p>
									<span className="font-medium">Licencia:</span>{" "}
									{providers?.find((p) => p.id === formData.driverId)?.licenseType || "-"}
								</p>
							</div>
						)}

						<Separator />

						<div className="space-y-2">
							<label className="flex items-center gap-2 text-sm font-medium">
								<DollarSign className="h-4 w-4" /> Costo Servicio
							</label>
							<Input
								type="number"
								value={formData.driverCost || 0}
								onChange={(e) =>
									setFormData({ ...formData, driverCost: parseFloat(e.target.value) || 0 })
								}
								className="font-mono"
							/>
						</div>
					</CardContent>
				</Card>

				<Card className="flex h-full flex-col gap-2 pt-0">
					<CardHeader className="bg-muted/30 flex items-center py-3">
						<div className="flex items-center gap-2">
							<div className="rounded-full bg-orange-100 p-2 text-orange-600">
								<Car className="h-5 w-5" />
							</div>
							<CardTitle className="text-lg">Vehículo</CardTitle>
						</div>
					</CardHeader>
					<CardContent className="flex-1 space-y-4">
						<div className="space-y-2">
							<label className="text-sm font-medium">Seleccionar Vehículo</label>
							<Select
								value={formData.vehicleId || "none"}
								onValueChange={(val) => handleProviderChange("vehicle", val)}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Seleccionar vehículo..." />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">Sin asignar</SelectItem>
									{vehicles.map((vehicle) => {
										const vehicleCost = getProviderServiceCost(vehicle, "vehicle")
										return (
											<SelectItem key={vehicle.id} value={vehicle.id}>
												{vehicle.vehicleBrand} {vehicle.vehicleModel} - {vehicle.vehiclePlate}
												{vehicleCost > 0 && ` - $${vehicleCost.toLocaleString()}`}
											</SelectItem>
										)
									})}
								</SelectContent>
							</Select>
						</div>

						{formData.vehicleId && (
							<div className="bg-muted space-y-1 rounded-md p-3 text-sm">
								<p>
									<span className="font-medium">Patente:</span>{" "}
									{providers?.find((p) => p.id === formData.vehicleId)?.vehiclePlate || "-"}
								</p>
								<p>
									<span className="font-medium">Capacidad:</span>{" "}
									{providers?.find((p) => p.id === formData.vehicleId)?.vehicleCapacity || "-"} pax
								</p>
							</div>
						)}

						<Separator />

						<div className="space-y-2">
							<label className="flex items-center gap-2 text-sm font-medium">
								<DollarSign className="h-4 w-4" /> Costo Servicio
							</label>
							<Input
								type="number"
								value={formData.vehicleCost || 0}
								onChange={(e) =>
									setFormData({ ...formData, vehicleCost: parseFloat(e.target.value) || 0 })
								}
								className="font-mono"
							/>
						</div>
					</CardContent>
				</Card>
			</div>

			<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
				<Card className="gap-2">
					<CardHeader>
						<CardTitle>Catering y Alimentación</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-4">
							<div className="space-y-2">
								<label className="text-sm font-medium">Proveedor de Catering</label>
								<Select
									value={formData.cateringProviderId || "none"}
									onValueChange={(val) => {
										// Reset selection when provider changes
										setFormData({
											...formData,
											cateringProviderId: val === "none" ? "" : val,
											cateringSelection: [],
											cateringCost: 0,
										})
									}}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Seleccionar catering..." />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">Sin asignar</SelectItem>
										{providers
											?.filter((p) => p.cocteleria && p.isActive)
											.map((provider) => (
												<SelectItem key={provider.id} value={provider.id}>
													{provider.companyName || provider.fullName}
												</SelectItem>
											))}
									</SelectContent>
								</Select>
							</div>

							{/* Catering Options Selection */}
							{selectedProvider?.catering && selectedProvider.catering.length > 0 && (
								<div className="space-y-2 rounded-md border p-3">
									<label className="text-muted-foreground text-xs font-semibold uppercase">
										Opciones de Menú
									</label>
									<div className="space-y-2">
										{selectedProvider.catering.map((catOption) => {
											const isSelected = (formData?.cateringSelection || [])?.some(
												// eslint-disable-next-line @typescript-eslint/no-explicit-any
												(s: any) => s.id === catOption.cateringOption.id
											)
											return (
												<div
													key={catOption.id}
													className="flex items-center justify-between space-x-2"
												>
													<div className="flex items-center space-x-2">
														<Checkbox
															id={`opt-${catOption.id}`}
															checked={isSelected}
															onCheckedChange={(checked) => {
																// eslint-disable-next-line @typescript-eslint/no-explicit-any
																const currentSelection = (formData.cateringSelection as any[]) || []
																let newSelection
																let newCost = formData.cateringCost || 0

																if (checked) {
																	newSelection = [
																		...currentSelection,
																		{
																			id: catOption.cateringOption.id,
																			name: catOption.cateringOption.name,
																			price: catOption.pricePerPerson,
																		},
																	]
																	newCost += catOption.pricePerPerson
																} else {
																	newSelection = currentSelection.filter(
																		(s) => s.id !== catOption.cateringOption.id
																	)
																	newCost -= catOption.pricePerPerson
																}

																setFormData({
																	...formData,
																	cateringSelection: newSelection,
																	cateringCost: Math.max(0, newCost), // Ensure no negative cost
																})
															}}
														/>
														<label
															htmlFor={`opt-${catOption.id}`}
															className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
														>
															{catOption.cateringOption.name}
														</label>
													</div>
													<span className="text-muted-foreground text-sm">
														${catOption.pricePerPerson.toLocaleString()} pp
													</span>
												</div>
											)
										})}
									</div>
								</div>
							)}

							<div className="space-y-2">
								<label className="text-sm font-medium">Costo Catering (Total)</label>
								<Input
									type="number"
									value={formData.cateringCost || 0}
									onChange={(e) =>
										setFormData({ ...formData, cateringCost: parseFloat(e.target.value) || 0 })
									}
								/>
								<p className="text-muted-foreground text-xs">
									* Se actualiza automáticamente al seleccionar opciones, pero puede editarse
									manualmente.
								</p>
							</div>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium">Notas de Catering</label>
							<Textarea
								value={formData.cateringNotes || ""}
								onChange={(e) => setFormData({ ...formData, cateringNotes: e.target.value })}
								placeholder="Detalles del menú, dietas especiales, etc."
								className="min-h-[100px]"
							/>
						</div>
					</CardContent>
				</Card>

				<Card className="gap-2">
					<CardHeader>
						<CardTitle>Notas Operacionales</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<label className="text-sm font-medium">Comentarios Generales</label>
							<Textarea
								value={formData.comments || ""}
								onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
								placeholder="Comentarios visibles para administración"
								className="min-h-[100px]"
							/>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium">Instrucciones Operativas</label>
							<Textarea
								value={formData.operationalNotes || ""}
								onChange={(e) => setFormData({ ...formData, operationalNotes: e.target.value })}
								placeholder="Instrucciones específicas para el equipo operativo"
								className="min-h-[100px]"
							/>
						</div>
					</CardContent>
				</Card>
			</div>

			<div className="grid grid-cols-1">
				<BookingManager
					eventId={event?.id || ""}
					tourId={event?.tour?.id || ""}
					bookings={
						event?.bookings?.map((b) => ({
							id: b.id,
							passengerCount: b.passengerCount,
							saleRecord: b.saleRecord,
						})) || []
					}
					onUpdate={() => router.refresh()}
				/>
			</div>

			<div className="flex items-center justify-end gap-2">
				<Button
					type="button"
					variant="outline"
					onClick={() => (onCancel ? onCancel() : router.back())}
				>
					Cancelar
				</Button>
				<Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-orange-600">
					<Save className="h-4 w-4" />
					{isSubmitting ? "Guardando..." : "Guardar Cambios"}
				</Button>
			</div>
		</form>
	)
}
