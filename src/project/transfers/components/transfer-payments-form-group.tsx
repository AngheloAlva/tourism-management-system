"use client"

import { Plus, Trash2, CalendarIcon } from "lucide-react"
import { es } from "date-fns/locale"
import { format } from "date-fns"

import { createClientId } from "@/shared/lib/create-client-id"
import { cn } from "@/lib/utils"

import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/shared/components/ui/tooltip"
import { withFieldGroup } from "@/shared/components/ui/tanstack-form"
import { Calendar } from "@/shared/components/ui/calendar"
import { Textarea } from "@/shared/components/ui/textarea"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import {
	Select,
	SelectItem,
	SelectValue,
	SelectContent,
	SelectTrigger,
} from "@/shared/components/ui/select"

const defaultPayment = {
	clientId: createClientId(),
	amount: "",
	refund: false,
	comments: "",
	method: "CASH" as const,
	date: new Date(),
	documentNumber: "",
}

export const TransferPaymentsFormGroup = withFieldGroup({
	defaultValues: {
		payments: [] as (typeof defaultPayment)[],
		comments: "",
	},
	render: function PaymentsRender({ group }) {
		return (
			<div className="-mt-22 space-y-6">
				<group.AppField name="payments" mode="array">
					{(field) => {
						const payments = field.state.value || []
						const calculateTotal = () => {
							return payments.reduce((total: number, payment) => {
								const amount = +payment.amount || 0
								return total + (payment.refund ? -amount : amount)
							}, 0)
						}

						return (
							<>
								<div className="flex items-center justify-end gap-2">
									<Button
										type="button"
										onClick={() =>
											field.pushValue({
												...defaultPayment,
												clientId: createClientId(),
												refund: true,
											})
										}
										variant="outline"
									>
										<Plus className="h-4 w-4" />
										Agregar Devolución
									</Button>
									<Button
										type="button"
										onClick={() =>
											field.pushValue({ ...defaultPayment, clientId: createClientId() })
										}
										variant="outline"
									>
										<Plus className="h-4 w-4" />
										Agregar Pago
									</Button>
								</div>

								{payments.length > 0 && (
									<Card className="bg-primary/5 border-primary/20">
										<CardContent>
											<div className="flex items-center justify-between">
												<div>
													<p className="text-muted-foreground text-sm">Total Acumulado</p>
													<p className="text-foreground text-2xl font-bold">
														$
														{calculateTotal().toLocaleString("es-CL", {
															minimumFractionDigits: 0,
															maximumFractionDigits: 0,
														})}{" "}
														CLP
													</p>
												</div>
												<div className="text-right">
													<p className="text-muted-foreground text-sm">Registros</p>
													<p className="text-foreground text-2xl font-bold">{payments.length}</p>
												</div>
											</div>
										</CardContent>
									</Card>
								)}

								{payments.length === 0 && (
									<Card className="border-dashed">
										<CardContent className="flex flex-col items-center justify-center py-12">
											<p className="text-muted-foreground mb-4">
												No hay pagos ni devoluciones registrados
											</p>
											<div className="flex gap-2">
												<Button
													type="button"
													onClick={() =>
														field.pushValue({ ...defaultPayment, clientId: createClientId() })
													}
													variant="outline"
												>
													<Plus className="h-4 w-4" />
													Agregar Pago
												</Button>
											</div>
										</CardContent>
									</Card>
								)}

								{payments.map((payment: any, index: number) => {
									const isRefund = payment.refund

									return (
										<Card key={payment.clientId || index} className="gap-2">
											<CardHeader className="flex flex-row items-center justify-between space-y-0">
												<div className="flex items-center gap-3">
													<CardTitle className="text-lg">
														{isRefund ? "Devolución" : "Pago"} {index + 1}
													</CardTitle>
													{isRefund && (
														<span className="bg-destructive/10 text-destructive rounded-full px-2 py-1 text-xs font-medium">
															Devolución
														</span>
													)}
												</div>
												<group.Subscribe
													selector={(state: any) => ({
														paymentStatus: state.values.paymentStatus,
														paymentsLength: (state.values.payments || []).length,
													})}
												>
													{({ paymentStatus, paymentsLength }: { paymentStatus: string; paymentsLength: number }) => {
														const isDeleteDisabled =
															paymentStatus !== "PENDING" && paymentsLength <= 1
														return (
															<TooltipProvider>
																<Tooltip>
																	<TooltipTrigger asChild>
																		<span>
																			<Button
																				type="button"
																				variant="ghost"
																				size="sm"
																				onClick={() => field.removeValue(index)}
																				disabled={isDeleteDisabled}
																				className="text-destructive hover:text-destructive"
																			>
																				<Trash2 className="h-4 w-4" />
																			</Button>
																		</span>
																	</TooltipTrigger>
																	{isDeleteDisabled && (
																		<TooltipContent>
																			Se requiere al menos un pago para este estado de pago
																		</TooltipContent>
																	)}
																</Tooltip>
															</TooltipProvider>
														)
													}}
												</group.Subscribe>
											</CardHeader>

											<CardContent>
												<div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
													<group.AppField name={`payments[${index}].method`}>
														{(subField) => (
															<subField.FieldSet>
																<subField.Field>
																	<subField.FieldLabel>
																		Medio de Pago <span className="text-primary">*</span>
																	</subField.FieldLabel>
																	<Select
																		value={subField.state.value || "CASH"}
																		onValueChange={(value) => {
																			subField.handleChange(value as typeof subField.state.value)
																			if (value === "CASH") {
																				;(group as any).setFieldValue(`payments[${index}].documentNumber`, "")
																			}
																		}}
																	>
																		<SelectTrigger className="w-full">
																			<SelectValue placeholder="Seleccione medio de pago" />
																		</SelectTrigger>
																		<SelectContent>
																			<SelectItem value="CASH">Efectivo</SelectItem>
																			<SelectItem value="TRANSFER">Transferencia</SelectItem>
																			<SelectItem value="CREDIT_CARD">
																				Tarjeta de Credito
																			</SelectItem>
																			<SelectItem value="DEBIT_CARD">Tarjeta de Debito</SelectItem>
																			<SelectItem value="PAYMENT_LINK_DEBIT">
																				Link de pago Debito
																			</SelectItem>
																			<SelectItem value="PAYMENT_LINK_CREDIT">
																				Link de pago Credito
																			</SelectItem>
																		</SelectContent>
																	</Select>
																</subField.Field>
																<subField.FieldError />
															</subField.FieldSet>
														)}
													</group.AppField>

													<group.AppField name={`payments[${index}].amount`}>
														{(subField) => (
															<subField.FieldSet>
																<subField.Field>
																	<subField.FieldLabel>
																		Monto (CLP) <span className="text-primary">*</span>
																	</subField.FieldLabel>
																	<div className="relative">
																		<span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2">
																			$
																		</span>
																		<Input
																			id={`payments[${index}].amount`}
																			name={`payments[${index}].amount`}
																			type="number"
																			min="0"
																			step="1"
																			value={subField.state.value || ""}
																			onBlur={subField.handleBlur}
																			onChange={(e) => subField.handleChange(e.target.value)}
																			placeholder="50000"
																			className="pl-7"
																		/>
																	</div>
																</subField.Field>
																<subField.FieldError />
															</subField.FieldSet>
														)}
													</group.AppField>

													<group.AppField name={`payments[${index}].date`}>
														{(subField) => (
															<subField.FieldSet>
																<subField.Field>
																	<subField.FieldLabel>
																		Fecha de Movimiento <span className="text-primary">*</span>
																	</subField.FieldLabel>
																	<Popover>
																		<PopoverTrigger asChild>
																			<Button
																				variant="outline"
																				className={cn(
																					"w-full justify-start text-left font-normal",
																					!subField.state.value && "text-muted-foreground"
																				)}
																			>
																				<CalendarIcon className="h-4 w-4" />
																				{subField.state.value ? (
																					format(subField.state.value, "PPP", { locale: es })
																				) : (
																					<span>Seleccione una fecha</span>
																				)}
																			</Button>
																		</PopoverTrigger>
																		<PopoverContent className="w-auto p-0" align="start">
																			<Calendar
																				required
																				mode="single"
																				selected={subField.state.value}
																				onSelect={(date) => date && subField.handleChange(date)}
																				initialFocus
																				locale={es}
																			/>
																		</PopoverContent>
																	</Popover>
																</subField.Field>
																<subField.FieldError />
															</subField.FieldSet>
														)}
													</group.AppField>

													<group.Subscribe
														selector={(state: any) => state.values.payments?.[index]?.method}
													>
														{(method: string) =>
															method !== "CASH" && (
																<group.AppField name={`payments[${index}].documentNumber`}>
																	{(subField) => (
																		<subField.FieldSet>
																			<subField.Field>
																				<subField.FieldLabel>
																					Número de Documento / Referencia{" "}
																					<span className="text-primary">*</span>
																				</subField.FieldLabel>
																				<Input
																					id={`payments[${index}].documentNumber`}
																					name={`payments[${index}].documentNumber`}
																					value={subField.state.value || ""}
																					onBlur={subField.handleBlur}
																					onChange={(e) => subField.handleChange(e.target.value)}
																					placeholder="Ej: 123456789"
																				/>
																				<subField.FieldDescription className="text-muted-foreground text-sm">
																					Número de transacción, boleta o referencia
																				</subField.FieldDescription>
																			</subField.Field>
																			<subField.FieldError />
																		</subField.FieldSet>
																	)}
																</group.AppField>
															)
														}
													</group.Subscribe>

													<group.AppField name={`payments[${index}].comments`}>
														{(subField) => (
															<subField.FieldSet className="md:col-span-2">
																<subField.Field>
																	<subField.FieldLabel>Comentarios</subField.FieldLabel>
																	<Textarea
																		id={`payments[${index}].comments`}
																		name={`payments[${index}].comments`}
																		value={subField.state.value || ""}
																		onBlur={subField.handleBlur}
																		onChange={(e) => subField.handleChange(e.target.value)}
																		placeholder="Comentarios adicionales sobre el pago (opcional)"
																		rows={3}
																		className="resize-none"
																	/>
																</subField.Field>
																<subField.FieldError />
															</subField.FieldSet>
														)}
													</group.AppField>
												</div>
											</CardContent>
										</Card>
									)
								})}
							</>
						)
					}}
				</group.AppField>

				<group.AppField name="comments">
					{(field) => (
						<field.FieldSet>
							<field.Field>
								<field.FieldLabel>Comentarios Generales</field.FieldLabel>
								<Textarea
									id="comments"
									name="comments"
									value={field.state.value || ""}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Comentarios adicionales sobre la recepción (opcional)"
									rows={3}
									className="resize-none"
								/>
							</field.Field>
							<field.FieldError />
						</field.FieldSet>
					)}
				</group.AppField>
			</div>
		)
	},
})
