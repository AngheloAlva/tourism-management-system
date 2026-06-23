import {
	BanIcon,
	HomeIcon,
	UsersIcon,
	LogInIcon,
	LogOutIcon,
	WalletIcon,
	ReceiptIcon,
	UserKeyIcon,
	BookUserIcon,
	LandmarkIcon,
	BanknoteIcon,
	BuildingIcon,
	BarChart3Icon,
	Building2Icon,
	CalendarCogIcon,
	NotepadTextIcon,
	AlertCircleIcon,
	HandPlatterIcon,
	MountainSnowIcon,
	CalendarClockIcon,
	BadgeDollarSignIcon,
	TableOfContentsIcon,
	BanknoteArrowUpIcon,
	CircleArrowOutUpRightIcon,
	ShieldCheckIcon,
} from "lucide-react"

import type { LucideIcon } from "lucide-react"

export interface MenuItem {
	title: string
	url: string
	icon: LucideIcon
	moduleKey?: string
	/** If true, this item is only shown to users with role=admin */
	adminOnly?: boolean
	items?: Array<MenuItem>
}

export type ModulePermissionMap = Record<string, { visible: boolean; canInteract: boolean }>

export const data: {
	navMain: Array<MenuItem>
	navSecondary: Array<MenuItem>
} = {
	navMain: [
		{
			title: "Inicio",
			url: "/inicio",
			moduleKey: "/inicio",
			icon: HomeIcon,
		},
		{
			title: "Ventas y Cotizaciones",
			url: "/",
			icon: BookUserIcon,
			items: [
				{
					title: "Registro de Ventas",
					url: "/registro-de-ventas",
					moduleKey: "/registro-de-ventas",
					icon: BadgeDollarSignIcon,
				},
				{
					title: "Navegación Ventas",
					url: "/navegacion-ventas",
					moduleKey: "/navegacion-ventas",
					icon: BanknoteArrowUpIcon,
				},
				{
					title: "Navegación Cotizaciones",
					url: "/navegacion-cotizacion",
					moduleKey: "/navegacion-cotizacion",
					icon: NotepadTextIcon,
				},
			],
		},
		{
			title: "Traspasos/Recepción",
			url: "/",
			icon: CalendarCogIcon,
			items: [
				{
					title: "Traspasos",
					url: "/traspasos",
					moduleKey: "/traspasos",
					icon: LogOutIcon,
				},
				{
					title: "Recepción",
					url: "/recepcion",
					moduleKey: "/recepcion",
					icon: LogInIcon,
				},
				{
					title: "Navegacion Traspasos",
					url: "/navegacion-traspasos",
					moduleKey: "/navegacion-traspasos",
					icon: TableOfContentsIcon,
				},
				{
					title: "Navegacion Recepciones",
					url: "/navegacion-recepciones",
					moduleKey: "/navegacion-recepciones",
					icon: TableOfContentsIcon,
				},
				{
					title: "Balance de Agencias",
					url: "/balance-de-agencias",
					moduleKey: "/balance-de-agencias",
					icon: CalendarCogIcon,
				},
			],
		},
		{
			title: "Control Financiero",
			url: "/",
			icon: WalletIcon,
			items: [
				{
					title: "Flujo de Caja",
					url: "/flujo-de-caja",
					moduleKey: "/flujo-de-caja",
					icon: LandmarkIcon,
				},
				{
					title: "Facturación",
					url: "/facturacion",
					moduleKey: "/facturacion",
					icon: ReceiptIcon,
				},
				{
					title: "Comisiones",
					url: "/comisiones",
					moduleKey: "/comisiones",
					icon: BanknoteIcon,
				},
				{
					title: "Análisis",
					url: "/analisis",
					moduleKey: "/analisis",
					icon: BarChart3Icon,
				},
			],
		},
		{
			title: "Gestión Operacional",
			url: "/calendario",
			icon: CalendarCogIcon,
			items: [
				{
					title: "Calendario",
					url: "/calendario",
					moduleKey: "/calendario",
					icon: CalendarClockIcon,
				},
				{
					title: "Control de Salidas",
					url: "/control-de-salidas",
					moduleKey: "/control-de-salidas",
					icon: CircleArrowOutUpRightIcon,
				},
				{
					title: "Eventos Anulados",
					url: "/eventos-anulados",
					moduleKey: "/eventos-anulados",
					icon: BanIcon,
				},
			],
		},
		{
			title: "Panel de Alertas",
			url: "/alertas",
			moduleKey: "/alertas",
			icon: AlertCircleIcon,
		},
		{
			title: "Autorizaciones",
			url: "/autorizaciones",
			moduleKey: "/autorizaciones",
			icon: ShieldCheckIcon,
			adminOnly: true,
		},
		// {
		// 	title: "Siguiente Versión",
		// 	url: "#",
		// 	icon: ArrowBigRightDashIcon,
		// 	items: [
		// 		{
		// 			title: "Translados",
		// 			url: "/translados",
		// 			icon: CarFrontIcon,
		// 		},
		// 		{
		// 			title: "Planificación",
		// 			url: "/",
		// 			icon: CalendarIcon,
		// 		},
		// 		{
		// 			title: "Panel de Alerta",
		// 			url: "/",
		// 			icon: SirenIcon,
		// 		},
		// 	],
		// },
	],
	navSecondary: [
		{
			title: "Gestión de Mayoristas",
			url: "/gestion-de-mayoristas",
			moduleKey: "/gestion-de-mayoristas",
			icon: Building2Icon,
		},
		{
			title: "Gestión de Agencias",
			url: "/gestion-de-agencias",
			moduleKey: "/gestion-de-agencias",
			icon: BuildingIcon,
		},
		{
			title: "Gestión de Proveedores",
			url: "/control-de-proveedores",
			moduleKey: "/control-de-proveedores",
			icon: HandPlatterIcon,
		},
		{
			title: "Gestión de Tours",
			url: "/tours",
			moduleKey: "/tours",
			icon: MountainSnowIcon,
		},
		{
			title: "Usuarios",
			url: "/usuarios",
			moduleKey: "/usuarios",
			icon: UsersIcon,
		},
		{
			title: "Roles",
			url: "/roles",
			moduleKey: "/roles",
			icon: UserKeyIcon,
		},
	],
}

function canShowItem(
	item: MenuItem,
	permissions: ModulePermissionMap | undefined,
	isAdmin: boolean
) {
	// Explicit adminOnly flag — never show to non-admins regardless of permissions
	if (item.adminOnly && !isAdmin) return false
	if (isAdmin) return true
	if (!item.moduleKey) return true
	if (!permissions) return false
	return Boolean(permissions[item.moduleKey]?.visible)
}

export function filterSidebarByPermissions(
	sidebarData: { navMain: MenuItem[]; navSecondary: MenuItem[] },
	permissions: ModulePermissionMap | undefined,
	isAdmin: boolean
) {
	const filterItems = (items: MenuItem[]): MenuItem[] =>
		items
			.map((item) => {
				if (item.items?.length) {
					const filteredChildren = filterItems(item.items)
					if (filteredChildren.length === 0) return null
					return { ...item, items: filteredChildren }
				}

				if (!canShowItem(item, permissions, isAdmin)) return null
				return item
			})
			.filter((item): item is MenuItem => Boolean(item))

	return {
		navMain: filterItems(sidebarData.navMain),
		navSecondary: filterItems(sidebarData.navSecondary),
	}
}
