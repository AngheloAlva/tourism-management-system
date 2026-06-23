import { notFound, redirect } from "next/navigation"

import { getSaleRecordById } from "@/project/sales/actions/sale-record.actions"
import { canCurrentUserInteractPaths } from "@/project/roles/actions/role.actions"

import { EditSaleWrapper } from "@/project/sales/components/edit-sale-wrapper"

interface PageProps {
	params: Promise<{ id: string }>
}

export default async function EditQuotePage({ params }: PageProps) {
	const canInteract = await canCurrentUserInteractPaths([
		"/dashboard/registro-de-ventas",
		"/dashboard/navegacion-ventas",
		"/dashboard/navegacion-cotizacion",
	])

	if (!canInteract) {
		redirect("/dashboard/navegacion-cotizacion")
	}

	const { id } = await params
	const sale = await getSaleRecordById(id)

	if (!sale) {
		notFound()
	}

	return (
		<div className="space-y-10">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Editar {sale.type === "SALE" ? "Venta" : "Cotización"} #{sale.voucher}
					</h1>
					<p className="text-muted-foreground mt-1">
						Modifica los datos del registro. Asegúrate de guardar los cambios al finalizar.
					</p>
				</div>
			</div>

			<EditSaleWrapper sale={sale} />
		</div>
	)
}
