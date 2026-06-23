import { useMemo } from "react"
import {
	Car,
	Mail,
	User,
	Phone,
	Users,
	Utensils,
	FileText,
	UserCheck,
	DollarSign,
	ChevronDown,
	AlertTriangle,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/shared/components/ui/scroll-area"
import { Separator } from "@/shared/components/ui/separator"
import { Textarea } from "@/shared/components/ui/textarea"
import { Checkbox } from "@/shared/components/ui/checkbox"
import { Badge } from "@/shared/components/ui/badge"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/shared/components/ui/collapsible"
import {
	Select,
	SelectItem,
	SelectValue,
	SelectContent,
	SelectTrigger,
} from "@/shared/components/ui/select"

import { getSortableCost, getProviderServiceCost, getMinCateringCost } from "./event-detail-utils"
import { EventAuditLogSection } from "./event-audit-log-section"
import { ProviderSuggestionBadge } from "./provider-suggestion-badge"
import type { EventFormData, ProviderWithCatering } from "./event-detail-types"
import type { EventSuggestions, ProviderScore } from "../types/auto-assignment.types"

interface EventProvidersSectionProps {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	event: any
	formData: EventFormData
	setFormData: React.Dispatch<React.SetStateAction<EventFormData>>
	providers: ProviderWithCatering[] | undefined
	isTransfer: boolean
	openProviders: string[]
	setOpenProviders: React.Dispatch<React.SetStateAction<string[]>>
	totalRevenue: number
	totalCost: number
	profit: number
	profitMargin: number
	handleProviderChange: (type: "guide" | "driver" | "vehicle", id: string) => void
	totalPassengers: number
	suggestions?: EventSuggestions
	getAlternatives?: (eventId: string, role: "guide" | "driver" | "vehicle") => ProviderScore[]
}

export function EventProvidersSection({
	event,
	formData,
	setFormData,
	providers,
	isTransfer,
	openProviders,
	setOpenProviders,
	totalRevenue,
	totalCost,
	profit,
	profitMargin,
	handleProviderChange,
	totalPassengers,
	suggestions,
	getAlternatives,
}: EventProvidersSectionProps) {
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
					if (isTransfer) return isDriver && (p.transferIn || p.transferOut)
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
					if (isTransfer) return isVehicle && (p.transferIn || p.transferOut)
					return isVehicle
				}) || []),
			].sort(
				(a, b) =>
					getSortableCost(getProviderServiceCost(a, "vehicle")) -
					getSortableCost(getProviderServiceCost(b, "vehicle"))
			),
		[providers, isTransfer]
	)

	const cateringProviders = useMemo(
		() =>
			[...(providers?.filter((p) => p.cocteleria && p.isActive) || [])].sort(
				(a, b) => getMinCateringCost(a) - getMinCateringCost(b)
			),
		[providers]
	)

	const selectedCateringProvider = providers?.find((p) => p.id === formData.cateringProviderId)
	const selectedGuide = providers?.find((p) => p.id === formData.guideId)
	const selectedDriver = providers?.find((p) => p.id === formData.driverId)
	const selectedVehicle = providers?.find((p) => p.id === formData.vehicleId)

	return (
		<ScrollArea className="h-[60vh]">
			<div className="space-y-3 p-4">
				<h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
					<Users className="h-4 w-4" />
					Asignación Operativa
				</h3>

				{/* Guide Section */}
				{!isTransfer && (
					<Collapsible
						open={openProviders.includes("guide")}
						onOpenChange={(open) =>
							setOpenProviders((prev) =>
								open ? [...prev, "guide"] : prev.filter((id) => id !== "guide")
							)
						}
					>
						<div className="rounded-lg border">
							<CollapsibleTrigger className="hover:bg-muted/50 flex w-full items-center justify-between p-3">
								<div className="flex items-center gap-2">
									<UserCheck className="h-4 w-4 text-blue-600" />
									<span className="font-medium">Guía</span>
									{formData.guideId && (
										<Badge variant="default" className="bg-green-600 text-xs">
											Asignado
										</Badge>
									)}
								</div>
								<ChevronDown
									className={cn(
										"h-4 w-4 transition-transform",
										openProviders.includes("guide") && "rotate-180"
									)}
								/>
							</CollapsibleTrigger>
							<CollapsibleContent>
								<div className="space-y-3 border-t p-3">
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
												const guideCost = getProviderServiceCost(g, "guide")
												return (
													<SelectItem key={g.id} value={g.id}>
														{g.fullName || g.companyName}
														{guideCost > 0 && ` - $${guideCost.toLocaleString()}`}
													</SelectItem>
												)
											})}
										</SelectContent>
									</Select>

									{/* Suggestion badge for unassigned guide */}
									{!formData.guideId && suggestions && (
										<ProviderSuggestionBadge
											suggestion={suggestions.guide}
											alternatives={getAlternatives?.(event.id, "guide")}
											onAccept={(providerId, defaultCost) => {
												handleProviderChange("guide", providerId)
											}}
											role="guide"
										/>
									)}

									{formData.guideId && (
										<div className="flex items-center gap-2">
											<Label className="text-xs">Costo:</Label>
											<div className="relative flex-1">
												<span className="text-muted-foreground absolute top-1/2 left-2 -translate-y-1/2 text-xs">
													$
												</span>
												<Input
													type="number"
													value={formData.guideCost}
													className="h-8 pl-5 text-xs"
													onChange={(e) =>
														setFormData((p) => ({ ...p, guideCost: +e.target.value }))
													}
												/>
											</div>
										</div>
									)}

									{/* Guide Details Card */}
									{selectedGuide && (
										<div className="bg-muted/30 rounded-md p-2 text-xs">
											<div className="grid grid-cols-2 gap-1">
												{selectedGuide.phone && (
													<div className="flex items-center gap-1">
														<Phone className="h-3 w-3" />
														{selectedGuide.phone}
													</div>
												)}
												{selectedGuide.email && (
													<div className="flex items-center gap-1">
														<Mail className="h-3 w-3" />
														{selectedGuide.email}
													</div>
												)}
											</div>
										</div>
									)}
								</div>
							</CollapsibleContent>
						</div>
					</Collapsible>
				)}

				{/* Driver Section */}
				<Collapsible
					open={openProviders.includes("driver")}
					onOpenChange={(open) =>
						setOpenProviders((prev) =>
							open ? [...prev, "driver"] : prev.filter((id) => id !== "driver")
						)
					}
				>
					<div className="rounded-lg border">
						<CollapsibleTrigger className="hover:bg-muted/50 flex w-full items-center justify-between p-3">
							<div className="flex items-center gap-2">
								<User className="h-4 w-4 text-orange-600" />
								<span className="font-medium">Conductor</span>
								{formData.driverId && (
									<Badge variant="default" className="bg-green-600 text-xs">
										Asignado
									</Badge>
								)}
							</div>
							<ChevronDown
								className={cn(
									"h-4 w-4 transition-transform",
									openProviders.includes("driver") && "rotate-180"
								)}
							/>
						</CollapsibleTrigger>
						<CollapsibleContent>
							<div className="space-y-3 border-t p-3">
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
											const driverCost = getProviderServiceCost(d, "driver")
											return (
												<SelectItem key={d.id} value={d.id}>
													{d.fullName || d.companyName}
													{driverCost > 0 && ` - $${driverCost.toLocaleString()}`}
												</SelectItem>
											)
										})}
									</SelectContent>
								</Select>

								{/* Suggestion badge for unassigned driver */}
								{!formData.driverId && suggestions && (
									<ProviderSuggestionBadge
										suggestion={suggestions.driver}
										alternatives={getAlternatives?.(event.id, "driver")}
										onAccept={(providerId, defaultCost) => {
											handleProviderChange("driver", providerId)
										}}
										role="driver"
									/>
								)}

								{formData.driverId && (
									<div className="flex items-center gap-2">
										<Label className="text-xs">Costo:</Label>
										<div className="relative flex-1">
											<span className="text-muted-foreground absolute top-1/2 left-2 -translate-y-1/2 text-xs">
												$
											</span>
											<Input
												type="number"
												value={formData.driverCost}
												className="h-8 pl-5 text-xs"
												onChange={(e) =>
													setFormData((p) => ({ ...p, driverCost: +e.target.value }))
												}
											/>
										</div>
									</div>
								)}

								{selectedDriver && (
									<div className="bg-muted/30 rounded-md p-2 text-xs">
										<div className="grid grid-cols-2 gap-1">
											{selectedDriver.phone && (
												<div className="flex items-center gap-1">
													<Phone className="h-3 w-3" />
													{selectedDriver.phone}
												</div>
											)}
											{selectedDriver.licenseType && (
												<div className="flex items-center gap-1">
													<FileText className="h-3 w-3" />
													Licencia: {selectedDriver.licenseType}
												</div>
											)}
										</div>
									</div>
								)}
							</div>
						</CollapsibleContent>
					</div>
				</Collapsible>

				{/* Vehicle Section */}
				<Collapsible
					open={openProviders.includes("vehicle")}
					onOpenChange={(open) =>
						setOpenProviders((prev) =>
							open ? [...prev, "vehicle"] : prev.filter((id) => id !== "vehicle")
						)
					}
				>
					<div className="rounded-lg border">
						<CollapsibleTrigger className="hover:bg-muted/50 flex w-full items-center justify-between p-3">
							<div className="flex items-center gap-2">
								<Car className="h-4 w-4 text-purple-600" />
								<span className="font-medium">Vehículo</span>
								{formData.vehicleId && (
									<Badge variant="default" className="bg-green-600 text-xs">
										Asignado
									</Badge>
								)}
							</div>
							<ChevronDown
								className={cn(
									"h-4 w-4 transition-transform",
									openProviders.includes("vehicle") && "rotate-180"
								)}
							/>
						</CollapsibleTrigger>
						<CollapsibleContent>
							<div className="space-y-3 border-t p-3">
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
											const vehicleCost = getProviderServiceCost(v, "vehicle")
											return (
												<SelectItem key={v.id} value={v.id}>
													{v.vehicleBrand} {v.vehicleModel} ({v.vehiclePlate}) -{" "}
													{v.vehicleCapacity} pax
													{vehicleCost > 0 && ` - $${vehicleCost.toLocaleString()}`}
												</SelectItem>
											)
										})}
									</SelectContent>
								</Select>

								{/* Suggestion badge for unassigned vehicle */}
								{!formData.vehicleId && suggestions && (
									<ProviderSuggestionBadge
										suggestion={suggestions.vehicle}
										alternatives={getAlternatives?.(event.id, "vehicle")}
										onAccept={(providerId, defaultCost) => {
											handleProviderChange("vehicle", providerId)
										}}
										role="vehicle"
									/>
								)}

								{/* Capacity Warning */}
								{selectedVehicle &&
									selectedVehicle.vehicleCapacity != null &&
									totalPassengers > 0 &&
									selectedVehicle.vehicleCapacity < totalPassengers && (
										<div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 dark:border-amber-500/40 dark:bg-amber-500/10">
											<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
											<span className="text-xs text-amber-700 dark:text-amber-300">
												Capacidad insuficiente: {selectedVehicle.vehicleCapacity} pax / {totalPassengers} pasajeros
											</span>
										</div>
									)}

								{formData.vehicleId && (
									<div className="flex items-center gap-2">
										<Label className="text-xs">Costo:</Label>
										<div className="relative flex-1">
											<span className="text-muted-foreground absolute top-1/2 left-2 -translate-y-1/2 text-xs">
												$
											</span>
											<Input
												type="number"
												value={formData.vehicleCost}
												className="h-8 pl-5 text-xs"
												onChange={(e) =>
													setFormData((p) => ({
														...p,
														vehicleCost: +e.target.value,
													}))
												}
											/>
										</div>
									</div>
								)}

								{selectedVehicle && (
									<div className="bg-muted/30 rounded-md p-2 text-xs">
										<div className="grid grid-cols-2 gap-1">
											<div className="flex items-center gap-1">
												<Car className="h-3 w-3" />
												{selectedVehicle.vehicleBrand} {selectedVehicle.vehicleModel}
											</div>
											<div className="flex items-center gap-1">
												<Users className="h-3 w-3" />
												Capacidad: {selectedVehicle.vehicleCapacity} pax
											</div>
											{selectedVehicle.vehiclePlate && (
												<div className="col-span-2">
													Patente: {selectedVehicle.vehiclePlate}
												</div>
											)}
										</div>
									</div>
								)}
							</div>
						</CollapsibleContent>
					</div>
				</Collapsible>

				{/* Catering Section */}
				{!isTransfer && (
					<Collapsible
						open={openProviders.includes("catering")}
						onOpenChange={(open) =>
							setOpenProviders((prev) =>
								open ? [...prev, "catering"] : prev.filter((id) => id !== "catering")
							)
						}
					>
						<div className="rounded-lg border">
							<CollapsibleTrigger className="hover:bg-muted/50 flex w-full items-center justify-between p-3">
								<div className="flex items-center gap-2">
									<Utensils className="h-4 w-4 text-green-600" />
									<span className="font-medium">Catering</span>
									{formData.cateringProviderId && (
										<Badge variant="default" className="bg-green-600 text-xs">
											Asignado
										</Badge>
									)}
									{formData.cateringCost > 0 && (
										<span className="text-muted-foreground text-xs">
											${formData.cateringCost.toLocaleString()}
										</span>
									)}
								</div>
								<ChevronDown
									className={cn(
										"h-4 w-4 transition-transform",
										openProviders.includes("catering") && "rotate-180"
									)}
								/>
							</CollapsibleTrigger>
							<CollapsibleContent>
								<div className="space-y-3 border-t p-3">
									<Select
										value={formData.cateringProviderId || "none"}
										onValueChange={(v) =>
											setFormData((prev) => ({
												...prev,
												cateringProviderId: v === "none" ? "" : v,
											}))
										}
									>
										<SelectTrigger className="h-9 w-full">
											<SelectValue placeholder="Proveedor de catering..." />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="none">Sin asignar</SelectItem>
											{cateringProviders.map((p) => {
												const minCost = getMinCateringCost(p)
												return (
													<SelectItem key={p.id} value={p.id}>
														{p.companyName || p.fullName}
														{Number.isFinite(minCost) &&
															minCost > 0 &&
															` - $${minCost.toLocaleString()} pp`}
													</SelectItem>
												)
											})}
										</SelectContent>
									</Select>

									{formData.cateringProviderId && selectedCateringProvider && (
										<div className="bg-muted/30 space-y-2 rounded-md p-2">
											{selectedCateringProvider.catering?.map((cat) => (
												<div key={cat.id} className="flex items-center space-x-2">
													<Checkbox
														id={cat.id}
														checked={formData.cateringSelection.some(
															(s) => s.id === cat.cateringOption.id
														)}
														onCheckedChange={(checked) => {
															const currentSelection = formData.cateringSelection || []
															let newSelection
															let newCost = formData.cateringCost || 0
															// eslint-disable-next-line @typescript-eslint/no-explicit-any
															const pax =
																event?.bookings?.reduce(
																	(a: number, b: any) => a + b.passengerCount,
																	0
																) || 0

															if (checked) {
																newSelection = [
																	...currentSelection,
																	{
																		id: cat.cateringOption.id,
																		name: cat.cateringOption.name,
																		price: cat.pricePerPerson,
																	},
																]
																newCost =
																	(formData.cateringCost || 0) + cat.pricePerPerson * pax
															} else {
																newSelection = currentSelection.filter(
																	(s) => s.id !== cat.cateringOption.id
																)
																newCost =
																	(formData.cateringCost || 0) - cat.pricePerPerson * pax
															}
															setFormData((prev) => ({
																...prev,
																cateringSelection: newSelection,
																cateringCost: Math.max(0, newCost),
															}))
														}}
													/>
													<label
														htmlFor={cat.id}
														className="flex-1 cursor-pointer text-xs"
													>
														{cat.cateringOption.name} (${cat.pricePerPerson})
													</label>
												</div>
											))}

											<div className="space-y-1 border-t pt-2">
												<Label className="text-xs">Costo Total:</Label>
												<div className="relative">
													<span className="text-muted-foreground absolute top-1/2 left-2 -translate-y-1/2 text-xs">
														$
													</span>
													<Input
														className="h-8 pl-5 text-xs"
														type="number"
														value={formData.cateringCost}
														onChange={(e) =>
															setFormData((p) => ({
																...p,
																cateringCost: +e.target.value,
															}))
														}
													/>
												</div>
											</div>
										</div>
									)}
								</div>
							</CollapsibleContent>
						</div>
					</Collapsible>
				)}

				<Separator className="my-4" />

				{/* Profitability Summary */}
				<div className="bg-muted/30 rounded-lg p-3">
					<h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
						<DollarSign className="h-4 w-4" />
						Rentabilidad
					</h4>
					<div className="grid grid-cols-2 gap-1 text-sm">
						<div className="text-muted-foreground">Ingresos:</div>
						<div className="text-right font-medium text-green-600">
							${totalRevenue.toLocaleString()}
						</div>
						<div className="text-muted-foreground">Costos:</div>
						<div className="text-right font-medium text-red-600">
							${totalCost.toLocaleString()}
						</div>
						<div className="border-t pt-1 font-medium">Utilidad:</div>
						<div className="border-t pt-1 text-right font-medium">
							${profit.toLocaleString()}
							<span
								className={cn(
									"ml-1 text-xs",
									profitMargin > 0 ? "text-green-600" : "text-red-600"
								)}
							>
								({profitMargin.toFixed(1)}%)
							</span>
						</div>
					</div>
				</div>

				{/* Operational Notes */}
				<div className="space-y-2">
					<Label className="text-sm font-semibold">Notas Operativas</Label>
					<Textarea
						className="min-h-[60px] resize-none text-xs"
						placeholder="Instrucciones para la operación..."
						value={formData.operationalNotes}
						onChange={(e) =>
							setFormData((p) => ({ ...p, operationalNotes: e.target.value }))
						}
					/>
				</div>

				{/* Audit Log */}
				{event?.id && <EventAuditLogSection eventId={event.id} />}
			</div>
		</ScrollArea>
	)
}
