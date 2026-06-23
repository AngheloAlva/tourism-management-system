"use client"

import { toast } from "sonner"

import { useAppForm } from "@/shared/components/ui/tanstack-form"
import { Input } from "@/shared/components/ui/input"
import { updateProfileSchema } from "../../schemas/update-profile.schema"
import { updateMyProfileAction } from "../../actions/update-profile.actions"

import type { UpdateProfileFormData } from "../../schemas/update-profile.schema"

interface ProfileFormProps {
	initial: {
		name: string
		phone: string | null
		email: string
		rut: string | null
		workSchedule: string | null
	}
}

export function ProfileForm({ initial }: ProfileFormProps) {
	const form = useAppForm({
		defaultValues: {
			name: initial.name,
			phone: initial.phone ?? "",
		} as UpdateProfileFormData,
		validators: {
			onChange: updateProfileSchema,
		},
		onSubmit: async ({ value }) => {
			const result = await updateMyProfileAction(value)

			if (!result.ok) {
				toast.error("Error al guardar el perfil", {
					description: result.error,
				})
				return
			}

			toast.success("Perfil actualizado correctamente")
		},
	})

	return (
		<form.AppForm>
			<form.Form className="flex w-full flex-col gap-5">
				<form.AppField name="name">
					{(field) => (
						<field.FieldSet className="w-full">
							<field.Field>
								<field.FieldLabel htmlFor="name">Nombre</field.FieldLabel>
								<Input
									id="name"
									name="name"
									className="h-10"
									placeholder="Tu nombre completo"
									onBlur={field.handleBlur}
									value={(field.state.value as string | undefined) ?? ""}
									onChange={(e) => field.handleChange(e.target.value)}
									aria-invalid={!!field.state.meta.errors.length && field.state.meta.isTouched}
								/>
							</field.Field>
							<field.FieldError />
						</field.FieldSet>
					)}
				</form.AppField>

				<form.AppField name="phone">
					{(field) => (
						<field.FieldSet className="w-full">
							<field.Field>
								<field.FieldLabel htmlFor="phone">Teléfono</field.FieldLabel>
								<Input
									id="phone"
									name="phone"
									className="h-10"
									placeholder="+56 9 1234 5678"
									onBlur={field.handleBlur}
									value={(field.state.value as string | undefined) ?? ""}
									onChange={(e) => field.handleChange(e.target.value)}
									aria-invalid={!!field.state.meta.errors.length && field.state.meta.isTouched}
								/>
							</field.Field>
							<field.FieldError />
						</field.FieldSet>
					)}
				</form.AppField>

				{/* Read-only fields (managed by admins) */}
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="flex flex-col gap-1">
						<p className="text-sm font-medium">Email</p>
						<p className="text-muted-foreground text-sm">{initial.email}</p>
					</div>

					<div className="flex flex-col gap-1">
						<p className="text-sm font-medium">RUT</p>
						<p className="text-muted-foreground text-sm">{initial.rut ?? "—"}</p>
					</div>

					<div className="flex flex-col gap-1 sm:col-span-2">
						<p className="text-sm font-medium">Horario de trabajo</p>
						<p className="text-muted-foreground text-sm">{initial.workSchedule ?? "—"}</p>
					</div>
				</div>

				<p className="text-muted-foreground text-xs">
					El email, RUT y horario los gestiona un administrador.
				</p>

				<form.SubmitButton size="lg" label="Guardar cambios" className="h-10 w-full" />
			</form.Form>
		</form.AppForm>
	)
}
