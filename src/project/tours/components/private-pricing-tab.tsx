"use client"

import { useStore } from "@tanstack/react-form"
import { InfoIcon, Lock, Plus, Trash2 } from "lucide-react"

import type { TourFormApi } from "./tour-form"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import {
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	CardDescription,
} from "@/shared/components/ui/card"

interface PrivatePricingTabProps {
	form: TourFormApi
}

export function PrivatePricingTab({ form }: PrivatePricingTabProps) {
	const privatePricing =
		useStore(form.store, (state) => state.values.privatePricing) ?? []

	// Entry price is shared across all tiers — read from first tier
	const sharedEntryPrice = privatePricing[0]?.entryPrice ?? 0

	const setSharedEntryPrice = (value: number) => {
		const current = form.getFieldValue("privatePricing") || []
		form.setFieldValue(
			"privatePricing",
			current.map((tier: { capacity: number; price: number; entryPrice: number }) => ({
				...tier,
				entryPrice: value,
			}))
		)
	}

	const addPricing = () => {
		const currentPricing = form.getFieldValue("privatePricing") || []
		form.setFieldValue("privatePricing", [
			...currentPricing,
			{ capacity: currentPricing.length + 1, price: 0, entryPrice: sharedEntryPrice },
		])
	}

	const removePricing = (index: number) => {
		const currentPricing = form.getFieldValue("privatePricing") || []
		form.setFieldValue(
			"privatePricing",
			currentPricing.filter((_, i) => i !== index)
		)
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-3">
					<div className="flex size-8 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400">
						<Lock className="size-4" />
					</div>
					Precios para Tours Privados
				</CardTitle>
				<CardDescription>
					Define precios por persona según la cantidad de pasajeros. Puedes agregar tantos rangos
					como necesites.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{privatePricing.length === 0 ? (
					<div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
						<p className="mb-4">No hay precios privados configurados</p>
						<Button type="button" onClick={addPricing} variant="outline" size="sm">
							<Plus className="h-4 w-4" />
							Agregar Precio
						</Button>
					</div>
				) : (
					<div className="space-y-5">
						{/* Shared entry price — single value for all tiers */}
						<div className="max-w-xs">
							<label className="text-sm font-medium">
								Precio de Entrada (único para todos los rangos)
							</label>
							<Input
								type="number"
								value={sharedEntryPrice === 0 ? "" : sharedEntryPrice}
								onChange={(e) => {
									const value = e.target.value
									setSharedEntryPrice(value ? parseFloat(value) : 0)
								}}
								onBlur={(e) => {
									if (e.target.value === "") setSharedEntryPrice(0)
								}}
								placeholder="0"
							/>
							<p className="text-muted-foreground mt-1 text-xs">
								Este valor se aplica a todos los rangos de pasajeros.
							</p>
						</div>

						{/* key={index} used intentionally: pricing items lack a stable unique ID */}
						{privatePricing.map((_, index) => (
							<div key={index} className="flex gap-3">
								<form.AppField name={`privatePricing[${index}].capacity`}>
									{(field) => (
										<field.Field className="flex-1 gap-2">
											<field.FieldLabel>Cantidad de Pasajeros</field.FieldLabel>
											<Input readOnly type="number" value={field.state.value || ""} />
											<field.FieldError />
										</field.Field>
									)}
								</form.AppField>

								<form.AppField name={`privatePricing[${index}].price`}>
									{(field) => (
										<field.Field className="flex-1 gap-2">
											<field.FieldLabel>Precio por Persona</field.FieldLabel>
											<Input
												type="number"
												value={field.state.value || ""}
												onChange={(e) => {
													const value = e.target.value
													field.handleChange(value ? parseFloat(value) : 0)
												}}
												placeholder="20000"
											/>
											<field.FieldError />
										</field.Field>
									)}
								</form.AppField>

								<div className="flex items-end">
									<Button
										type="button"
										variant="ghost"
										size="icon"
										onClick={() => removePricing(index)}
										className="text-destructive hover:text-destructive"
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							</div>
						))}

						<Button
							type="button"
							onClick={addPricing}
							variant="outline"
							size="sm"
							className="w-full"
						>
							<Plus className="h-4 w-4" />
							Agregar Otro Precio
						</Button>
					</div>
				)}

				<p className="text-muted-foreground mt-4 text-sm">
					<InfoIcon className="-mt-0.5 inline size-4 text-amber-500" /> Estos precios son por
					persona. Por ejemplo, si defines &quot;1-4&quot; pasajeros a $100, el total para 4
					pasajeros sería $400 (4 × $100).
				</p>
			</CardContent>
		</Card>
	)
}
