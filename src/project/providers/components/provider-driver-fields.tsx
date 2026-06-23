import { CalendarIcon, Upload } from "lucide-react"
import { es } from "date-fns/locale"
import { format } from "date-fns"
import { toast } from "sonner"

import { cn } from "@/lib/utils"

import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover"
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

interface ProviderDriverFieldsProps {
	form: ProviderFormInstance
}

export function ProviderDriverFields({ form }: ProviderDriverFieldsProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Información de Conductor</CardTitle>
				<CardDescription>Datos específicos para servicios de conducción</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<form.AppField name="licenseType">
						{(field) => (
							<div className="space-y-2">
								<field.FieldLabel htmlFor="licenseType">
									Tipo de Licencia <span className="text-destructive">*</span>
								</field.FieldLabel>
								<Input
									id="licenseType"
									placeholder="Clase A, B, C, etc."
									value={field.state.value || ""}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									className={cn(field.state.meta.errors.length > 0 && "border-destructive")}
								/>

								<field.FieldError />
							</div>
						)}
					</form.AppField>

					<div className="space-y-2">
						<Label htmlFor="adjuntoLicenciaUrl" className="text-sm">
							Adjunto Licencia de Conducir
						</Label>
						<div className="flex gap-2">
							<form.AppField name="licenseUrl">
								{(field) => (
									<Input
										id="adjuntoLicenciaUrl"
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

					<form.AppField name="licenseRenovationDate">
						{(field) => (
							<div className="space-y-2">
								<field.FieldLabel>
									Fecha Renovación Licencia <span className="text-destructive">*</span>
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
				</div>
			</CardContent>
		</Card>
	)
}
