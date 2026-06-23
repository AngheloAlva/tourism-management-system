"use client"

import { useAppForm } from "@/shared/components/ui/tanstack-form"
import { revalidateLogic } from "@tanstack/react-form"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { loginSchema } from "../schemas/login-schema"
import { authClient } from "@/lib/auth-client"

import { Input } from "@/shared/components/ui/input"

import type { LoginSchema } from "../schemas/login-schema"

export function LoginForm() {
	const router = useRouter()

	const loginForm = useAppForm({
		defaultValues: {
			email: "",
			password: "",
		} as LoginSchema,
		validationLogic: revalidateLogic(),
		validators: {
			onDynamic: loginSchema,
			onDynamicAsyncDebounceMs: 300,
		},
		onSubmit: async ({ value }) => {
			await authClient.signIn.email(
				{
					email: value.email,
					password: value.password,
				},
				{
					onSuccess: (ctx) => {
						if (ctx.data?.twoFactorRedirect) {
							router.push("/verificar-2fa")
							return
						}
						router.push("/dashboard/inicio")
					},
					onError: (ctx) => {
						if (ctx.error.code === "INVALID_EMAIL_OR_PASSWORD") {
							toast.error("Error al iniciar sesión", {
								description: "Email o contraseña incorrectos",
							})
							return
						}

						toast.error("Error al iniciar sesión", {
							description: ctx.error.message,
						})
					},
				}
			)
		},
		onSubmitInvalid({ formApi }) {
			const errorMap = formApi.state.errorMap["onDynamic"]!
			const inputs = Array.from(document.querySelectorAll("#loginForm input")) as HTMLInputElement[]
			let firstInput: HTMLInputElement | undefined
			for (const input of inputs) {
				if (errorMap[input.name]) {
					firstInput = input
					break
				}
			}
			firstInput?.focus()
		},
	})

	return (
		<loginForm.AppForm>
			<loginForm.Form className="flex w-full flex-col gap-5">
				<div className="mb-1 flex flex-col items-start gap-1">
					<h1 className="text-2xl font-bold">Iniciar sesión</h1>
					<p className="text-muted-foreground text-sm text-balance">
						Ingrese su correo electrónico y contraseña a continuación para iniciar sesión
					</p>
				</div>

				<loginForm.AppField name={"email"}>
					{(field) => (
						<field.FieldSet className="w-full">
							<field.Field>
								<field.FieldLabel htmlFor={"email"}>Email</field.FieldLabel>
								<Input
									type="email"
									name={"email"}
									className="h-10"
									onBlur={field.handleBlur}
									placeholder="nombre@turismochiletours.com"
									value={(field.state.value as string | undefined) ?? ""}
									onChange={(e) => field.handleChange(e.target.value)}
									aria-invalid={!!field.state.meta.errors.length && field.state.meta.isTouched}
								/>
							</field.Field>

							<field.FieldError />
						</field.FieldSet>
					)}
				</loginForm.AppField>

				<loginForm.AppField name={"password"}>
					{(field) => (
						<field.FieldSet className="w-full">
							<field.Field>
								<field.FieldLabel htmlFor={"password"}>Contraseña</field.FieldLabel>
								<Input
									type="password"
									className="h-10"
									name={"password"}
									placeholder="********"
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									value={(field.state.value as string | undefined) ?? ""}
									aria-invalid={!!field.state.meta.errors.length && field.state.meta.isTouched}
								/>
							</field.Field>

							<field.FieldError />
						</field.FieldSet>
					)}
				</loginForm.AppField>

				<loginForm.SubmitButton size={"lg"} label="Iniciar sesión" className="h-10 w-full" />
			</loginForm.Form>
		</loginForm.AppForm>
	)
}
