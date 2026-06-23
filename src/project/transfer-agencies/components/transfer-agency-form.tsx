"use client"

import { PlusCircleIcon, XCircleIcon } from "lucide-react"
import { toast } from "sonner"

import { transferAgencySchema, type CreateTransferAgency } from "../schemas/transfer-agency.schema"
import { useCreateTransferAgency, useUpdateTransferAgency } from "../hooks/use-transfer-agencies"
import { useAppForm } from "@/shared/components/ui/tanstack-form"

import { Field, FieldContent, FieldError, FieldLabel } from "@/shared/components/ui/field"
import { Spinner } from "@/shared/components/ui/spinner"
import { Button } from "@/shared/components/ui/button"
import { Switch } from "@/shared/components/ui/switch"
import { Input } from "@/shared/components/ui/input"

import type { TransferAgency } from "../types/transfer-agency"

interface TransferAgencyFormProps {
	agency?: TransferAgency | null
	onSuccess?: () => void
}

export function TransferAgencyForm({ agency, onSuccess }: TransferAgencyFormProps) {
	const isEditing = !!agency

	const createAgency = useCreateTransferAgency()
	const updateAgency = useUpdateTransferAgency()

	const form = useAppForm({
		defaultValues: {
			name: agency?.name || "",
			phone: agency?.phone || "",
			taxId: agency?.taxId || "",
			country: agency?.country || "",
			address: agency?.address || "",
			website: agency?.website || "",
			active: agency?.active ?? true,
			contactEmails: agency?.contactEmails?.map((email) => ({ email })) || [{ email: "" }],
		} as CreateTransferAgency,
		validators: {
			onChange: transferAgencySchema as any,
		},
		onSubmit: async ({ value }) => {
			try {
				if (isEditing) {
					await updateAgency.mutateAsync({
						id: agency.id,
						name: value.name,
						active: value.active,
						phone: value.phone || null,
						taxId: value.taxId || null,
						country: value.country || null,
						address: value.address || null,
						website: value.website || null,
						contactEmails: value.contactEmails,
					})
				} else {
					await createAgency.mutateAsync({
						name: value.name,
						active: value.active,
						phone: value.phone || null,
						taxId: value.taxId || null,
						country: value.country || null,
						address: value.address || null,
						website: value.website || null,
						contactEmails: value.contactEmails,
					})
				}

				onSuccess?.()
			} catch (error) {
				toast.error("Error al guardar la agencia de transfer", {
					description: (error as Error).message,
				})
			}
		},
	})

	const isLoading = createAgency.isPending || updateAgency.isPending

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault()
				e.stopPropagation()
				form.handleSubmit()
			}}
			className="space-y-6"
		>
			<div className="grid gap-4 md:grid-cols-2">
				<form.Field name="name">
					{(field) => (
						<Field data-invalid={field.state.meta.errors.length > 0} className="md:col-span-2">
							<FieldLabel htmlFor={field.name}>Nombre</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="Ej: Andes Incoming"
							/>
							{field.state.meta.errors.length > 0 && (
								<FieldError errors={field.state.meta.errors} />
							)}
						</Field>
					)}
				</form.Field>

				<form.Field name="taxId">
					{(field) => (
						<Field>
							<FieldLabel htmlFor={field.name}>RUT / Tax ID</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								value={field.state.value || ""}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="76.123.456-7"
							/>
						</Field>
					)}
				</form.Field>

				<form.Field name="phone">
					{(field) => (
						<Field>
							<FieldLabel htmlFor={field.name}>Teléfono</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								value={field.state.value || ""}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="+56912345678"
							/>
						</Field>
					)}
				</form.Field>

				<form.Field name="country">
					{(field) => (
						<Field>
							<FieldLabel htmlFor={field.name}>País</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								value={field.state.value || ""}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="Chile"
							/>
						</Field>
					)}
				</form.Field>

				<form.Field name="website">
					{(field) => (
						<Field>
							<FieldLabel htmlFor={field.name}>Sitio web</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								value={field.state.value || ""}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="https://empresa.cl"
							/>
						</Field>
					)}
				</form.Field>

				<form.Field name="address">
					{(field) => (
						<Field className="md:col-span-2">
							<FieldLabel htmlFor={field.name}>Dirección</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								value={field.state.value || ""}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="Dirección de referencia"
							/>
						</Field>
					)}
				</form.Field>

				<form.Field name="active">
					{(field) => (
						<Field>
							<FieldContent>
								<FieldLabel htmlFor={field.name}>Activo</FieldLabel>
								<Switch
									id={field.name}
									checked={Boolean(field.state.value)}
									onCheckedChange={(checked) => field.handleChange(Boolean(checked))}
								/>
							</FieldContent>
						</Field>
					)}
				</form.Field>
			</div>

			<form.Field name="contactEmails" mode="array">
				{(field) => (
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<FieldLabel>Correos de contacto</FieldLabel>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => field.pushValue({ email: "" })}
							>
								<PlusCircleIcon className="h-4 w-4" />
								Agregar correo
							</Button>
						</div>

						<div className="space-y-2">
							{field.state.value.map((_, index) => (
								<div key={index} className="flex items-start gap-2">
									<form.Field name={`contactEmails[${index}].email`}>
										{(emailField) => (
											<Field
												data-invalid={emailField.state.meta.errors.length > 0}
												className="flex-1"
											>
												<Input
													id={emailField.name}
													name={emailField.name}
													type="email"
													value={emailField.state.value || ""}
													onBlur={emailField.handleBlur}
													onChange={(e) => emailField.handleChange(e.target.value)}
													placeholder="contacto@empresa.cl"
												/>
												{emailField.state.meta.errors.length > 0 && (
													<FieldError errors={emailField.state.meta.errors} />
												)}
											</Field>
										)}
									</form.Field>

									<Button
										type="button"
										variant="ghost"
										size="icon"
										onClick={() => field.removeValue(index)}
										disabled={field.state.value.length <= 1}
									>
										<XCircleIcon className="h-4 w-4" />
									</Button>
								</div>
							))}
						</div>
					</div>
				)}
			</form.Field>

			<div className="flex justify-end gap-2">
				<Button type="submit" className="bg-primary hover:bg-orange-600" disabled={isLoading}>
					{isLoading && <Spinner className="h-4 w-4" />}
					{isEditing ? "Actualizar Agencia" : "Crear Agencia"}
				</Button>
			</div>
		</form>
	)
}
