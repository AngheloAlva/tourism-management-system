export interface ModuleDefinition {
	key: string
	label: string
	path: string
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
	{ key: "/inicio", label: "Inicio", path: "/inicio" },
	{ key: "/registro-de-ventas", label: "Registro de Ventas", path: "/registro-de-ventas" },
	{ key: "/navegacion-ventas", label: "Navegación Ventas", path: "/navegacion-ventas" },
	{
		key: "/navegacion-cotizacion",
		label: "Navegación Cotizaciones",
		path: "/navegacion-cotizacion",
	},
	{ key: "/traspasos", label: "Traspasos", path: "/traspasos" },
	{ key: "/recepcion", label: "Recepción", path: "/recepcion" },
	{ key: "/navegacion-traspasos", label: "Navegación Traspasos", path: "/navegacion-traspasos" },
	{
		key: "/navegacion-recepciones",
		label: "Navegación Recepciones",
		path: "/navegacion-recepciones",
	},
	{ key: "/balance-de-agencias", label: "Balance de Agencias", path: "/balance-de-agencias" },
	{ key: "/flujo-de-caja", label: "Flujo de Caja", path: "/flujo-de-caja" },
	{ key: "/comisiones", label: "Comisiones", path: "/comisiones" },
	{ key: "/facturacion", label: "Facturación", path: "/facturacion" },
	{ key: "/analisis", label: "Análisis", path: "/analisis" },
	{ key: "/calendario", label: "Calendario", path: "/calendario" },
	{ key: "/control-de-salidas", label: "Control de Salidas", path: "/control-de-salidas" },
	{ key: "/eventos-anulados", label: "Eventos Anulados", path: "/eventos-anulados" },
	{ key: "/alertas", label: "Panel de Alertas", path: "/alertas" },
	{ key: "/gestion-de-mayoristas", label: "Gestión de Mayoristas", path: "/gestion-de-mayoristas" },
	{ key: "/gestion-de-agencias", label: "Gestión de Agencias", path: "/gestion-de-agencias" },
	{
		key: "/control-de-proveedores",
		label: "Gestión de Proveedores",
		path: "/control-de-proveedores",
	},
	{ key: "/tours", label: "Gestión de Tours", path: "/tours" },
	{ key: "/usuarios", label: "Usuarios", path: "/usuarios" },
	{ key: "/roles", label: "Roles", path: "/roles" },
]

export function getModuleKeyFromPath(pathname: string): string | null {
	const normalized = pathname.replace(/^\/dashboard/, "") || "/inicio"

	const ordered = [...MODULE_DEFINITIONS].sort((a, b) => b.path.length - a.path.length)
	const match = ordered.find(
		(module) => normalized === module.path || normalized.startsWith(`${module.path}/`)
	)

	return match?.key || null
}
