"use client"

import { Shield, ShieldCheck, ShieldX, Sparkles } from "lucide-react"

import { DashboardStatCard } from "@/shared/components/ui/dashboard-stat-card"

type RolePermission = {
	canInteract: boolean
}

type RoleSummaryRow = {
	isActive: boolean
	isSystem: boolean
	permissions: RolePermission[]
}

interface RolesInsightsProps {
	roles: RoleSummaryRow[]
}

export function RolesInsights({ roles }: RolesInsightsProps) {
	const activeRoles = roles.filter((role) => role.isActive).length
	const systemRoles = roles.filter((role) => role.isSystem).length
	const interactiveRoles = roles.filter((role) =>
		role.permissions.some((permission) => permission.canInteract)
	).length

	const insights = [
		{
			title: "Total de Roles",
			value: roles.length,
			description: "Roles configurados",
			icon: Shield,
			iconClassName: "text-blue-600 dark:text-blue-300",
			iconWrapperClassName: "bg-blue-500/30",
		},
		{
			title: "Roles Activos",
			value: activeRoles,
			description: "Disponibles para asignar",
			icon: ShieldCheck,
			iconClassName: "text-emerald-600 dark:text-emerald-300",
			iconWrapperClassName: "bg-emerald-500/30",
		},
		{
			title: "Roles Sistema",
			value: systemRoles,
			description: "Definidos por plataforma",
			icon: ShieldX,
			iconClassName: "text-orange-600 dark:text-orange-300",
			iconWrapperClassName: "bg-primary/30",
		},
		{
			title: "Con Interaccion",
			value: interactiveRoles,
			description: "Permiten operar modulos",
			icon: Sparkles,
			iconClassName: "text-violet-600 dark:text-violet-300",
			iconWrapperClassName: "bg-violet-500/30",
		},
	]

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			{insights.map((insight) => (
				<DashboardStatCard
					key={insight.title}
					title={insight.title}
					value={insight.value}
					description={insight.description}
					icon={insight.icon}
					iconClassName={insight.iconClassName}
					iconWrapperClassName={insight.iconWrapperClassName}
				/>
			))}
		</div>
	)
}
