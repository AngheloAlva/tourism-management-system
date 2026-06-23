"use client"

import { useCallback } from "react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { ChangePasswordForm } from "../change-password-form"

export function ChangePasswordSection() {
	const handleSuccess = useCallback(() => {
		toast.success("Contraseña actualizada correctamente", {
			description: "Tu contraseña fue cambiada. Seguís en la página.",
		})
	}, [])

	return (
		<Card>
			<CardHeader>
				<CardTitle>Seguridad</CardTitle>
			</CardHeader>
			<CardContent>
				<ChangePasswordForm
					onSuccess={handleSuccess}
					title="Cambiá tu contraseña"
					description="Podés cambiar tu contraseña en cualquier momento. Tu sesión actual se mantendrá activa."
					submitLabel="Actualizar contraseña"
				/>
			</CardContent>
		</Card>
	)
}
