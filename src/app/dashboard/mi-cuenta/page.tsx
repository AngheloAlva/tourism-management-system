import { redirect } from "next/navigation"
import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { ProfileForm } from "@/project/auth/components/mi-cuenta/profile-form"
import { ChangePasswordSection } from "@/project/auth/components/mi-cuenta/change-password-section"
import { TwoFactorSection } from "@/project/auth/components/mi-cuenta/two-factor-section"

export default async function MiCuentaPage() {
	const session = await auth.api.getSession({ headers: await headers() })

	if (!session) {
		redirect("/")
	}

	const user = await prisma.user.findUniqueOrThrow({
		where: { id: session.user.id },
		select: {
			id: true,
			name: true,
			email: true,
			phone: true,
			rut: true,
			workSchedule: true,
			twoFactorEnabled: true,
		},
	})

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<header>
				<h1 className="text-2xl font-bold">Mi Cuenta</h1>
				<p className="text-muted-foreground">Gestioná tus datos, contraseña y seguridad.</p>
			</header>

			<Card>
				<CardHeader>
					<CardTitle>Datos personales</CardTitle>
				</CardHeader>
				<CardContent>
					<ProfileForm initial={user} />
				</CardContent>
			</Card>

			<ChangePasswordSection />

			<TwoFactorSection twoFactorEnabled={user.twoFactorEnabled} />
		</div>
	)
}
