import { Users, UserCheck, UserX, UserPlus } from "lucide-react"

import { DashboardStatCard } from "@/shared/components/ui/dashboard-stat-card"

interface UsersSummary {
	totalUsers: number
	activeUsers: number
	bannedUsers: number
	newUsersThisMonth: number
}

interface UsersInsightsProps {
	summary: UsersSummary
}

export function UsersInsights({ summary }: UsersInsightsProps) {
	const insights = [
		{
			title: "Total de Usuarios",
			value: summary.totalUsers,
			icon: Users,
			description: "Usuarios registrados",
			iconClassName: "text-blue-600 dark:text-blue-300",
			iconWrapperClassName: "bg-blue-500/30",
		},
		{
			title: "Usuarios Activos",
			value: summary.activeUsers,
			icon: UserCheck,
			description: "Últimos 30 días",
			iconClassName: "text-emerald-600 dark:text-emerald-300",
			iconWrapperClassName: "bg-emerald-500/30",
		},
		{
			title: "Usuarios Baneados",
			value: summary.bannedUsers,
			icon: UserX,
			description: "Cuentas suspendidas",
			iconClassName: "text-red-600 dark:text-red-300",
			iconWrapperClassName: "bg-red-500/30",
		},
		{
			title: "Nuevos Este Mes",
			value: summary.newUsersThisMonth,
			icon: UserPlus,
			description: "Registros del mes",
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
