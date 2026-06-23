"use client"

import { withFieldGroup } from "@/shared/components/ui/tanstack-form"
import { useField } from "@tanstack/react-form"

import { useSaleFormStore } from "../../stores/sale-form.store"

import { CardTitle, CardHeader, CardContent, CardDescription } from "@/shared/components/ui/card"
import { AgencySearchSelect } from "@/shared/components/agency-search-select"
import { Textarea } from "@/shared/components/ui/textarea"
import { Button } from "@/shared/components/ui/button"
import { Switch } from "@/shared/components/ui/switch"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import {
	Select,
	SelectItem,
	SelectValue,
	SelectTrigger,
	SelectContent,
} from "@/shared/components/ui/select"

import { CHANNEL_LABELS, CHANNEL_TYPE } from "@/project/sales/constants/enums"

export const GeneralInfoFormGroup = withFieldGroup({
	defaultValues: {
		type: "SALE",
		comments: "",
		agencyId: "",
		codeLength: 0,
		codePrefix: "",
		channel: "AGENCIA",
		isWholesale: false,
		paymentPending: false,
		wholesaleAgencyId: "",
		fileNumber: "",
		fileNumberPending: false,
	},
	render: function Step1Render({ group }) {
		const codePrefixField = useField({
			name: "codePrefix",
			form: group.form,
		})
		const codeLengthField = useField({
			name: "codeLength",
			form: group.form,
		})
		const fileNumberPendingField = useField({
			name: "fileNumberPending",
			form: group.form,
		})

		const { setAgencyName, setWholesaleAgencyName } = useSaleFormStore()

		return (
			<group.Subscribe
				selector={({ values }) => ({
					type: values.type,
					channel: values.channel,
					codePrefix: values.codePrefix,
					codeLength: values.codeLength,
					isWholesale: values.isWholesale,
					fileNumberPending: values.fileNumberPending,
				})}
			>
				{({ type, channel, codePrefix, codeLength, isWholesale, fileNumberPending }) => {
					return (
						<div className="space-y-4">
							<CardHeader className="gap-0">
								<CardTitle className="text-2xl font-bold">Información General</CardTitle>
								<CardDescription>Información maestra de la transacción</CardDescription>
							</CardHeader>

							<CardContent className="grid grid-cols-1 gap-x-4 gap-y-5 lg:grid-cols-2">
								<group.AppField name={"type"}>
									{(field) => {
										const options = [
											{ label: "Venta", value: "SALE" },
											{ label: "Cotización", value: "QUOTE" },
										]
										return (
											<field.FieldSet className="w-full">
												<field.Field>
													<field.FieldLabel htmlFor={"type"}>
														Tipo de Registro <span className="text-primary">*</span>
													</field.FieldLabel>
												</field.Field>
												<Select
													name={"type"}
													disabled={false}
													onValueChange={field.handleChange}
													defaultValue={String(field?.state.value ?? "")}
													value={(field.state.value as string | undefined) ?? ""}
													aria-invalid={
														!!field.state.meta.errors.length && field.state.meta.isTouched
													}
												>
													<field.Field>
														<SelectTrigger className="w-full">
															<SelectValue placeholder="Seleccione tipo de registro" />
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

								<group.AppField name={"channel"}>
									{(field) => {
										const options = CHANNEL_TYPE.map((value) => ({
											label: CHANNEL_LABELS[value],
											value,
										}))
										return (
											<field.FieldSet className="w-full">
												<field.Field>
													<field.FieldLabel htmlFor={"channel"}>
														Canal de Venta <span className="text-primary">*</span>
													</field.FieldLabel>
												</field.Field>
												<Select
													name={"channel"}
													value={(field.state.value as string | undefined) ?? ""}
													onValueChange={(value) => {
														field.handleChange(value)

														if (value !== "ONLINE" && value !== "PHYSICAL") {
															group.form.setFieldValue("isWholesale", false)
															group.form.setFieldValue("wholesaleAgencyId", "")
														}

														group.form.setFieldValue("paymentPending", value === "WHOLESALE")

														if (value === "WHOLESALE") {
															group.form.setFieldValue("fileNumber", "")
															group.form.setFieldValue("fileNumberPending", false)
														}
													}}
													defaultValue={String(field?.state.value ?? "")}
													disabled={false}
													aria-invalid={
														!!field.state.meta.errors.length && field.state.meta.isTouched
													}
												>
													<field.Field>
														<SelectTrigger className="w-full">
															<SelectValue placeholder="Seleccione canal de venta" />
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

								{(channel === "ONLINE" || channel === "PHYSICAL") && (
									<group.AppField name={"isWholesale"}>
										{(field) => (
											<field.FieldSet>
												<field.Field className="flex flex-row items-center justify-between rounded-lg border p-4">
													<div className="flex-1 space-y-0.5">
														<field.FieldLabel htmlFor={"isWholesale"}>
															¿Es Mayorista?
														</field.FieldLabel>
														<field.FieldDescription>
															Pasajero llegó vía mayorista (aplica recargo del 30%)
														</field.FieldDescription>
													</div>

													<div className="flex-0">
														<Switch
															onCheckedChange={field.handleChange}
															checked={field.state.value as boolean}
															aria-invalid={
																!!field.state.meta.errors.length && field.state.meta.isTouched
															}
														/>
													</div>
												</field.Field>

												<field.FieldError />
											</field.FieldSet>
										)}
									</group.AppField>
								)}

								{(channel === "ONLINE" || channel === "PHYSICAL") && isWholesale && (
									<group.AppField name={"wholesaleAgencyId"}>
										{(field) => (
											<field.FieldSet className="w-full content-start">
												<field.Field>
													<field.FieldLabel htmlFor={"channel"}>Mayorista</field.FieldLabel>
												</field.Field>

												<AgencySearchSelect
													activeOnly={true}
													value={field.state.value}
													onValueChange={field.handleChange}
													placeholder="Buscar agencia mayorista..."
													onAgencySelect={(agency) => setWholesaleAgencyName(agency?.name || "")}
												/>
												<field.FieldError />
											</field.FieldSet>
										)}
									</group.AppField>
								)}

								{channel === "WHOLESALE" && (
									<group.AppField name={"agencyId"}>
										{(field) => (
											<field.FieldSet className="w-full content-start">
												<field.Field>
													<field.FieldLabel htmlFor={"agencyId"}>Mayorista</field.FieldLabel>
												</field.Field>

												<AgencySearchSelect
													activeOnly={true}
													showCodePrefix={true}
													value={field.state.value}
													placeholder="Buscar mayorista..."
													onValueChange={field.handleChange}
													setCodePrefix={(prefix) => codePrefixField.setValue(prefix)}
													setCodeLength={(length) => codeLengthField.setValue(length)}
													onAgencySelect={(agency) => setAgencyName(agency?.name || "")}
												/>
												<field.FieldError />
											</field.FieldSet>
										)}
									</group.AppField>
								)}

								{channel === "WHOLESALE" && (
									<group.AppField name={"fileNumber"}>
										{(field) => (
											<field.FieldSet className="w-full">
												<field.Field>
													<div className="flex items-center justify-between">
														<field.FieldLabel htmlFor={"fileNumber"}>
															Número de File
														</field.FieldLabel>

														<div className="-mt-1.5 flex items-center gap-2">
															<Label
																htmlFor="filePendiente"
																className="text-muted-foreground cursor-pointer text-sm"
															>
																¿Pendiente?
															</Label>

															<Switch
																id="filePendiente"
																checked={fileNumberPending}
																onCheckedChange={() => {
																	if (field.state.value === "PENDIENTE") {
																		field.setValue("")
																		fileNumberPendingField.setValue(false)
																	} else {
																		field.setValue("PENDIENTE")
																		fileNumberPendingField.setValue(true)
																	}
																}}
															/>
														</div>
													</div>

													<div className="flex items-center">
														{!fileNumberPending && codePrefix && (
															<Button
																disabled
																type="button"
																variant="outline"
																className="rounded-r-none px-2 disabled:opacity-100"
															>
																{codePrefix}
															</Button>
														)}
														<Input
															required={false}
															name={"fileNumber"}
															placeholder="AB1234"
															maxLength={codeLength || undefined}
															onBlur={field.handleBlur}
															disabled={!!fileNumberPending}
															onChange={(e) => field.handleChange(e.target.value)}
															value={(field.state.value as string | undefined) ?? ""}
															className={!fileNumberPending && codePrefix ? "rounded-l-none border-l-0" : ""}
															aria-invalid={
																!!field.state.meta.errors.length && field.state.meta.isTouched
															}
														/>
													</div>
												</field.Field>
												<field.FieldDescription>
													{codePrefix || codeLength ? (
														codeLength ? (
															<>
																Longitud exacta:{" "}
																<span className="text-primary">{codeLength}</span> caracteres
															</>
														) : null
													) : (
														"Este mayorista no tiene prefijo ni longitud configurada, ingrese el número de file libremente"
													)}
												</field.FieldDescription>
												<field.FieldError />
											</field.FieldSet>
										)}
									</group.AppField>
								)}

								{channel === "WHOLESALE" && type === "SALE" && (
									<group.AppField name={"paymentPending"}>
										{(field) => (
											<field.FieldSet>
												<field.Field className="flex flex-row items-center justify-between rounded-lg border p-4">
													<div className="flex-1 space-y-0.5">
														<field.FieldLabel htmlFor={"paymentPending"}>
															Pago Pendiente
														</field.FieldLabel>
														<field.FieldDescription>
															El pago se realizará posteriormente (facturación mensual)
														</field.FieldDescription>
													</div>

													<div className="flex-0">
														<Switch
															onCheckedChange={field.handleChange}
															checked={field.state.value as boolean}
															aria-invalid={
																!!field.state.meta.errors?.length && field.state.meta.isTouched
															}
														/>
													</div>
												</field.Field>

												<field.FieldError />
											</field.FieldSet>
										)}
									</group.AppField>
								)}

								<group.AppField name={"comments"}>
									{(field) => (
										<field.FieldSet className="w-full lg:col-span-2">
											<field.Field>
												<field.FieldLabel htmlFor={"comments"}>Comentarios </field.FieldLabel>
												<Textarea
													required={false}
													disabled={false}
													name={"comments"}
													className="h-24"
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
													placeholder="Ingrese comentarios adicionales (opcional)"
													value={(field.state.value as string | undefined) ?? ""}
													aria-invalid={
														!!field.state.meta.errors.length && field.state.meta.isTouched
													}
												/>
											</field.Field>
											<field.FieldError />
										</field.FieldSet>
									)}
								</group.AppField>
							</CardContent>
						</div>
					)
				}}
			</group.Subscribe>
		)
	},
})
