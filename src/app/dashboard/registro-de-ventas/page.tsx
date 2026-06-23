import Link from "next/link"

import SalesQuoteForm from "@/project/sales/components/sale-quote-form/sales-quote-form"
import { TutorialVideosDialog } from "@/shared/components/tutorials/tutorial-videos-dialog"

export default function SalesRegisterPage() {
	return (
		<div className="space-y-10">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Registro de Ventas</h1>
					<p className="text-muted-foreground mt-1">
						Crea nuevas ventas y cotizaciones de tours. Estos podrán ser visualizados en{" "}
						<Link
							href="/dashboard/navegacion-ventas"
							className="hover:text-primary font-semibold underline"
						>
							Navegación de Ventas
						</Link>
						{" y "}
						<Link
							href="/dashboard/navegacion-cotizacion"
							className="hover:text-primary font-semibold underline"
						>
							Navegación de Cotizaciones
						</Link>
						.
					</p>
				</div>

				<TutorialVideosDialog
					buttonLabel="Tutorial Registro"
					title="Tutoriales de Registro de Ventas"
					description="Revisa cada paso del flujo: venta/cotización, eventos, pasajeros y pagos."
					videos={[
						{
							title: "Registrar la venta/Cotización",
							url: "https://youtu.be/kDGZ_IbgqdY",
						},
						{
							title: "Detalle de Evento/Tour",
							url: "https://youtu.be/1FR8bOHx4jE",
						},
						{
							title: "Detalle de Pasajeros",
							url: "https://youtu.be/0N7n6XWuquk",
						},
						{
							title: "Registro de Pagos",
							url: "https://youtu.be/BUZ4q2a0FcM",
						},
					]}
				/>
			</div>

			<SalesQuoteForm />
		</div>
	)
}
