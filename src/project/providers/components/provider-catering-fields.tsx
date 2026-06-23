import { Loader2 } from "lucide-react"
import { useState } from "react"

import { Checkbox } from "@/shared/components/ui/checkbox"
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

import { useCateringOptions, useCreateCateringOption } from "../hooks/use-providers"
import type { ProviderFormInstance } from "./provider-form-types"

interface ProviderCateringFieldsProps {
	form: ProviderFormInstance
}

export function ProviderCateringFields({ form }: ProviderCateringFieldsProps) {
	const { data: cateringOptions } = useCateringOptions()
	const createCateringOption = useCreateCateringOption()
	const [newCateringName, setNewCateringName] = useState("")

	return (
		<Card>
			<CardHeader>
				<CardTitle>Opciones de Catering</CardTitle>
				<CardDescription>
					Seleccione las opciones de catering y defina sus precios
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form.AppField name="catering">
					{(field) => (
						<div className="grid gap-2">
							<div className="mb-4 flex items-end gap-2">
								<div className="flex-1 space-y-2">
									<Label>Nueva Opción de Catering</Label>
									<Input
										placeholder="Ej: Desayuno Premium"
										value={newCateringName}
										onChange={(e) => setNewCateringName(e.target.value)}
									/>
								</div>
								<Button
									type="button"
									variant="secondary"
									onClick={() => {
										if (!newCateringName.trim()) return
										createCateringOption.mutate(newCateringName, {
											onSuccess: () => setNewCateringName(""),
										})
									}}
									disabled={createCateringOption.isPending || !newCateringName.trim()}
								>
									{createCateringOption.isPending ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										"Agregar"
									)}
								</Button>
							</div>

							{cateringOptions?.map((option) => {
								const currentValues = field.state.value || []
								const isSelected = currentValues.some(
									(item) => item.cateringOptionId === option.id
								)
								const currentItem = currentValues.find(
									(item) => item.cateringOptionId === option.id
								)

								return (
									<div key={option.id} className="space-y-4 rounded-lg border p-4">
										<div className="flex items-center space-x-2">
											<Checkbox
												id={`cat-${option.id}`}
												checked={isSelected}
												onCheckedChange={(checked) => {
													if (checked) {
														field.handleChange([
															...currentValues,
															{
																cateringOptionId: option.id,
																pricePerPerson: 0,
																pricingRules: "",
															},
														])
													} else {
														field.handleChange(
															currentValues.filter(
																(item) => item.cateringOptionId !== option.id
															)
														)
													}
												}}
											/>
											<Label htmlFor={`cat-${option.id}`}>{option.name}</Label>
										</div>

										{isSelected && (
											<div className="ml-6">
												<div className="space-y-2">
													<Label>Precio por Persona ($)</Label>
													<Input
														min="0"
														type="number"
														value={currentItem?.pricePerPerson || 0}
														onChange={(e) => {
															const newValue = parseFloat(e.target.value) || 0
															field.handleChange(
																currentValues.map((item) =>
																	item.cateringOptionId === option.id
																		? { ...item, pricePerPerson: newValue }
																		: item
																)
															)
														}}
													/>
												</div>
												{/* <div className="space-y-2">
													<Label>
														Reglas de Precio (JSON: &#123;&quot;12&quot;:10000&#125;)
													</Label>
													<Input
														placeholder='{"12": 10000}'
														value={currentItem?.pricingRules || ""}
														onChange={(e) => {
															field.handleChange(
																currentValues.map((item) =>
																	item.cateringOptionId === option.id
																		? { ...item, pricingRules: e.target.value }
																		: item
																)
															)
														}}
													/>
												</div> */}
											</div>
										)}
									</div>
								)
							})}
						</div>
					)}
				</form.AppField>
			</CardContent>
		</Card>
	)
}
