import Link from "next/link"
import { Compass, Home } from "lucide-react"

import { Button } from "@/shared/components/ui/button"
import Logo from "@/shared/components/sidebar/logo"

export default function NotFound() {
	return (
		<div className="flex min-h-svh flex-col items-center justify-center gap-8 p-6 md:p-10">
			<div className="flex items-center gap-2 font-medium">
				<Logo className="h-14 w-auto" />
				<div className="flex flex-col leading-5">
					<span>TurismoChileTours</span>
					<span className="text-muted-foreground text-sm">Sistema de Gestión</span>
				</div>
			</div>

			<div className="flex flex-col items-center gap-4 text-center">
				<Compass className="text-muted-foreground h-12 w-12" />
				<div className="space-y-1">
					<h1 className="text-2xl font-semibold">Página no encontrada</h1>
					<p className="text-muted-foreground max-w-md text-sm">
						La ruta que intentaste abrir no existe o fue movida. Volvé al inicio y
						buscala desde el menú principal.
					</p>
				</div>
			</div>

			<Button asChild>
				<Link href="/dashboard/inicio">
					<Home className="h-4 w-4" />
					Ir al inicio
				</Link>
			</Button>
		</div>
	)
}
