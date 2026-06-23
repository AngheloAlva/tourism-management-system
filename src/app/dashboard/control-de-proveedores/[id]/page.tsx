import { FormularioProveedores } from "@/project/providers/components/formulario-proveedores"
import { ProvidersPageHeader } from "@/project/providers/components/providers-page-header"

interface EditarProveedorPageProps {
	params: Promise<{
		id: string
	}>
}

export default async function EditarProveedorPage({ params }: EditarProveedorPageProps) {
	const { id } = await params

	return (
		<div className="space-y-6">
			<ProvidersPageHeader
				title="Editar Proveedor"
				description="Actualiza la información y costos del proveedor"
				backHref="/dashboard/control-de-proveedores"
			/>

			<FormularioProveedores providerId={id} />
		</div>
	)
}
