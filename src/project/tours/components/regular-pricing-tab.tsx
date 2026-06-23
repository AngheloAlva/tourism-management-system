"use client"

import { useState } from "react"
import { useStore } from "@tanstack/react-form"
import { CalendarRange, DollarSign, Pencil, Plus, Ticket, Trash2 } from "lucide-react"

import type { TourFormApi } from "./tour-form"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Switch } from "@/shared/components/ui/switch"
import { Label } from "@/shared/components/ui/label"
import { Badge } from "@/shared/components/ui/badge"
import { Separator } from "@/shared/components/ui/separator"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog"
import { DEFAULT_PRICE_CATEGORIES } from "../constants/default-price-categories"

interface PriceCategoryTabProps {
	form: TourFormApi
}

const DEFAULT_NAMES = new Set(DEFAULT_PRICE_CATEGORIES.map((c) => c.name))

export function PriceCategoryTab({ form }: PriceCategoryTabProps) {
	const [editingIndex, setEditingIndex] = useState<number | null>(null)
	const priceCategories = useStore(form.store, (state) => state.values.priceCategories) ?? []

	const addCategory = () => {
		const categories = form.getFieldValue("priceCategories") || []
		const nextOrder = categories.length
		form.setFieldValue("priceCategories", [
			...categories,
			{
				name: "",
				price: 0,
				receptionPrice: 0,
				transferPrice: 0,
				minPrice: null,
				maxPrice: null,
				ageMin: null,
				ageMax: null,
				isDefault: false,
				isSpecial: false,
				sortOrder: nextOrder,
				active: true,
				entries: [],
			},
		])
	}

	const removeCategory = (catIndex: number) => {
		const categories = form.getFieldValue("priceCategories") || []
		const updated = categories
			.filter((_, i) => i !== catIndex)
			.map((cat, i) => ({ ...cat, sortOrder: i }))
		form.setFieldValue("priceCategories", updated)
	}

	const addEntry = (catIndex: number) => {
		const categories = form.getFieldValue("priceCategories") || []
		const currentEntries = categories[catIndex]?.entries || []
		const nextOrder = currentEntries.length
		const updatedCategories = categories.map((cat, i) => {
			if (i !== catIndex) return cat
			return {
				...cat,
				entries: [
					...currentEntries,
					{
						name: "",
						variantName: "",
						price: 0,
						isDefault: false,
						isSpecial: false,
						sortOrder: nextOrder,
						active: true,
					},
				],
			}
		})
		form.setFieldValue("priceCategories", updatedCategories)
	}

	const removeEntry = (catIndex: number, entryIndex: number) => {
		const categories = form.getFieldValue("priceCategories") || []
		const currentEntries = categories[catIndex]?.entries || []
		const updatedEntries = currentEntries
			.filter((_, i) => i !== entryIndex)
			.map((entry, i) => ({ ...entry, sortOrder: i }))
		const updatedCategories = categories.map((cat, i) => {
			if (i !== catIndex) return cat
			return { ...cat, entries: updatedEntries }
		})
		form.setFieldValue("priceCategories", updatedCategories)
	}

	return (
		<div className="space-y-3">
			{priceCategories.length === 0 ? (
				<div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center">
					<p>No hay precios regulares configurados</p>
				</div>
			) : (
				priceCategories.map((pc, index) => {
					const isDefault = DEFAULT_NAMES.has(pc.name) && pc.isDefault
					return (
						<div
							key={index}
							className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
						>
							<div className="min-w-0 flex-1 space-y-1">
								<div className="flex items-center gap-2">
									<span className="text-muted-foreground text-sm font-medium">
										{index + 1}.
									</span>
									{isDefault ? (
										<span className="font-medium">{pc.name}</span>
									) : (
										<form.AppField name={`priceCategories[${index}].name`}>
											{(field) => (
												<Input
													value={field.state.value || ""}
													onChange={(e) => field.handleChange(e.target.value)}
													placeholder="Nombre de categoría"
													className="h-7 w-40 text-sm font-medium"
												/>
											)}
										</form.AppField>
									)}
									{pc.ageMin != null && pc.ageMax != null && (
										<Badge variant="outline" className="text-xs font-normal">
											{pc.ageMin} – {pc.ageMax} años
										</Badge>
									)}
								</div>
								<div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
									<span className="text-foreground font-semibold">
										${pc.price.toLocaleString("es-CL")}
									</span>
									{pc.receptionPrice > 0 && (
										<span>Recep: ${pc.receptionPrice.toLocaleString("es-CL")}</span>
									)}
									{pc.transferPrice > 0 && (
										<span>Trasp: ${pc.transferPrice.toLocaleString("es-CL")}</span>
									)}
									<span>
										{pc.entries?.length || 0}{" "}
										{(pc.entries?.length || 0) === 1 ? "entrada" : "entradas"}
									</span>
								</div>
							</div>
							<div className="flex items-center gap-2 shrink-0">
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => setEditingIndex(index)}
								>
									<Pencil className="h-4 w-4" />
									Editar
								</Button>
								{!isDefault && (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="text-destructive hover:text-destructive"
										onClick={() => removeCategory(index)}
									>
										<Trash2 className="h-4 w-4" />
										Eliminar
									</Button>
								)}
							</div>
						</div>
					)
				})
			)}

			{/* Agregar Categoría */}
			<Button
				type="button"
				variant="outline"
				size="sm"
				onClick={addCategory}
				className="w-full"
			>
				<Plus className="h-4 w-4" />
				Agregar Categoría
			</Button>

			{/* ---------------------------------------------------------------- */}
			{/* Edit Dialog                                                      */}
			{/* ---------------------------------------------------------------- */}
			<Dialog
				open={editingIndex !== null}
				onOpenChange={(open) => {
					if (!open) setEditingIndex(null)
				}}
			>
				<DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							Editar Categoria:{" "}
							{editingIndex !== null
								? priceCategories[editingIndex]?.name || "Sin nombre"
								: ""}
						</DialogTitle>
						<DialogDescription>
							Configura precios, rango de edad y entradas para esta categoria
						</DialogDescription>
					</DialogHeader>

					{editingIndex !== null && (
						<div className="space-y-6">
							{/* Precios */}
							<div>
								<h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
									<div className="flex size-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
										<DollarSign className="size-3.5" />
									</div>
									Precios
								</h4>
								<div className="grid gap-3 sm:grid-cols-3">
									<form.AppField
										name={`priceCategories[${editingIndex}].price`}
									>
										{(field) => (
											<field.Field
												data-invalid={field.state.meta.errors.length > 0}
											>
												<field.FieldLabel>
													Precio Base{" "}
													<span className="text-destructive">*</span>
												</field.FieldLabel>
												<Input
													type="number"
													value={field.state.value || ""}
													onChange={(e) =>
														field.handleChange(
															parseFloat(e.target.value) || 0
														)
													}
													placeholder="20000"
												/>
												<field.FieldError />
											</field.Field>
										)}
									</form.AppField>

									<form.AppField
										name={`priceCategories[${editingIndex}].receptionPrice`}
									>
										{(field) => (
											<field.Field>
												<field.FieldLabel>Recepcion</field.FieldLabel>
												<Input
													type="number"
													value={field.state.value || ""}
													onChange={(e) =>
														field.handleChange(
															parseFloat(e.target.value) || 0
														)
													}
													placeholder="0"
												/>
											</field.Field>
										)}
									</form.AppField>

									<form.AppField
										name={`priceCategories[${editingIndex}].transferPrice`}
									>
										{(field) => (
											<field.Field>
												<field.FieldLabel>Precio Traspaso</field.FieldLabel>
												<Input
													type="number"
													value={field.state.value || ""}
													onChange={(e) =>
														field.handleChange(
															parseFloat(e.target.value) || 0
														)
													}
													placeholder="0"
												/>
											</field.Field>
										)}
									</form.AppField>
								</div>

								<div className="mt-3 grid gap-3 sm:grid-cols-2">
									<form.AppField
										name={`priceCategories[${editingIndex}].minPrice`}
									>
										{(field) => (
											<field.Field>
												<field.FieldLabel>Precio Min</field.FieldLabel>
												<Input
													type="number"
													value={field.state.value || ""}
													onChange={(e) =>
														field.handleChange(
															parseFloat(e.target.value) || 0
														)
													}
													placeholder="0"
												/>
											</field.Field>
										)}
									</form.AppField>

									<form.AppField
										name={`priceCategories[${editingIndex}].maxPrice`}
									>
										{(field) => (
											<field.Field>
												<field.FieldLabel>Precio Max</field.FieldLabel>
												<Input
													type="number"
													value={field.state.value || ""}
													onChange={(e) =>
														field.handleChange(
															parseFloat(e.target.value) || 0
														)
													}
													placeholder="0"
												/>
											</field.Field>
										)}
									</form.AppField>
								</div>
							</div>

							<Separator />

							{/* Rango de Edad */}
							<div>
								<h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
									<div className="flex size-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
										<CalendarRange className="size-3.5" />
									</div>
									Rango de Edad
								</h4>
								<div className="grid gap-3 sm:grid-cols-2">
									<form.AppField
										name={`priceCategories[${editingIndex}].ageMin`}
									>
										{(field) => (
											<field.Field>
												<field.FieldLabel>Edad Min</field.FieldLabel>
												<Input
													type="number"
													value={field.state.value ?? ""}
													onChange={(e) =>
														field.handleChange(
															e.target.value === ""
																? null
																: Number(e.target.value)
														)
													}
													placeholder="0"
												/>
											</field.Field>
										)}
									</form.AppField>

									<form.AppField
										name={`priceCategories[${editingIndex}].ageMax`}
									>
										{(field) => (
											<field.Field>
												<field.FieldLabel>Edad Max</field.FieldLabel>
												<Input
													type="number"
													value={field.state.value ?? ""}
													onChange={(e) =>
														field.handleChange(
															e.target.value === ""
																? null
																: Number(e.target.value)
														)
													}
													placeholder="64"
												/>
											</field.Field>
										)}
									</form.AppField>
								</div>
							</div>

							<Separator />

							{/* Entradas */}
							<div>
								<div className="mb-3 flex items-center justify-between">
									<h4 className="flex items-center gap-2 text-sm font-semibold">
										<div className="flex size-6 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400">
											<Ticket className="size-3.5" />
										</div>
										Entradas
									</h4>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => addEntry(editingIndex)}
									>
										<Plus className="h-4 w-4" />
										Agregar
									</Button>
								</div>

								{(!priceCategories[editingIndex]?.entries ||
									priceCategories[editingIndex].entries.length === 0) ? (
									<p className="text-muted-foreground rounded-md border border-dashed py-6 text-center text-sm">
										Sin entradas para esta categoria
									</p>
								) : (
									<div className="space-y-3">
										{priceCategories[editingIndex].entries.map(
											(_, entryIndex) => (
												<div
													key={entryIndex}
													className="rounded-lg border bg-muted/30 p-3"
												>
													<div className="mb-2 flex items-center justify-between">
														<span className="text-muted-foreground text-xs font-medium">
															Entrada {entryIndex + 1}
														</span>
														<Button
															type="button"
															variant="ghost"
															size="icon"
															className="h-6 w-6 text-destructive hover:text-destructive"
															onClick={() =>
																removeEntry(editingIndex, entryIndex)
															}
														>
															<Trash2 className="h-3.5 w-3.5" />
														</Button>
													</div>

													<div className="grid gap-3 sm:grid-cols-3">
														<form.AppField
															name={`priceCategories[${editingIndex}].entries[${entryIndex}].name`}
														>
															{(field) => (
																<field.Field
																	data-invalid={
																		field.state.meta.errors.length > 0
																	}
																>
																	<field.FieldLabel>
																		Nombre{" "}
																		<span className="text-destructive">
																			*
																		</span>
																	</field.FieldLabel>
																	<Input
																		value={field.state.value || ""}
																		onChange={(e) =>
																			field.handleChange(e.target.value)
																		}
																		placeholder="Valle de la Luna"
																	/>
																	<field.FieldError />
																</field.Field>
															)}
														</form.AppField>

														<form.AppField
															name={`priceCategories[${editingIndex}].entries[${entryIndex}].variantName`}
														>
															{(field) => (
																<field.Field
																	data-invalid={
																		field.state.meta.errors.length > 0
																	}
																>
																	<field.FieldLabel>
																		Variante{" "}
																		<span className="text-destructive">
																			*
																		</span>
																	</field.FieldLabel>
																	<Input
																		value={field.state.value || ""}
																		onChange={(e) =>
																			field.handleChange(e.target.value)
																		}
																		placeholder="Adulto"
																	/>
																	<field.FieldError />
																</field.Field>
															)}
														</form.AppField>

														<form.AppField
															name={`priceCategories[${editingIndex}].entries[${entryIndex}].price`}
														>
															{(field) => (
																<field.Field
																	data-invalid={
																		field.state.meta.errors.length > 0
																	}
																>
																	<field.FieldLabel>
																		Precio
																	</field.FieldLabel>
																	<Input
																		type="number"
																		value={field.state.value || ""}
																		onChange={(e) =>
																			field.handleChange(
																				parseFloat(e.target.value) || 0
																			)
																		}
																		placeholder="10800"
																	/>
																	<field.FieldError />
																</field.Field>
															)}
														</form.AppField>
													</div>

													<div className="mt-3 flex items-center gap-6">
														<form.AppField
															name={`priceCategories[${editingIndex}].entries[${entryIndex}].isDefault`}
														>
															{(field) => (
																<div className="flex items-center gap-2">
																	<Switch
																		checked={field.state.value || false}
																		onCheckedChange={(checked) =>
																			field.handleChange(checked)
																		}
																	/>
																	<Label className="text-xs">
																		Por defecto
																	</Label>
																</div>
															)}
														</form.AppField>

														<form.AppField
															name={`priceCategories[${editingIndex}].entries[${entryIndex}].isSpecial`}
														>
															{(field) => (
																<div className="flex items-center gap-2">
																	<Switch
																		checked={field.state.value || false}
																		onCheckedChange={(checked) =>
																			field.handleChange(checked)
																		}
																	/>
																	<Label className="text-xs">
																		Especial
																	</Label>
																</div>
															)}
														</form.AppField>
													</div>
												</div>
											)
										)}
									</div>
								)}
							</div>
						</div>
					)}

					<DialogFooter>
						<Button
							type="button"
							onClick={() => setEditingIndex(null)}
						>
							Listo
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}
