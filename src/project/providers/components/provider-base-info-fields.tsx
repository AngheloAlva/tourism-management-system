import { CalendarIcon, Upload } from "lucide-react"
import { es } from "date-fns/locale"
import { format } from "date-fns"
import { toast } from "sonner"

import { formatRut } from "@/shared/lib/format-rut"
import { cn } from "@/lib/utils"

import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group"
import { Calendar } from "@/shared/components/ui/calendar"
import { Button } from "@/shared/components/ui/button"
import { Switch } from "@/shared/components/ui/switch"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import {
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	CardDescription,
} from "@/shared/components/ui/card"
import {
	Select,
	SelectItem,
	SelectValue,
	SelectTrigger,
	SelectContent,
} from "@/shared/components/ui/select"

import type { ProviderFormInstance } from "./provider-form-types"

interface ProviderBaseInfoFieldsProps {
	form: ProviderFormInstance
	type: "NATURAL" | "JURIDICA"
	mostrarCamposConductor: boolean
}

export function ProviderBaseInfoFields({
	form,
	type,
	mostrarCamposConductor,
}: ProviderBaseInfoFieldsProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Información Base</CardTitle>
				<CardDescription>Datos generales del proveedor</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
					<form.AppField name="type">
						{(field) => (
							<div className="space-y-3 md:col-span-2">
								<field.FieldLabel>Tipo de Persona</field.FieldLabel>
								<RadioGroup
									onValueChange={(value: "NATURAL" | "JURIDICA") => field.handleChange(value)}
									defaultValue={field.state.value}
									className="flex gap-4"
								>
									<div className="flex items-center space-x-2">
										<RadioGroupItem value="NATURAL" id="natural" />
										<field.FieldLabel htmlFor="natural">Persona Natural</field.FieldLabel>
									</div>
									<div className="flex items-center space-x-2">
										<RadioGroupItem value="JURIDICA" id="juridica" />
										<field.FieldLabel htmlFor="juridica">Persona Jurídica</field.FieldLabel>
									</div>
								</RadioGroup>

								<field.FieldError />
							</div>
						)}
					</form.AppField>

					<form.AppField name="rut">
						{(field) => (
							<div className="space-y-2">
								<field.FieldLabel htmlFor="rut">
									RUT <span className="text-destructive">*</span>
								</field.FieldLabel>
								<Input
									id="rut"
									placeholder="12345678-9"
									value={field.state.value}
									onChange={(e) => {
										const val = formatRut(e.target.value)
										field.handleChange(val)
									}}
									onBlur={field.handleBlur}
									className={cn(field.state.meta.errors.length > 0 && "border-destructive")}
								/>

								<field.FieldError />
							</div>
						)}
					</form.AppField>

					{type === "NATURAL" ? (
						<>
							<form.AppField name="fullName">
								{(field) => (
									<div className="space-y-2">
										<field.FieldLabel htmlFor="fullName">
											Nombre Completo <span className="text-destructive">*</span>
										</field.FieldLabel>
										<Input
											id="fullName"
											placeholder="Juan Pérez"
											value={field.state.value || ""}
											onChange={(e) => field.handleChange(e.target.value)}
											onBlur={field.handleBlur}
											className={cn(field.state.meta.errors.length > 0 && "border-destructive")}
											data-testid="provider-input-name"
										/>

										<field.FieldError />
									</div>
								)}
							</form.AppField>

							<form.AppField name="birthDate">
								{(field) => (
									<div className="space-y-2">
										<field.FieldLabel>
											Fecha de Nacimiento <span className="text-destructive">*</span>
										</field.FieldLabel>
										<Popover>
											<PopoverTrigger asChild>
												<Button
													variant="outline"
													className={cn(
														"w-full justify-start text-left font-normal",
														!field.state.value && "text-muted-foreground",
														field.state.meta.errors.length > 0 && "border-destructive"
													)}
												>
													<CalendarIcon className="h-4 w-4" />
													{field.state.value ? (
														format(field.state.value, "dd/MM/yyyy", { locale: es })
													) : (
														<span>Seleccione una fecha</span>
													)}
												</Button>
											</PopoverTrigger>
											<PopoverContent className="w-auto p-0" align="start">
												<Calendar
													mode="single"
													captionLayout="dropdown"
													selected={field.state.value}
													onSelect={field.handleChange}
													initialFocus
													locale={es}
												/>
											</PopoverContent>
										</Popover>

										<field.FieldError />
									</div>
								)}
							</form.AppField>

							<form.AppField name="phone">
								{(field) => (
									<div className="space-y-2">
										<field.FieldLabel htmlFor="phone">
											Teléfono <span className="text-destructive">*</span>
										</field.FieldLabel>
										<Input
											id="phone"
											placeholder="+56 9 1234 5678"
											value={field.state.value || ""}
											onChange={(e) => field.handleChange(e.target.value)}
											onBlur={field.handleBlur}
											className={cn(field.state.meta.errors.length > 0 && "border-destructive")}
										/>

										<field.FieldError />
									</div>
								)}
							</form.AppField>

							<form.AppField name="email">
								{(field) => (
									<div className="space-y-2">
										<field.FieldLabel htmlFor="email">Email</field.FieldLabel>
										<Input
											id="email"
											type="email"
											placeholder="correo@ejemplo.com"
											value={field.state.value || ""}
											onChange={(e) => field.handleChange(e.target.value)}
											onBlur={field.handleBlur}
											className={cn(field.state.meta.errors.length > 0 && "border-destructive")}
										/>

										<field.FieldError />
									</div>
								)}
							</form.AppField>

							<form.AppField name="address">
								{(field) => (
									<div className="space-y-2">
										<field.FieldLabel htmlFor="address">
											Dirección <span className="text-destructive">*</span>
										</field.FieldLabel>
										<Input
											id="address"
											value={field.state.value || ""}
											placeholder="Av. Siempre Viva 123"
											onChange={(e) => field.handleChange(e.target.value)}
											onBlur={field.handleBlur}
											className={cn(field.state.meta.errors.length > 0 && "border-destructive")}
										/>

										<field.FieldError />
									</div>
								)}
							</form.AppField>
						</>
					) : (
						<>
							<form.AppField name="companyName">
								{(field) => (
									<div className="space-y-2">
										<field.FieldLabel htmlFor="companyName">
											Razón Social / Empresa <span className="text-destructive">*</span>
										</field.FieldLabel>
										<Input
											id="companyName"
											onBlur={field.handleBlur}
											placeholder="Empresa SpA"
											value={field.state.value || ""}
											onChange={(e) => field.handleChange(e.target.value)}
											className={cn(field.state.meta.errors.length > 0 && "border-destructive")}
										/>

										<field.FieldError />
									</div>
								)}
							</form.AppField>

							<form.AppField name="category">
								{(field) => (
									<div className="space-y-2">
										<field.FieldLabel htmlFor="category">
											Categoría <span className="text-destructive">*</span>
										</field.FieldLabel>
										<Input
											id="category"
											placeholder="Transporte, Turismo, etc."
											value={field.state.value || ""}
											onChange={(e) => field.handleChange(e.target.value)}
											onBlur={field.handleBlur}
											className={cn(field.state.meta.errors.length > 0 && "border-destructive")}
										/>

										<field.FieldError />
									</div>
								)}
							</form.AppField>

							<form.AppField name="giro">
								{(field) => (
									<div className="space-y-2">
										<field.FieldLabel htmlFor="giro">
											Giro <span className="text-destructive">*</span>
										</field.FieldLabel>
										<Select
											value={field.state.value}
											onValueChange={(val) => field.handleChange(val as "EXENTO" | "AFECTO")}
										>
											<SelectTrigger
												className={cn(
													"w-full",
													field.state.meta.errors.length > 0 && "border-destructive"
												)}
											>
												<SelectValue placeholder="Seleccione giro" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="AFECTO">Afecto</SelectItem>
												<SelectItem value="EXENTO">Exento</SelectItem>
											</SelectContent>
										</Select>

										<field.FieldError />
									</div>
								)}
							</form.AppField>
						</>
					)}

					<div className="space-y-2">
						<Label htmlFor="adjuntoCarnetUrl" className="text-sm">
							Adjunto Carnet de Identidad
						</Label>
						<div className="flex gap-2">
							<form.AppField name="carnetUrl">
								{(field) => (
									<Input
										id="adjuntoCarnetUrl"
										placeholder="URL del archivo"
										value={field.state.value || ""}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
								)}
							</form.AppField>
							<Button
								type="button"
								variant="outline"
								size="icon"
								onClick={() => {
									toast.info("Funcionalidad de subida de archivo (simulada)")
								}}
							>
								<Upload className="h-4 w-4" />
							</Button>
						</div>
					</div>

					{mostrarCamposConductor && (
						<form.AppField name="carnetRenovationDate">
							{(field) => (
								<div className="space-y-2">
									<field.FieldLabel>
										Fecha Renovación Carnet <span className="text-destructive">*</span>
									</field.FieldLabel>
									<Popover>
										<PopoverTrigger asChild>
											<Button
												variant="outline"
												className={cn(
													"w-full justify-start text-left font-normal",
													!field.state.value && "text-muted-foreground",
													field.state.meta.errors.length > 0 && "border-destructive"
												)}
											>
												<CalendarIcon className="h-4 w-4" />
												{field.state.value ? (
													format(field.state.value, "dd/MM/yyyy", { locale: es })
												) : (
													<span>Seleccione una fecha</span>
												)}
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0" align="start">
											<Calendar
												mode="single"
												captionLayout="dropdown"
												selected={field.state.value}
												onSelect={field.handleChange}
												initialFocus
												locale={es}
											/>
										</PopoverContent>
									</Popover>

									<field.FieldError />
								</div>
							)}
						</form.AppField>
					)}

					<form.AppField name="isActive">
						{(field) => (
							<div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm md:col-span-2">
								<div className="space-y-0.5">
									<field.FieldLabel className="text-base">Proveedor Activo</field.FieldLabel>
									<p className="text-muted-foreground text-sm">
										Indica si el proveedor está habilitado en el sistema
									</p>
								</div>
								<Switch checked={field.state.value} onCheckedChange={field.handleChange} />
							</div>
						)}
					</form.AppField>
				</div>
			</CardContent>
		</Card>
	)
}
