import { FormularioProveedores } from "@/project/providers/components/formulario-proveedores"
import { ProvidersPageHeader } from "@/project/providers/components/providers-page-header"

export default function NuevoProveedorPage() {
	return (
		<div className="space-y-6">
			<ProvidersPageHeader
				title="Nuevo Proveedor"
				description="Registra un nuevo proveedor en el sistema"
				backHref="/dashboard/control-de-proveedores"
			/>

			<FormularioProveedores />
		</div>
	)
}
