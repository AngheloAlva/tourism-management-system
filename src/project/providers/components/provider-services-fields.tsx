import { cn } from "@/lib/utils"

import { Checkbox } from "@/shared/components/ui/checkbox"
import { Input } from "@/shared/components/ui/input"
import {
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	CardDescription,
} from "@/shared/components/ui/card"

import type { ProviderFormData } from "../schemas/provider.schema"
import type { ProviderFormInstance } from "./provider-form-types"

interface ProviderServicesFieldsProps {
	form: ProviderFormInstance
	services: ProviderFormData["services"]
}

export function ProviderServicesFields({ form, services }: ProviderServicesFieldsProps) {
	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle>Tipo de Servicio</CardTitle>
				<CardDescription>Seleccione uno o más tipos (multicheck)</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-1 gap-2 md:grid-cols-2">
					<div className="space-y-3">
						{[
							{ id: "conductor", label: "Conductor" },
							{ id: "maquina", label: "Máquina" },
							{ id: "transferOut", label: "Transfer Out" },
							{ id: "cocteleria", label: "Catering" },
						].map((item) => (
							<form.AppField
								key={item.id}
								name={
									`services.${item.id}` as
										| "services.conductor"
										| "services.maquina"
										| "services.transferOut"
										| "services.cocteleria"
								}
							>
								{(field) => (
									<div className="flex items-center space-x-2">
										<Checkbox
											id={item.id}
											checked={field.state.value as boolean}
											onCheckedChange={(value) => field.handleChange(value as boolean)}
										/>
										<field.FieldLabel htmlFor={item.id} className="cursor-pointer font-normal">
											{item.label}
										</field.FieldLabel>
									</div>
								)}
							</form.AppField>
						))}
					</div>

					<div className="space-y-3">
						{[
							{ id: "transferIn", label: "Transfer In" },
							{ id: "guia", label: "Guía" },
							{ id: "otros", label: "Otros" },
						].map((item) => (
							<form.AppField
								key={item.id}
								name={
									`services.${item.id}` as
										| "services.transferIn"
										| "services.guia"
										| "services.otros"
								}
							>
								{(field) => (
									<div className="flex items-center space-x-2">
										<Checkbox
											id={item.id}
											checked={field.state.value as boolean}
											onCheckedChange={(value) => field.handleChange(value as boolean)}
										/>
										<field.FieldLabel htmlFor={item.id} className="cursor-pointer font-normal">
											{item.label}
										</field.FieldLabel>
									</div>
								)}
							</form.AppField>
						))}
					</div>
				</div>

				{services.otros && (
					<form.AppField name="otherDescription">
						{(field) => (
							<div className="mt-4 space-y-2">
								<field.FieldLabel htmlFor="otherDescription">
									Descripción de Otros Servicios
								</field.FieldLabel>
								<Input
									id="otherDescription"
									placeholder="Especifique otros servicios..."
									value={field.state.value || ""}
									onChange={(e) => field.handleChange(e.target.value)}
								/>

								<field.FieldError />
							</div>
						)}
					</form.AppField>
				)}

				{(services.guia ||
					services.conductor ||
					services.conductorMaquina ||
					services.maquina ||
					services.transferIn ||
					services.transferOut ||
					services.otros) && (
					<div className="mt-6 space-y-3">
						<div className="text-sm font-semibold">Costos por Servicio</div>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							{services.guia && (
								<form.AppField name="guideCost">
									{(field) => (
										<div className="space-y-2">
											<field.FieldLabel htmlFor="guideCost">Costo Guía</field.FieldLabel>
											<Input
												min="0"
												type="number"
												id="guideCost"
												placeholder="0"
												value={field.state.value || ""}
												onChange={(e) =>
													field.handleChange(
														e.target.value ? parseFloat(e.target.value) : undefined
													)
												}
												onBlur={field.handleBlur}
												className={cn(field.state.meta.errors.length > 0 && "border-destructive")}
											/>
											<field.FieldError />
										</div>
									)}
								</form.AppField>
							)}

							{(services.conductor || services.conductorMaquina) && (
								<form.AppField name="driverCost">
									{(field) => (
										<div className="space-y-2">
											<field.FieldLabel htmlFor="driverCost">Costo Conductor</field.FieldLabel>
											<Input
												min="0"
												type="number"
												id="driverCost"
												placeholder="0"
												value={field.state.value || ""}
												onChange={(e) =>
													field.handleChange(
														e.target.value ? parseFloat(e.target.value) : undefined
													)
												}
												onBlur={field.handleBlur}
												className={cn(field.state.meta.errors.length > 0 && "border-destructive")}
											/>
											<field.FieldError />
										</div>
									)}
								</form.AppField>
							)}

							{(services.maquina || services.conductorMaquina) && (
								<form.AppField name="vehicleCost">
									{(field) => (
										<div className="space-y-2">
											<field.FieldLabel htmlFor="vehicleCost">Costo Vehículo</field.FieldLabel>
											<Input
												min="0"
												type="number"
												id="vehicleCost"
												placeholder="0"
												value={field.state.value || ""}
												onChange={(e) =>
													field.handleChange(
														e.target.value ? parseFloat(e.target.value) : undefined
													)
												}
												onBlur={field.handleBlur}
												className={cn(field.state.meta.errors.length > 0 && "border-destructive")}
											/>
											<field.FieldError />
										</div>
									)}
								</form.AppField>
							)}

							{services.transferIn && (
								<form.AppField name="transferInCost">
									{(field) => (
										<div className="space-y-2">
											<field.FieldLabel htmlFor="transferInCost">
												Costo Transfer In
											</field.FieldLabel>
											<Input
												min="0"
												type="number"
												id="transferInCost"
												placeholder="0"
												value={field.state.value || ""}
												onChange={(e) =>
													field.handleChange(
														e.target.value ? parseFloat(e.target.value) : undefined
													)
												}
												onBlur={field.handleBlur}
												className={cn(field.state.meta.errors.length > 0 && "border-destructive")}
											/>
											<field.FieldError />
										</div>
									)}
								</form.AppField>
							)}

							{services.transferOut && (
								<form.AppField name="transferOutCost">
									{(field) => (
										<div className="space-y-2">
											<field.FieldLabel htmlFor="transferOutCost">
												Costo Transfer Out
											</field.FieldLabel>
											<Input
												min="0"
												type="number"
												id="transferOutCost"
												placeholder="0"
												value={field.state.value || ""}
												onChange={(e) =>
													field.handleChange(
														e.target.value ? parseFloat(e.target.value) : undefined
													)
												}
												onBlur={field.handleBlur}
												className={cn(field.state.meta.errors.length > 0 && "border-destructive")}
											/>
											<field.FieldError />
										</div>
									)}
								</form.AppField>
							)}

							{services.otros && (
								<form.AppField name="otherCost">
									{(field) => (
										<div className="space-y-2">
											<field.FieldLabel htmlFor="otherCost">Costo Otros</field.FieldLabel>
											<Input
												min="0"
												type="number"
												id="otherCost"
												placeholder="0"
												value={field.state.value || ""}
												onChange={(e) =>
													field.handleChange(
														e.target.value ? parseFloat(e.target.value) : undefined
													)
												}
												onBlur={field.handleBlur}
												className={cn(field.state.meta.errors.length > 0 && "border-destructive")}
											/>
											<field.FieldError />
										</div>
									)}
								</form.AppField>
							)}
							{/* <form.AppField name="costPerDay">
								{(field) => (
									<div className="space-y-2">
										<field.FieldLabel htmlFor="costPerDay">
											Costo General (fallback)
										</field.FieldLabel>
										<Input
											min="0"
											type="number"
											id="costPerDay"
											placeholder="0"
											value={field.state.value || ""}
											onChange={(e) =>
												field.handleChange(
													e.target.value ? parseFloat(e.target.value) : undefined
												)
											}
											onBlur={field.handleBlur}
											className={cn(field.state.meta.errors.length > 0 && "border-destructive")}
										/>
										<field.FieldError />
									</div>
								)}
							</form.AppField>*/}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	)
}
