import { CalendarIcon } from "lucide-react"
import { es } from "date-fns/locale"
import { format } from "date-fns"

import { cn } from "@/lib/utils"

import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover"
import { FileUpload } from "@/shared/components/file-upload"
import { Calendar } from "@/shared/components/ui/calendar"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import {
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	CardDescription,
} from "@/shared/components/ui/card"

import type { ProviderFormInstance } from "./provider-form-types"

interface ProviderVehicleFieldsProps {
	form: ProviderFormInstance
}

export function ProviderVehicleFields({ form }: ProviderVehicleFieldsProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Información del Vehículo</CardTitle>
				<CardDescription>Datos del vehículo y documentación asociada</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
					<form.AppField name="vehicleBrand">
						{(field) => (
							<div className="space-y-2">
								<field.FieldLabel>Marca</field.FieldLabel>
								<Input
									value={field.state.value || ""}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								<field.FieldError />
							</div>
						)}
					</form.AppField>
					<form.AppField name="vehicleModel">
						{(field) => (
							<div className="space-y-2">
								<field.FieldLabel>Modelo</field.FieldLabel>
								<Input
									value={field.state.value || ""}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								<field.FieldError />
							</div>
						)}
					</form.AppField>
					<form.AppField name="vehicleYear">
						{(field) => (
							<div className="space-y-2">
								<field.FieldLabel>Año</field.FieldLabel>
								<Input
									type="number"
									value={field.state.value || ""}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								<field.FieldError />
							</div>
						)}
					</form.AppField>
					<form.AppField name="vehiclePlate">
						{(field) => (
							<div className="space-y-2">
								<field.FieldLabel>Patente</field.FieldLabel>
								<Input
									value={field.state.value || ""}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								<field.FieldError />
							</div>
						)}
					</form.AppField>
					<form.AppField name="vehicleCapacity">
						{(field) => (
							<div className="space-y-2">
								<field.FieldLabel>Capacidad (Pax)</field.FieldLabel>
								<Input
									type="number"
									value={field.state.value || ""}
									onChange={(e) =>
										field.handleChange(e.target.value ? parseInt(e.target.value) : undefined)
									}
								/>
								<field.FieldError />
							</div>
						)}
					</form.AppField>
					<form.AppField name="vehicleEfficiency">
						{(field) => (
							<div className="space-y-2">
								<field.FieldLabel>Rendimiento (km/l)</field.FieldLabel>
								<Input
									value={field.state.value || ""}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Ej: 10 km/l"
								/>
								<field.FieldError />
							</div>
						)}
					</form.AppField>
				</div>

				<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
					{/* Revisión Técnica */}
					<div className="space-y-4 rounded-md border p-4">
						<h4 className="font-semibold">Revisión Técnica</h4>
						<form.AppField name="technicalRevisionUrl">
							{(field) => (
								<div className="space-y-2">
									<Label>Documento</Label>
									<FileUpload
										value={field.state.value || ""}
										onUploadComplete={(url) => field.handleChange(url)}
										onRemove={() => field.handleChange("")}
										endpoint="/api/tours/upload-pdf"
									/>
								</div>
							)}
						</form.AppField>
						<form.AppField name="technicalRevisionDate">
							{(field) => (
								<div className="space-y-2">
									<Label>Vencimiento</Label>
									<Popover>
										<PopoverTrigger asChild>
											<Button
												variant="outline"
												className={cn(
													"w-full justify-start text-left font-normal",
													!field.state.value && "text-muted-foreground"
												)}
											>
												<CalendarIcon className="h-4 w-4" />
												{field.state.value ? (
													format(field.state.value, "dd/MM/yyyy", { locale: es })
												) : (
													<span>Seleccione fecha</span>
												)}
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0">
											<Calendar
												mode="single"
												selected={field.state.value}
												onSelect={field.handleChange}
												initialFocus
												locale={es}
											/>
										</PopoverContent>
									</Popover>
								</div>
							)}
						</form.AppField>
					</div>

					{/* Permiso de Circulación */}
					<div className="space-y-4 rounded-md border p-4">
						<h4 className="font-semibold">Permiso de Circulación</h4>
						<form.AppField name="circulationPermitUrl">
							{(field) => (
								<div className="space-y-2">
									<Label>Documento</Label>
									<FileUpload
										value={field.state.value || ""}
										onUploadComplete={(url) => field.handleChange(url)}
										onRemove={() => field.handleChange("")}
										endpoint="/api/tours/upload-pdf"
									/>
								</div>
							)}
						</form.AppField>
						<form.AppField name="circulationPermitDate">
							{(field) => (
								<div className="space-y-2">
									<Label>Vencimiento</Label>
									<Popover>
										<PopoverTrigger asChild>
											<Button
												variant="outline"
												className={cn(
													"w-full justify-start text-left font-normal",
													!field.state.value && "text-muted-foreground"
												)}
											>
												<CalendarIcon className="h-4 w-4" />
												{field.state.value ? (
													format(field.state.value, "dd/MM/yyyy", { locale: es })
												) : (
													<span>Seleccione fecha</span>
												)}
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0">
											<Calendar
												mode="single"
												selected={field.state.value}
												onSelect={field.handleChange}
												initialFocus
												locale={es}
											/>
										</PopoverContent>
									</Popover>
								</div>
							)}
						</form.AppField>
					</div>

					{/* Decreto 80 */}
					<div className="space-y-4 rounded-md border p-4">
						<h4 className="font-semibold">Decreto 80</h4>
						<form.AppField name="decree80Url">
							{(field) => (
								<div className="space-y-2">
									<Label>Documento</Label>
									<FileUpload
										value={field.state.value || ""}
										onUploadComplete={(url) => field.handleChange(url)}
										onRemove={() => field.handleChange("")}
										endpoint="/api/tours/upload-pdf"
									/>
								</div>
							)}
						</form.AppField>
						<form.AppField name="decree80Date">
							{(field) => (
								<div className="space-y-2">
									<Label>Vencimiento</Label>
									<Popover>
										<PopoverTrigger asChild>
											<Button
												variant="outline"
												className={cn(
													"w-full justify-start text-left font-normal",
													!field.state.value && "text-muted-foreground"
												)}
											>
												<CalendarIcon className="h-4 w-4" />
												{field.state.value ? (
													format(field.state.value, "dd/MM/yyyy", { locale: es })
												) : (
													<span>Seleccione fecha</span>
												)}
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0">
											<Calendar
												mode="single"
												selected={field.state.value}
												onSelect={field.handleChange}
												initialFocus
												locale={es}
											/>
										</PopoverContent>
									</Popover>
								</div>
							)}
						</form.AppField>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
