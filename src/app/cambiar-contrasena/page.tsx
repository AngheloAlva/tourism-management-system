import { redirect } from "next/navigation"
import { headers } from "next/headers"
import Image from "next/image"

import { auth } from "@/lib/auth"
import { ChangePasswordForm } from "@/project/auth/components/change-password-form"
import Logo from "@/shared/components/sidebar/logo"

import loginImage from "../../../public/images/login.jpg"

export default async function CambiarContrasenaPage() {
	const session = await auth.api.getSession({ headers: await headers() })

	if (!session?.user) {
		return redirect("/")
	}

	if (!session.user.mustChangePassword) {
		return redirect("/dashboard/inicio")
	}

	return (
		<div className="grid min-h-svh lg:grid-cols-2">
			<div className="flex flex-col gap-4 p-6 md:p-10">
				<div className="flex justify-center gap-2 md:justify-start">
					<div className="group hover:text-primary flex items-center gap-2 font-medium transition-colors">
						<Logo className="h-14 w-auto" />

						<div className="flex flex-col leading-5">
							<span>TurismoChileTours</span>
							<span className="text-muted-foreground text-sm transition-colors">
								Sistema de Gestión
							</span>
						</div>
					</div>
				</div>

				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-xs">
						<ChangePasswordForm />
					</div>
				</div>
			</div>

			<div className="bg-muted relative hidden lg:block">
				<Image
					alt="Image"
					width={1920}
					height={1080}
					src={loginImage}
					placeholder="blur"
					className="absolute inset-0 h-full w-full object-cover object-right dark:brightness-[0.2] dark:grayscale"
				/>
			</div>
		</div>
	)
}
