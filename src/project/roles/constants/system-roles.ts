import { MODULE_DEFINITIONS } from "./modules"

export const SYSTEM_ROLE_KEY = {
	ADMIN: "admin",
	OPERADORA: "operadora",
	USER: "user",
} as const

export const SYSTEM_ROLE_DEFINITIONS = [
	{
		key: SYSTEM_ROLE_KEY.ADMIN,
		name: "Administrador",
		description: "Acceso total al sistema",
		isSystem: true,
	},
	{
		key: SYSTEM_ROLE_KEY.OPERADORA,
		name: "Operadora",
		description: "Operación comercial y gestión diaria",
		isSystem: true,
	},
	{
		key: SYSTEM_ROLE_KEY.USER,
		name: "Solo lectura",
		description: "Acceso de consulta sin interacción",
		isSystem: true,
	},
] as const

const OPERADORA_VISIBLE_MODULES = new Set([
	"/inicio",
	"/registro-de-ventas",
	"/navegacion-ventas",
	"/navegacion-cotizacion",
	"/traspasos",
	"/recepcion",
	"/navegacion-traspasos",
	"/navegacion-recepciones",
	"/balance-de-agencias",
	"/calendario",
	"/control-de-salidas",
	"/eventos-anulados",
	"/comisiones",
])

export function getDefaultPermissionForRole(roleKey: string, moduleKey: string) {
	if (roleKey === SYSTEM_ROLE_KEY.ADMIN) {
		return { visible: true, canInteract: true }
	}

	if (roleKey === SYSTEM_ROLE_KEY.OPERADORA) {
		const visible = OPERADORA_VISIBLE_MODULES.has(moduleKey)
		return { visible, canInteract: visible }
	}

	return {
		visible: true,
		canInteract: false,
	}
}

export const SYSTEM_MODULE_KEYS = MODULE_DEFINITIONS.map((module) => module.key)
