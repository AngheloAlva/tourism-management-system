"use client"

import { withFieldGroup } from "@/shared/components/ui/tanstack-form"
import { CalendarIcon, Plus, Trash2 } from "lucide-react"

import { FileUpload } from "@/shared/components/file-upload"

import { es } from "date-fns/locale"
import { format } from "date-fns"

import { createClientId } from "@/shared/lib/create-client-id"
import { cn } from "@/lib/utils"
import { getPaymentAmountInClp } from "../../utils/sale-calculations"

import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover"
import { Calendar } from "@/shared/components/ui/calendar"
import { Textarea } from "@/shared/components/ui/textarea"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import {
	Select,
	SelectItem,
	SelectValue,
	SelectTrigger,
	SelectContent,
} from "@/shared/components/ui/select"
import {
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	CardDescription,
} from "@/shared/components/ui/card"
import { PaymentDetail } from "../../schemas/sale-record.schema"

export const PaymentFormGroup = withFieldGroup({
	defaultValues: {
		paymentArray: [
			{
				clientId: createClientId(),
				amount: 0,
				currency: "CLP",
				exchange_rate: undefined,
				comments: "",
				refund: false,
				method: "CASH",
				paymentProof: "",
				document_number: "",
				movement_date: new Date(),
			},
		],
		discount: 0,
	},
	render: function Step4Render({ group }) {
		const calculateTotal = () => {
			const payments = group.state.values.paymentArray || []
			return payments.reduce((total, payment) => {
				const amountInClp = getPaymentAmountInClp(
					payment as PaymentDetail & {
						exchangeRate?: number | null
					}
				)
				return total + (payment.refund ? -amountInClp : amountInClp)
			}, 0)
		}

		return (
			<div className="space-y-4">
				<CardHeader className="gap-0">
					<CardTitle className="text-2xl font-bold">Registro de Pagos</CardTitle>
					<CardDescription>Agregar uno o más pagos para esta venta/cotización</CardDescription>
				</CardHeader>

				<CardContent className="space-y-6">
					<Card className="bg-primary/5 border-primary/20">
						<CardContent className="">
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
									<p className="text-foreground text-2xl font-bold">
										{group.state.values.paymentArray.length}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<group.AppField name="paymentArray" mode="array">
						{(field) => (
							<>
								<div className="w-full space-y-4 divide-y-2">
								{field.state.value.map((paymentValue, index) => (
									<group.Subscribe
										key={paymentValue.clientId || index}
										selector={({ values }) => ({
											refund: values.paymentArray[index].refund,
											currency: values.paymentArray[index].currency,
											amount: values.paymentArray[index].amount,
											exchangeRate: values.paymentArray[index].exchange_rate,
										})}
									>
										{({ refund, currency, amount, exchangeRate }) => (
											<div
												key={paymentValue.clientId || index}
												className="grid grid-cols-1 gap-x-4 gap-y-5 pb-6 lg:grid-cols-2"
											>
												<h3 className="text-lg font-semibold lg:col-span-2">
													{refund ? "Devolución" : "Pago"} {index + 1}
												</h3>

												<group.AppField name={`paymentArray[${index}].method`}>
													{(field) => {
														const options = [
															{ label: "Efectivo", value: "CASH" },
															{ label: "Transferencia", value: "TRANSFER" },
															{ label: "Tarjeta de Credito", value: "CREDIT_CARD" },
															{ label: "Tarjeta de Debito", value: "DEBIT_CARD" },
															{ label: "Link de pago Debito", value: "PAYMENT_LINK_DEBIT" },
															{ label: "Link de pago Credito", value: "PAYMENT_LINK_CREDIT" },
														]
														return (
															<field.FieldSet className="w-full content-start">
																<field.Field>
																	<field.FieldLabel htmlFor={`paymentArray[${index}].method`}>
																		Medio de Pago <span className="text-primary">*</span>
																	</field.FieldLabel>
																</field.Field>
																<Select
																	name={`paymentArray[${index}].method`}
																	value={(field.state.value as string | undefined) ?? ""}
																	onValueChange={field.handleChange}
																	defaultValue={String(field?.state.value ?? "")}
																	disabled={false}
																	aria-invalid={
																		!!field.state.meta.errors.length && field.state.meta.isTouched
																	}
																>
																	<field.Field>
																		<SelectTrigger className="w-full">
																			<SelectValue placeholder="Seleccione un medio de pago" />
																		</SelectTrigger>
																	</field.Field>
																	<SelectContent>
																		{options.map(({ label, value }) => (
																			<SelectItem key={value} value={value}>
																				{label}
																			</SelectItem>
																		))}
																	</SelectContent>
																</Select>

																<field.FieldError />
															</field.FieldSet>
														)
													}}
												</group.AppField>

												<group.AppField name={`paymentArray[${index}].currency`}>
													{(field) => (
														<field.FieldSet className="w-full content-start">
															<field.Field>
																<field.FieldLabel htmlFor={`paymentArray[${index}].currency`}>
																	Moneda <span className="text-primary">*</span>
																</field.FieldLabel>
															</field.Field>
															<Select
																name={`paymentArray[${index}].currency`}
																value={(field.state.value as string | undefined) ?? "CLP"}
																onValueChange={field.handleChange}
																defaultValue={String(field?.state.value ?? "CLP")}
																disabled={false}
																aria-invalid={
																	!!field.state.meta.errors.length && field.state.meta.isTouched
																}
															>
																<field.Field>
																	<SelectTrigger className="w-full">
																		<SelectValue placeholder="Seleccione moneda" />
																	</SelectTrigger>
																</field.Field>
																<SelectContent>
																	<SelectItem value="CLP">CLP</SelectItem>
																	<SelectItem value="USD">USD</SelectItem>
																</SelectContent>
															</Select>
															<field.FieldError />
														</field.FieldSet>
													)}
												</group.AppField>

												<group.AppField name={`paymentArray[${index}].amount`}>
													{(field) => (
														<field.FieldSet className="w-full">
															<field.Field>
																<field.FieldLabel htmlFor={`paymentArray[${index}].amount`}>
																	Monto ({currency === "USD" ? "USD" : "CLP"}){" "}
																	<span className="text-primary">*</span>
																</field.FieldLabel>
																<Input
																	name={`paymentArray[${index}].amount`}
																	placeholder={currency === "USD" ? "100" : "50000"}
																	type="number"
																	step={"any"}
																	inputMode="decimal"
																	value={(field.state.value as number | undefined) ?? ""}
																	onBlur={field.handleBlur}
																	onChange={(e) => field.handleChange(e.target.valueAsNumber)}
																	aria-invalid={
																		!!field.state.meta.errors.length && field.state.meta.isTouched
																	}
																/>
															</field.Field>

															{currency === "USD" && (
																<div className="space-y-1">
																	<field.FieldDescription>
																		Valor CLP estimado: $
																		{getPaymentAmountInClp({
																			amount: amount || 0,
																			currency,
																			exchange_rate: exchangeRate,
																		}).toLocaleString("es-CL", {
																			minimumFractionDigits: 0,
																			maximumFractionDigits: 0,
																		})}
																	</field.FieldDescription>
																	{Number(amount || 0) > 0 &&
																		!Number.isInteger(Number(amount || 0)) && (
																			<div className="flex flex-wrap gap-2">
																				<Button
																					type="button"
																					size="sm"
																					variant="outline"
																					onClick={() =>
																						field.handleChange(Math.floor(Number(amount || 0)))
																					}
																				>
																					Usar {Math.floor(Number(amount || 0))} USD
																				</Button>
																				<Button
																					type="button"
																					size="sm"
																					variant="outline"
																					onClick={() =>
																						field.handleChange(Math.ceil(Number(amount || 0)))
																					}
																				>
																					Usar {Math.ceil(Number(amount || 0))} USD
																				</Button>
																			</div>
																		)}
																</div>
															)}

															<field.FieldError />
														</field.FieldSet>
													)}
												</group.AppField>

												{currency === "USD" && (
													<group.AppField name={`paymentArray[${index}].exchange_rate` as any}>
														{(field) => (
															<field.FieldSet className="w-full">
																<field.Field>
																	<field.FieldLabel
																		htmlFor={`paymentArray[${index}].exchange_rate`}
																	>
																		Tipo de Cambio (CLP por 1 USD){" "}
																		<span className="text-primary">*</span>
																	</field.FieldLabel>
																	<Input
																		name={`paymentArray[${index}].exchange_rate`}
																		placeholder="890"
																		type="number"
																		inputMode="decimal"
																		value={(field.state.value as number | undefined) ?? ""}
																		onBlur={field.handleBlur}
																		onChange={(e) =>
																			field.handleChange(e.target.valueAsNumber as any)
																		}
																		aria-invalid={
																			!!field.state.meta.errors.length && field.state.meta.isTouched
																		}
																	/>
																</field.Field>
																<field.FieldError />
															</field.FieldSet>
														)}
													</group.AppField>
												)}

												<group.AppField name={`paymentArray[${index}].movement_date`}>
													{(field) => {
														const date = field.state.value
														return (
															<field.FieldSet className="flex w-full flex-col">
																<field.Field>
																	<field.FieldLabel
																		htmlFor={`paymentArray[${index}].movement_date`}
																	>
																		Fecha de Movimiento <span className="text-primary">*</span>
																	</field.FieldLabel>
																	<Popover>
																		<PopoverTrigger
																			asChild
																			disabled={false}
																			aria-invalid={
																				!!field.state.meta.errors.length &&
																				field.state.meta.isTouched
																			}
																		>
																			<Button
																				variant={"outline"}
																				className={cn(
																					"w-full justify-start text-start font-normal",
																					!date && "text-muted-foreground"
																				)}
																			>
																				<CalendarIcon className="size-4" />
																				{date ? (
																					format(date, "PPP", { locale: es })
																				) : (
																					<span>Pick a date</span>
																				)}
																			</Button>
																		</PopoverTrigger>
																		<PopoverContent className="w-auto p-0" align="start">
																			<Calendar
																				mode="single"
																				selected={field.state.value as unknown as Date | undefined}
																				onSelect={(newDate) => {
																					field.handleChange(newDate as Date)
																				}}
																				aria-invalid={
																					!!field.state.meta.errors.length &&
																					field.state.meta.isTouched
																				}
																			/>
																		</PopoverContent>
																	</Popover>

																	<field.FieldError />
																</field.Field>
															</field.FieldSet>
														)
													}}
												</group.AppField>

												<group.AppField name={`paymentArray[${index}].document_number`}>
													{(field) => (
														<field.FieldSet className="w-full">
															<field.Field>
																<field.FieldLabel
																	htmlFor={`paymentArray[${index}].document_number`}
																>
																	Numero de Documento
																</field.FieldLabel>
																<Input
																	name={`paymentArray[${index}].document_number`}
																	placeholder="123456789"
																	type="text"
																	value={(field.state.value as string | undefined) ?? ""}
																	onBlur={field.handleBlur}
																	onChange={(e) => field.handleChange(e.target.value)}
																	aria-invalid={
																		!!field.state.meta.errors.length && field.state.meta.isTouched
																	}
																/>
															</field.Field>
															<field.FieldDescription>
																Número de transacción, boleta o referencia
															</field.FieldDescription>
															<field.FieldError />
														</field.FieldSet>
													)}
												</group.AppField>

												<group.AppField name={`paymentArray[${index}].paymentProof`}>
													{(field) => (
														<field.FieldSet className="w-full lg:col-span-2">
															<field.Field>
																<field.FieldLabel>Comprobante de Pago</field.FieldLabel>
																<FileUpload
																	value={(field.state.value as string | undefined) ?? ""}
																	onUploadComplete={(url) => field.handleChange(url)}
																	onRemove={() => field.handleChange("")}
																/>
															</field.Field>
															<field.FieldError />
														</field.FieldSet>
													)}
												</group.AppField>

												<group.AppField name={`paymentArray[${index}].comments`}>
													{(field) => (
														<field.FieldSet className="w-full lg:col-span-2">
															<field.Field>
																<field.FieldLabel htmlFor={`paymentArray[${index}].comments`}>
																	Comentarios
																</field.FieldLabel>
																<Textarea
																	placeholder="Comentarios adicionales sobre el pago (opcional)"
																	required={false}
																	disabled={false}
																	value={(field.state.value as string | undefined) ?? ""}
																	name={`paymentArray[${index}].comments`}
																	onChange={(e) => field.handleChange(e.target.value)}
																	onBlur={field.handleBlur}
																	className="h-24"
																	aria-invalid={
																		!!field.state.meta.errors.length && field.state.meta.isTouched
																	}
																/>
															</field.Field>
															<field.FieldError />
														</field.FieldSet>
													)}
												</group.AppField>
											</div>
										)}
									</group.Subscribe>
								))}

								<div className="flex justify-between pt-2">
									<div className="flex gap-2">
										<Button
											type="button"
											variant="outline"
											className="border-primary/50"
											onClick={() =>
												field.pushValue(
													{
														clientId: createClientId(),
														amount: 0,
														currency: "CLP",
														exchange_rate: undefined,
														comments: "",
														refund: false,
														method: "CASH",
														paymentProof: "",
														document_number: "",
														movement_date: new Date(),
													},
													{ dontValidate: true }
												)
											}
										>
											<Plus className="h-4 w-4" /> Agregar Pago
										</Button>

										<Button
											variant="outline"
											type="button"
											onClick={() =>
												field.pushValue(
													{
														clientId: createClientId(),
														amount: 0,
														currency: "CLP",
														exchange_rate: undefined,
														refund: true,
														comments: "",
														method: "CASH",
														paymentProof: "",
														document_number: "",
														movement_date: new Date(),
													},
													{ dontValidate: true }
												)
											}
										>
											<Plus className="h-4 w-4" /> Agregar Devolución
										</Button>
									</div>

									<Button
										variant="outline"
										type="button"
										onClick={() => field.removeValue(field.state.value.length - 1)}
										disabled={field.state.value.length <= 1}
									>
										<Trash2 className="h-4 w-4" /> Eliminar
									</Button>
								</div>
								</div>
								<field.FieldError />
							</>
						)}
					</group.AppField>

					<group.AppField name={"discount"}>
						{(field) => (
							<field.FieldSet className="w-full">
								<field.Field>
									<field.FieldLabel htmlFor={"discount"}>Descuento</field.FieldLabel>
									<Input
										name={"discount"}
										placeholder="0"
										type="number"
										inputMode="decimal"
										value={(field.state.value as number | undefined) ?? ""}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.valueAsNumber)}
										aria-invalid={!!field.state.meta.errors.length && field.state.meta.isTouched}
									/>
								</field.Field>
								<field.FieldDescription>
									Este descuento se aplica al todos los Eventos/Tours sin incluir precios de
									entradas.
								</field.FieldDescription>
								<field.FieldError />
							</field.FieldSet>
						)}
					</group.AppField>
				</CardContent>
			</div>
		)
	},
})
