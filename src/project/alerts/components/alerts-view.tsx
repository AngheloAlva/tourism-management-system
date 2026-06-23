"use client"

import Link from "next/link"
import { Fraunces, IBM_Plex_Sans } from "next/font/google"
import {
	AlertTriangle,
	BellIcon,
	CalendarIcon,
	Car,
	CheckCircle2,
	Clock,
	FileText,
	Landmark,
	MapPin,
	RefreshCw,
	UserX,
	Users,
	Utensils,
	Wallet,
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useState } from "react"

import { useAlertsDashboard } from "@/project/alerts/hooks/use-alerts"
import {
	ALERT_ICON,
	ALERT_LEVEL,
	ALERT_SCOPE,
	type AlertIcon,
	type AlertLevel,
	type AlertScope,
	type DashboardAlert,
} from "@/project/alerts/types/alert.types"
import { Badge } from "@/shared/components/ui/badge"
import { Button } from "@/shared/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card"
import { Input } from "@/shared/components/ui/input"
import { Progress } from "@/shared/components/ui/progress"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select"
import { Separator } from "@/shared/components/ui/separator"
import { Skeleton } from "@/shared/components/ui/skeleton"
import { cn } from "@/lib/utils"

const displayFont = Fraunces({
	subsets: ["latin"],
	variable: "--font-alerts-display",
})

const bodyFont = IBM_Plex_Sans({
	subsets: ["latin"],
	weight: ["300", "400", "500", "600", "700"],
	variable: "--font-alerts-body",
})

const SCOPE_FILTER = {
	ALL: "ALL",
	...ALERT_SCOPE,
} as const

type ScopeFilterValue = (typeof SCOPE_FILTER)[keyof typeof SCOPE_FILTER]

const LEVEL_FILTER = {
	ALL: "ALL",
	...ALERT_LEVEL,
} as const

type LevelFilterValue = (typeof LEVEL_FILTER)[keyof typeof LEVEL_FILTER]

const levelStyles: Record<
	AlertLevel,
	{ label: string; chip: string; border: string; glow: string; icon: string }
> = {
	[ALERT_LEVEL.CRITICAL]: {
		label: "Critica",
		chip: "bg-[#e5484d] text-white border-transparent",
		border: "border-l-[#e5484d] bg-[#fff5f5] dark:bg-[#2a1414]/60",
		glow: "shadow-[0_0_0_1px_rgba(229,72,77,0.2),0_18px_45px_rgba(229,72,77,0.15)]",
		icon: "text-[#e5484d]",
	},
	[ALERT_LEVEL.WARNING]: {
		label: "Advertencia",
		chip: "bg-[#f2a20c] text-white border-transparent",
		border: "border-l-[#f2a20c] bg-[#fff7e8] dark:bg-[#2b2212]/70",
		glow: "shadow-[0_0_0_1px_rgba(242,162,12,0.2),0_18px_45px_rgba(242,162,12,0.12)]",
		icon: "text-[#b97b05]",
	},
	[ALERT_LEVEL.INFO]: {
		label: "Informativa",
		chip: "bg-[#2a7b7c] text-white border-transparent",
		border: "border-l-[#2a7b7c] bg-[#eef7f7] dark:bg-[#122021]/70",
		glow: "shadow-[0_0_0_1px_rgba(42,123,124,0.2),0_18px_45px_rgba(42,123,124,0.12)]",
		icon: "text-[#2a7b7c]",
	},
}

const scopeLabels: Record<AlertScope, string> = {
	[ALERT_SCOPE.OPERATIONS]: "Operaciones",
	[ALERT_SCOPE.SALES]: "Ventas",
	[ALERT_SCOPE.FINANCE]: "Finanzas",
	[ALERT_SCOPE.PROVIDERS]: "Proveedores",
	[ALERT_SCOPE.DATA]: "Calidad de datos",
}

const iconMap: Record<AlertIcon, typeof AlertTriangle> = {
	[ALERT_ICON.USER_X]: UserX,
	[ALERT_ICON.USERS]: Users,
	[ALERT_ICON.CAR]: Car,
	[ALERT_ICON.UTENSILS]: Utensils,
	[ALERT_ICON.ALERT_TRIANGLE]: AlertTriangle,
	[ALERT_ICON.WALLET]: Wallet,
	[ALERT_ICON.FILE_TEXT]: FileText,
	[ALERT_ICON.LANDMARK]: Landmark,
	[ALERT_ICON.CALENDAR]: CalendarIcon,
	[ALERT_ICON.MAP_PIN]: MapPin,
	[ALERT_ICON.CHECK_CIRCLE]: CheckCircle2,
}

function formatAlertDate(value: string) {
	return format(new Date(value), "dd MMM yyyy HH:mm", { locale: es })
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
	return (
		<Card className="border-black/10 bg-white/80 dark:border-white/10 dark:bg-white/5">
			<CardContent className="py-10 text-center">
				<p className="text-lg font-semibold text-[#1b1b1b] dark:text-white">
					{hasFilters ? "No hay alertas para los filtros aplicados" : "No hay alertas activas"}
				</p>
				<p className="text-muted-foreground mt-2 text-sm">
					El motor de reglas no encontro incidencias en este momento.
				</p>
			</CardContent>
		</Card>
	)
}

function LoadingState() {
	return (
		<div className="space-y-4">
			<Skeleton className="h-24 w-full rounded-2xl" />
			<Skeleton className="h-32 w-full rounded-2xl" />
			<Skeleton className="h-32 w-full rounded-2xl" />
		</div>
	)
}

function buildScopeFilters(alerts: DashboardAlert[]) {
	const withData = Object.values(ALERT_SCOPE).filter((scope) =>
		alerts.some((alert) => alert.scope === scope)
	)

	return [SCOPE_FILTER.ALL, ...withData]
}

export function AlertsView() {
	const [scopeFilter, setScopeFilter] = useState<ScopeFilterValue>(SCOPE_FILTER.ALL)
	const [levelFilter, setLevelFilter] = useState<LevelFilterValue>(LEVEL_FILTER.ALL)
	const [search, setSearch] = useState("")

	const { data, isLoading, isError, isFetching, refetch } = useAlertsDashboard()

	const allAlerts = data?.alerts || []
	const normalizedSearch = search.trim().toLowerCase()
	const filteredAlerts = allAlerts.filter((alert) => {
		const matchesScope = scopeFilter === SCOPE_FILTER.ALL || alert.scope === scopeFilter
		const matchesLevel = levelFilter === LEVEL_FILTER.ALL || alert.level === levelFilter
		const matchesSearch =
			normalizedSearch.length === 0 ||
			alert.title.toLowerCase().includes(normalizedSearch) ||
			alert.description.toLowerCase().includes(normalizedSearch) ||
			alert.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch))

		return matchesScope && matchesLevel && matchesSearch
	})

	const scopeFilters = buildScopeFilters(allAlerts)
	const hasActiveFilters =
		scopeFilter !== SCOPE_FILTER.ALL ||
		levelFilter !== LEVEL_FILTER.ALL ||
		normalizedSearch.length > 0

	const criticalTotal = data?.summaryByLevel[ALERT_LEVEL.CRITICAL] || 0
	const warningTotal = data?.summaryByLevel[ALERT_LEVEL.WARNING] || 0
	const infoTotal = data?.summaryByLevel[ALERT_LEVEL.INFO] || 0
	const total = data?.total || 0

	const criticalProgress = total > 0 ? Math.round((criticalTotal / total) * 100) : 0
	const warningProgress = total > 0 ? Math.round((warningTotal / total) * 100) : 0

	const agendaItems = filteredAlerts.filter((alert) => alert.level !== ALERT_LEVEL.INFO).slice(0, 4)

	const ruleHighlights = (data?.ruleHighlights || []).slice(0, 3)

	return (
		<div
			className={cn(
				displayFont.variable,
				bodyFont.variable,
				"space-y-6 font-[var(--font-alerts-body)]"
			)}
		>
			<section className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.08)] backdrop-blur dark:border-white/10 dark:bg-white/5">
				<div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
					<div className="space-y-3">
						<div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-[#0f766e] uppercase dark:border-white/10 dark:bg-white/10 dark:text-[#7bdad1]">
							<BellIcon className="h-3.5 w-3.5" />
							Motor de reglas activo
						</div>
						<h1 className="text-3xl font-semibold tracking-tight text-[#1c1c1c] lg:text-4xl dark:text-white">
							<span className="font-[var(--font-alerts-display)]">Panel de Alertas</span>
						</h1>
						<p className="text-muted-foreground max-w-2xl text-sm">
							Alertas generadas desde ventas, eventos, caja, proveedores y traspasos en tiempo real.
						</p>
						<div className="flex flex-wrap gap-2">
							<Badge className="bg-[#0f766e]/10 text-[#0f766e]">{total} abiertas</Badge>
							<Badge className="bg-[#e5484d]/10 text-[#b23a3f]">{criticalTotal} criticas</Badge>
							<Badge className="bg-[#f2a20c]/10 text-[#a06a00]">{warningTotal} advertencias</Badge>
							<Badge className="bg-[#2a7b7c]/10 text-[#2a7b7c]">{infoTotal} informativas</Badge>
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-3">
						<Button
							variant="outline"
							onClick={() => refetch()}
							className="border-black/20 bg-white/60"
							disabled={isFetching}
						>
							<RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
							Actualizar
						</Button>
						<Button className="bg-[#0f766e] text-white hover:bg-[#0b5c56]" disabled>
							Crear regla (proximamente)
						</Button>
					</div>
				</div>

				<div className="mt-6 grid gap-3 lg:grid-cols-4">
					<Card className="border-black/5 p-1 shadow-none">
						<CardContent className="flex items-center justify-between rounded-xl bg-white/90 px-4 py-4 dark:bg-[#0f1418]">
							<div>
								<p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
									Alertas abiertas
								</p>
								<p className="mt-2 text-2xl font-semibold text-[#1b1b1b] dark:text-white">
									{total}
								</p>
							</div>
						</CardContent>
					</Card>
					<Card className="border-black/5 p-1 shadow-none">
						<CardContent className="flex items-center justify-between rounded-xl bg-white/90 px-4 py-4 dark:bg-[#0f1418]">
							<div>
								<p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">Criticas</p>
								<p className="mt-2 text-2xl font-semibold text-[#1b1b1b] dark:text-white">
									{criticalTotal}
								</p>
							</div>
						</CardContent>
					</Card>
					<Card className="border-black/5 p-1 shadow-none">
						<CardContent className="flex items-center justify-between rounded-xl bg-white/90 px-4 py-4 dark:bg-[#0f1418]">
							<div>
								<p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
									Advertencias
								</p>
								<p className="mt-2 text-2xl font-semibold text-[#1b1b1b] dark:text-white">
									{warningTotal}
								</p>
							</div>
						</CardContent>
					</Card>
					<Card className="border-black/5 p-1 shadow-none">
						<CardContent className="flex items-center justify-between rounded-xl bg-white/90 px-4 py-4 dark:bg-[#0f1418]">
							<div>
								<p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
									Informativas
								</p>
								<p className="mt-2 text-2xl font-semibold text-[#1b1b1b] dark:text-white">
									{infoTotal}
								</p>
							</div>
						</CardContent>
					</Card>
				</div>
			</section>

			<section className="grid gap-6 lg:grid-cols-12">
				<div className="space-y-4 lg:col-span-8">
					<Card className="border-black/10 bg-white/80 shadow-[0_18px_50px_rgba(15,118,110,0.08)] dark:border-white/10 dark:bg-white/5">
						<CardHeader className="space-y-4">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div>
									<CardTitle className="text-lg">Filtros</CardTitle>
									<CardDescription>Segmenta por modulo, severidad o texto.</CardDescription>
								</div>
								<div className="text-muted-foreground flex items-center gap-2 text-xs">
									<Clock className="h-4 w-4" />
									{data?.generatedAt
										? `Ultima actualizacion ${formatAlertDate(data.generatedAt)}`
										: "Sin datos"}
								</div>
							</div>
							<div className="grid gap-2 lg:grid-cols-3">
								<div className="lg:col-span-2">
									<Input
										placeholder="Buscar por titulo, descripcion o tag"
										value={search}
										onChange={(event) => setSearch(event.target.value)}
									/>
								</div>
								<div>
									<Select
										value={levelFilter}
										onValueChange={(value) => setLevelFilter(value as LevelFilterValue)}
									>
										<SelectTrigger className="w-full bg-white/70">
											<SelectValue placeholder="Severidad" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={LEVEL_FILTER.ALL}>Todas</SelectItem>
											<SelectItem value={ALERT_LEVEL.CRITICAL}>Critica</SelectItem>
											<SelectItem value={ALERT_LEVEL.WARNING}>Advertencia</SelectItem>
											<SelectItem value={ALERT_LEVEL.INFO}>Informativa</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
							<div className="flex flex-wrap gap-2">
								{scopeFilters.map((filter) => {
									const isAll = filter === SCOPE_FILTER.ALL
									return (
										<Button
											key={filter}
											variant={scopeFilter === filter ? "default" : "outline"}
											onClick={() => setScopeFilter(filter)}
											className={cn(
												"h-8 rounded-full px-4 text-xs",
												scopeFilter === filter
													? "bg-[#1c1c1c] text-white hover:bg-[#111]"
													: "border-black/15 bg-white/70 text-[#2d2d2d] hover:bg-white"
											)}
										>
											{isAll ? "Todo" : scopeLabels[filter as AlertScope]}
										</Button>
									)
								})}
							</div>
						</CardHeader>
					</Card>

					{isError ? (
						<Card className="border-black/10 bg-white/80 dark:border-white/10 dark:bg-white/5">
							<CardContent className="py-8 text-center">
								<p className="text-base font-semibold text-[#1b1b1b] dark:text-white">
									No pudimos cargar el panel de alertas
								</p>
								<p className="text-muted-foreground mt-1 text-sm">Intenta actualizar nuevamente.</p>
								<Button className="mt-4" onClick={() => refetch()}>
									Reintentar
								</Button>
							</CardContent>
						</Card>
					) : null}

					{isLoading ? <LoadingState /> : null}

					{!isLoading && !isError && filteredAlerts.length === 0 ? (
						<EmptyState hasFilters={hasActiveFilters} />
					) : null}

					{!isLoading && !isError && filteredAlerts.length > 0 ? (
						<div className="space-y-3">
							{filteredAlerts.map((alert) => {
								const Icon = iconMap[alert.icon] || AlertTriangle
								const styles = levelStyles[alert.level]

								return (
									<div
										key={alert.id}
										className={cn(
											"rounded-2xl border border-l-4 border-black/10 p-4 backdrop-blur transition",
											styles.border,
											styles.glow
										)}
									>
										<div className="flex flex-wrap items-start justify-between gap-4">
											<div className="flex items-start gap-3">
												<div
													className={cn(
														"flex h-10 w-10 items-center justify-center rounded-full bg-white/90",
														styles.icon
													)}
												>
													<Icon className="h-5 w-5" />
												</div>
												<div className="space-y-2">
													<div className="flex flex-wrap items-center gap-2">
														<Badge className={styles.chip}>{styles.label}</Badge>
														<Badge variant="outline" className="border-black/15">
															{scopeLabels[alert.scope]}
														</Badge>
														<span className="text-muted-foreground text-xs">{alert.id}</span>
													</div>
													<div>
														<p className="text-base font-semibold text-[#1b1b1b] dark:text-white">
															{alert.title}
														</p>
														<p className="text-muted-foreground text-sm">{alert.description}</p>
													</div>
													<div className="flex flex-wrap gap-2">
														{alert.tags.map((tag) => (
															<Badge
																key={tag}
																variant="secondary"
																className="bg-white/80 text-[11px] text-[#2f2f2f]"
															>
																{tag}
															</Badge>
														))}
													</div>
												</div>
											</div>
											<div className="text-muted-foreground flex flex-col items-end gap-2 text-xs">
												<span>{formatAlertDate(alert.createdAt)}</span>
												<span className="text-sm font-semibold text-[#1b1b1b] dark:text-white">
													{alert.owner}
												</span>
												{alert.action ? (
													<Button asChild variant="outline" className="h-8 border-black/20 px-3">
														<Link href={alert.action.href}>{alert.action.label}</Link>
													</Button>
												) : null}
											</div>
										</div>
									</div>
								)
							})}
						</div>
					) : null}
				</div>

				<div className="space-y-4 lg:col-span-4">
					<Card className="border-black/10 bg-white/80 shadow-[0_18px_40px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-white/5">
						<CardHeader>
							<CardTitle className="text-lg">Radar del dia</CardTitle>
							<CardDescription>Distribucion actual de severidades.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<div className="text-muted-foreground flex items-center justify-between text-xs">
									<span>Peso de criticas</span>
									<span className="font-semibold text-[#1c1c1c] dark:text-white">
										{criticalProgress}%
									</span>
								</div>
								<Progress
									value={criticalProgress}
									className="bg-[#e5484d]/20 [&>[data-slot=progress-indicator]]:bg-[#e5484d]"
								/>
								<div className="text-muted-foreground flex items-center justify-between text-xs">
									<span>Peso de advertencias</span>
									<span className="font-semibold text-[#1c1c1c] dark:text-white">
										{warningProgress}%
									</span>
								</div>
								<Progress
									value={warningProgress}
									className="bg-[#f2a20c]/20 [&>[data-slot=progress-indicator]]:bg-[#f2a20c]"
								/>
							</div>
							<Separator />
							<div className="flex items-center justify-between text-sm">
								<div className="text-muted-foreground flex items-center gap-2">
									<MapPin className="h-4 w-4" />
									Cobertura por reglas
								</div>
								<span className="font-semibold text-[#0f766e]">
									{ruleHighlights.length} activas
								</span>
							</div>
						</CardContent>
					</Card>

					<Card className="border-black/10 bg-white/80 shadow-[0_18px_40px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-white/5">
						<CardHeader>
							<CardTitle className="text-lg">Agenda critica</CardTitle>
							<CardDescription>Alertas prioritarias para hoy.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							{agendaItems.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									Sin alertas criticas o de advertencia.
								</p>
							) : null}
							{agendaItems.map((item) => {
								const Icon = iconMap[item.icon] || AlertTriangle
								return (
									<div
										key={item.id}
										className="flex items-start justify-between gap-3 rounded-xl border border-black/10 bg-white/90 px-3 py-2 dark:border-white/10 dark:bg-white/5"
									>
										<div className="flex items-start gap-3">
											<div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#0f766e]/10 text-[#0f766e]">
												<Icon className="h-4 w-4" />
											</div>
											<div>
												<p className="text-sm font-semibold text-[#1c1c1c] dark:text-white">
													{item.title}
												</p>
												<p className="text-muted-foreground text-xs">{scopeLabels[item.scope]}</p>
											</div>
										</div>
										<span className="text-muted-foreground text-xs font-medium">
											{formatAlertDate(item.createdAt)}
										</span>
									</div>
								)
							})}
						</CardContent>
					</Card>

					<Card className="border-black/10 bg-white/80 shadow-[0_18px_40px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-white/5">
						<CardHeader>
							<CardTitle className="text-lg">Reglas mas activas</CardTitle>
							<CardDescription>Concentracion de incidencias por regla.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							{ruleHighlights.length === 0 ? (
								<p className="text-muted-foreground text-sm">No hay reglas activas.</p>
							) : null}
							{ruleHighlights.map((item) => (
								<div
									key={item.ruleId}
									className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white/90 px-3 py-2 dark:border-white/10 dark:bg-white/5"
								>
									<div className="flex items-center gap-2">
										<div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0f766e]/10 text-[#0f766e]">
											<CheckCircle2 className="h-4 w-4" />
										</div>
										<div>
											<p className="text-sm font-medium text-[#1c1c1c] dark:text-white">
												{item.title}
											</p>
											<p className="text-muted-foreground text-xs">{item.ruleId}</p>
										</div>
									</div>
									<Badge variant="outline" className="border-[#0f766e]/30 text-[#0f766e]">
										{item.count}
									</Badge>
								</div>
							))}
						</CardContent>
					</Card>
				</div>
			</section>
		</div>
	)
}
