"use client"

import { UserPlus } from "lucide-react"
import { useMemo, useState } from "react"

import { userSchema, type UserFormData } from "../schemas/user.schema"
import { setUserRole, updateUserAdditionalData } from "../actions/user.actions"
import { markUserMustChangePasswordAction } from "@/project/auth/actions/change-password.actions"
import { USER_ROLE } from "../constants/roles"
import { useAppForm } from "@/shared/components/ui/tanstack-form"
import { authClient } from "@/lib/auth-client"
import { useQueryClient } from "@tanstack/react-query"
import { useAssignableRoles } from "@/project/roles/hooks/use-roles"
import type { AssignableRole } from "@/project/roles/hooks/use-roles"

import { Field, FieldLabel, FieldError } from "@/shared/components/ui/field"
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
	Dialog,
	DialogTitle,
	DialogHeader,
	DialogFooter,
	DialogTrigger,
	DialogContent,
	DialogDescription,
} from "@/shared/components/ui/dialog"
import { toast } from "sonner"

const EMPTY_ASSIGNABLE_ROLES: AssignableRole[] = []

export function CreateUserDialog() {
	const [open, setOpen] = useState(false)
	const queryClient = useQueryClient()
	const { data: assignableRolesData } = useAssignableRoles()
	const assignableRoles = assignableRolesData ?? EMPTY_ASSIGNABLE_ROLES
	const defaultRole = useMemo(() => {
		if (assignableRoles.some((role: any) => role.key === USER_ROLE.OPERADORA)) {
			return USER_ROLE.OPERADORA
		}

		if (assignableRoles.some((role: any) => role.key === USER_ROLE.USER)) {
			return USER_ROLE.USER
		}

		return assignableRoles[0]?.key || USER_ROLE.USER
	}, [assignableRoles])

	const form = useAppForm({
		defaultValues: {
			name: "",
			email: "",
			password: "",
			role: defaultRole,
			rut: "",
			phone: "",
			birthDate: "",
			workSchedule: "",
			image: "",
		} as UserFormData,
		validators: {
			onChange: userSchema,
		},
		onSubmit: async ({ value }) => {
			try {
				const user = await authClient.admin.createUser({
					name: value.name,
					email: value.email,
					password: value.password,
				})

				if (!user.data) {
					throw new Error("No se pudo crear el usuario")
				}

				await setUserRole({
					role: value.role,
					userId: user.data.user.id,
				})

				await updateUserAdditionalData({
					userId: user.data.user.id,
					rut: value.rut,
					phone: value.phone,
					birthDate: value.birthDate,
					workSchedule: value.workSchedule,
				})

				await markUserMustChangePasswordAction(user.data.user.id)

				await queryClient.invalidateQueries({ queryKey: ["users"] })
				toast.success("Usuario creado exitosamente")
				form.reset()
				setOpen(false)
			} catch (error) {
				toast.error("Error al crear el usuario", {
					description: error instanceof Error ? error.message : "Error al crear el usuario",
				})
			}
		},
	})

	const handleCancel = () => {
		form.reset()
		setOpen(false)
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button className="bg-primary text-white hover:bg-orange-600">
					<UserPlus className="h-4 w-4" />
					Crear Usuario
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Crear Nuevo Usuario</DialogTitle>
					<DialogDescription>Completa los datos del nuevo usuario del sistema.</DialogDescription>
				</DialogHeader>

				<form
					onSubmit={(e) => {
						e.preventDefault()
						e.stopPropagation()
						form.handleSubmit()
					}}
					className="space-y-4"
				>
					{/* Nombre */}
					<form.Field name="name">
						{(field) => (
							<Field data-invalid={field.state.meta.errors.length > 0}>
								<FieldLabel>
									Nombre Completo <span className="text-destructive">*</span>
								</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Ej: Juan Pérez"
									className={field.state.meta.errors.length > 0 ? "border-destructive" : ""}
								/>
								{field.state.meta.errors.length > 0 && (
									<FieldError errors={field.state.meta.errors} />
								)}
							</Field>
						)}
					</form.Field>

					<form.Field name="rut">
						{(field) => (
							<Field data-invalid={field.state.meta.errors.length > 0}>
								<FieldLabel>
									RUT <span className="text-destructive">*</span>
								</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Ej: 12.345.678-9"
									className={field.state.meta.errors.length > 0 ? "border-destructive" : ""}
								/>
								{field.state.meta.errors.length > 0 && (
									<FieldError errors={field.state.meta.errors} />
								)}
							</Field>
						)}
					</form.Field>

					<form.Field name="phone">
						{(field) => (
							<Field data-invalid={field.state.meta.errors.length > 0}>
								<FieldLabel>
									Teléfono <span className="text-destructive">*</span>
								</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Ej: +56 9 1234 5678"
									className={field.state.meta.errors.length > 0 ? "border-destructive" : ""}
								/>
								{field.state.meta.errors.length > 0 && (
									<FieldError errors={field.state.meta.errors} />
								)}
							</Field>
						)}
					</form.Field>

					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<form.Field name="birthDate">
							{(field) => (
								<Field data-invalid={field.state.meta.errors.length > 0}>
									<FieldLabel>
										Fecha de Nacimiento <span className="text-destructive">*</span>
									</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										type="date"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										className={field.state.meta.errors.length > 0 ? "border-destructive" : ""}
									/>
									{field.state.meta.errors.length > 0 && (
										<FieldError errors={field.state.meta.errors} />
									)}
								</Field>
							)}
						</form.Field>

						<form.Field name="workSchedule">
							{(field) => (
								<Field data-invalid={field.state.meta.errors.length > 0}>
									<FieldLabel>
										Horario de Trabajo <span className="text-destructive">*</span>
									</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="Ej: Lunes a Viernes 09:00 - 18:00"
										className={field.state.meta.errors.length > 0 ? "border-destructive" : ""}
									/>
									{field.state.meta.errors.length > 0 && (
										<FieldError errors={field.state.meta.errors} />
									)}
								</Field>
							)}
						</form.Field>
					</div>

					{/* Email */}
					<form.Field name="email">
						{(field) => (
							<Field data-invalid={field.state.meta.errors.length > 0}>
								<FieldLabel>
									Email <span className="text-destructive">*</span>
								</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									type="email"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="usuario@ejemplo.com"
									className={field.state.meta.errors.length > 0 ? "border-destructive" : ""}
								/>
								{field.state.meta.errors.length > 0 && (
									<FieldError errors={field.state.meta.errors} />
								)}
							</Field>
						)}
					</form.Field>

					{/* Contraseña */}
					<form.Field name="password">
						{(field) => (
							<Field data-invalid={field.state.meta.errors.length > 0}>
								<FieldLabel>
									Contraseña Inicial <span className="text-destructive">*</span>
								</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Mínimo 8 caracteres"
									className={field.state.meta.errors.length > 0 ? "border-destructive" : ""}
								/>
								<p className="text-muted-foreground text-xs">
									Comparta esta contraseña con el usuario para su primer acceso.
								</p>
								{field.state.meta.errors.length > 0 && (
									<FieldError errors={field.state.meta.errors} />
								)}
							</Field>
						)}
					</form.Field>

					<form.Field name="role">
						{(field) => (
							<Field data-invalid={field.state.meta.errors.length > 0}>
								<FieldLabel>
									Rol <span className="text-destructive">*</span>
								</FieldLabel>
								<Select
									value={field.state.value}
									onValueChange={(value) => field.handleChange(value as UserFormData["role"])}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Selecciona un rol" />
									</SelectTrigger>
									<SelectContent>
										{assignableRoles.map((role: any) => (
											<SelectItem key={role.key} value={role.key}>
												{role.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{field.state.meta.errors.length > 0 && (
									<FieldError errors={field.state.meta.errors} />
								)}
							</Field>
						)}
					</form.Field>

					<DialogFooter className="gap-2">
						<Button type="button" variant="outline" onClick={handleCancel}>
							Cancelar
						</Button>
						<Button type="submit">Crear Usuario</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
