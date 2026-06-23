"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { useAppForm } from "@/shared/components/ui/tanstack-form"
import { Input } from "@/shared/components/ui/input"
import { changePasswordSchema } from "../schemas/change-password.schema"
import { changeMyPasswordAction } from "../actions/change-password.actions"

import type { ChangePasswordFormData } from "../schemas/change-password.schema"

interface ChangePasswordFormProps {
	/** Called after a successful password change. When omitted, redirects to /dashboard/inicio (forced-change flow). */
	onSuccess?: () => void
	/** Override the form title. Defaults to "Cambiar contraseña". */
	title?: string
	/** Override the form description. */
	description?: string
	/** Override the submit button label. Defaults to "Cambiar contraseña". */
	submitLabel?: string
}

export function ChangePasswordForm({
	onSuccess,
	title = "Cambiar contraseña",
	description = "Para continuar, necesitás establecer una nueva contraseña. Esta es la primera vez que ingresás al sistema.",
	submitLabel = "Cambiar contraseña",
}: ChangePasswordFormProps = {}) {
	const router = useRouter()

	const form = useAppForm({
		defaultValues: {
			currentPassword: "",
			newPassword: "",
			confirmPassword: "",
		} as ChangePasswordFormData,
		validators: {
			onChange: changePasswordSchema,
		},
		onSubmit: async ({ value }) => {
			const result = await changeMyPasswordAction(value)

			if (!result.ok) {
				toast.error("Error al cambiar la contraseña", {
					description: result.error,
				})
				return
			}

			toast.success("Contraseña actualizada correctamente")

			if (onSuccess) {
				onSuccess()
			} else {
				router.push("/dashboard/inicio")
			}
		},
	})

	return (
		<form.AppForm>
			<form.Form className="flex w-full flex-col gap-5">
				<div className="mb-1 flex flex-col items-start gap-1">
					<h1 className="text-2xl font-bold">{title}</h1>
					<p className="text-muted-foreground text-sm text-balance">{description}</p>
				</div>

				<form.AppField name="currentPassword">
					{(field) => (
						<field.FieldSet className="w-full">
							<field.Field>
								<field.FieldLabel htmlFor="currentPassword">
									Contraseña actual
								</field.FieldLabel>
								<Input
									type="password"
									name="currentPassword"
									className="h-10"
									placeholder="Tu contraseña actual"
									onBlur={field.handleBlur}
									value={(field.state.value as string | undefined) ?? ""}
									onChange={(e) => field.handleChange(e.target.value)}
									aria-invalid={
										!!field.state.meta.errors.length && field.state.meta.isTouched
									}
								/>
							</field.Field>
							<field.FieldError />
						</field.FieldSet>
					)}
				</form.AppField>

				<form.AppField name="newPassword">
					{(field) => (
						<field.FieldSet className="w-full">
							<field.Field>
								<field.FieldLabel htmlFor="newPassword">Nueva contraseña</field.FieldLabel>
								<Input
									type="password"
									name="newPassword"
									className="h-10"
									placeholder="Mínimo 8 caracteres"
									onBlur={field.handleBlur}
									value={(field.state.value as string | undefined) ?? ""}
									onChange={(e) => field.handleChange(e.target.value)}
									aria-invalid={
										!!field.state.meta.errors.length && field.state.meta.isTouched
									}
								/>
							</field.Field>
							<field.FieldError />
						</field.FieldSet>
					)}
				</form.AppField>

				<form.AppField name="confirmPassword">
					{(field) => (
						<field.FieldSet className="w-full">
							<field.Field>
								<field.FieldLabel htmlFor="confirmPassword">
									Confirmá la nueva contraseña
								</field.FieldLabel>
								<Input
									type="password"
									name="confirmPassword"
									className="h-10"
									placeholder="Repetí la nueva contraseña"
									onBlur={field.handleBlur}
									value={(field.state.value as string | undefined) ?? ""}
									onChange={(e) => field.handleChange(e.target.value)}
									aria-invalid={
										!!field.state.meta.errors.length && field.state.meta.isTouched
									}
								/>
							</field.Field>
							<field.FieldError />
						</field.FieldSet>
					)}
				</form.AppField>

				<form.SubmitButton
					size="lg"
					label={submitLabel}
					className="h-10 w-full"
				/>
			</form.Form>
		</form.AppForm>
	)
}
