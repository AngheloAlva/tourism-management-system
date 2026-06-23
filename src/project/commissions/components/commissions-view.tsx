"use client"

import { Download, Loader2, Percent } from "lucide-react"
import { useState, useEffect } from "react"
import { endOfMonth, startOfMonth } from "date-fns"

import { CommissionDateFilters } from "./commission-date-filters"
import { CommissionOperatorFilter } from "./commission-operator-filter"
import { CommissionSummaryCards } from "./commission-summary"
import { CommissionTable } from "./commission-table"
import {
	useCommissionSales,
	useCommissionOperators,
	useMarkCommissionsAsPaid,
} from "../hooks/use-commissions"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { USER_ROLE } from "@/project/users/constants/roles"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { Button } from "@/shared/components/ui/button"
import { ModuleLoadingSkeleton } from "@/shared/components/ui/module-loading-skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs"

import type { CommissionFilters, CommissionKind } from "../types/commission.types"

interface CommissionTabPanelProps {
	kind: CommissionKind
	dateRange: { startDate: Date; endDate: Date }
	operatorId: string
	onOperatorChange: (id: string) => void
	isAdmin: boolean
}

function CommissionTabPanel({
	kind,
	dateRange,
	operatorId,
	onOperatorChange,
	isAdmin,
}: CommissionTabPanelProps) {
	const isSpecial = kind === "SPECIAL"
	const defaultPercentage = kind === "REGULAR" ? "10" : ""

	const [commissionPercentage, setCommissionPercentage] = useState(defaultPercentage)
	const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

	const { data: operators } = useCommissionOperators(kind, dateRange, { enabled: isAdmin })

	// Auto-deselect operator when it's not in the new kind's operator list.
	// Admins only: non-admins have operatorId pinned to their own user id by the parent.
	useEffect(() => {
		if (!isAdmin) return
		if (!operatorId || !operators) return
		const isValid = operators.some((op) => op.id === operatorId)
		if (!isValid) {
			onOperatorChange("")
		}
	}, [isAdmin, operators, operatorId, onOperatorChange])

	const filters: CommissionFilters = {
		operatorId,
		startDate: dateRange.startDate,
		endDate: dateRange.endDate,
	}

	const { data: sales = [] } = useCommissionSales(kind, filters)
	const markCommissionsMutation = useMarkCommissionsAsPaid()

	const parsedPercentage = Number.parseFloat(commissionPercentage)
	const validPercentage = !Number.isNaN(parsedPercentage) && parsedPercentage > 0

	const pendingBookingsCount = sales.flatMap((s) => s.bookings).filter((b) => !b.commissionPaid).length

	const handlePercentageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setCommissionPercentage(e.target.value)
	}

	const handleMarkAsPaid = async () => {
		if (!validPercentage) {
			toast.error("Ingresá un porcentaje válido mayor a 0")
			return
		}

		const pendingBookings = sales.flatMap((s) => s.bookings).filter((b) => !b.commissionPaid)
		if (pendingBookings.length === 0) {
			toast.info("No hay eventos pendientes de comisión")
			return
		}

		const result = await markCommissionsMutation.mutateAsync({
			bookingIds: pendingBookings.map((b) => b.id),
			percentage: parsedPercentage,
			kind,
		})

		if (!result.success) {
			toast.error(
				"error" in result ? result.error : "No se pudieron registrar las comisiones"
			)
			return
		}

		const kindLabel = kind === "REGULAR" ? "regulares" : "especiales"
		toast.success(`Comisiones ${kindLabel} marcadas como pagadas`)
	}

	const handleGeneratePdf = async () => {
		if (!operatorId) {
			toast.error("Seleccioná una operadora primero")
			return
		}

		if (!isSpecial && !validPercentage) {
			toast.error("Ingresá un porcentaje válido mayor a 0")
			return
		}

		setIsGeneratingPdf(true)
		try {
			const startDate = dateRange.startDate.toISOString()
			const endDate = dateRange.endDate.toISOString()
			const pdfPercentage = isSpecial ? 0 : parsedPercentage

			const response = await fetch(
				`/api/commissions/pdf?operatorId=${operatorId}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&percentage=${pdfPercentage}&kind=${kind}`,
				{ method: "GET" }
			)

			if (!response.ok) {
				const error = await response.json()
				throw new Error(error.message || "Error al generar el PDF")
			}

			const blob = await response.blob()
			const url = window.URL.createObjectURL(blob)
			const a = document.createElement("a")
			a.href = url
			document.body.appendChild(a)
			a.click()
			window.URL.revokeObjectURL(url)
			document.body.removeChild(a)

			toast.success("PDF generado exitosamente")
		} catch (error) {
			console.error("Error generating PDF:", error)
			toast.error(error instanceof Error ? error.message : "Error al generar el PDF")
		} finally {
			setIsGeneratingPdf(false)
		}
	}

	return (
		<div className="flex flex-col gap-6">
			{/* Per-tab toolbar: operator (left) + actions (right) */}
			<div className="flex flex-wrap items-end justify-between gap-4">
				{isAdmin ? (
					<CommissionOperatorFilter
						kind={kind}
						operatorId={operatorId}
						onOperatorChange={onOperatorChange}
						dateRange={dateRange}
					/>
				) : (
					<div />
				)}

				{operatorId && (
					<div className="flex flex-wrap items-center gap-2">
						{!isSpecial && (
							<>
								<Label
									htmlFor={`commission-pct-${kind}`}
									className="text-sm font-medium whitespace-nowrap"
								>
									Comisión %
								</Label>
								<div className="relative w-24">
									<Input
										id={`commission-pct-${kind}`}
										type="number"
										min={0}
										max={100}
										step={0.5}
										value={commissionPercentage}
										onChange={handlePercentageChange}
										placeholder="0"
										className="pr-7 text-right"
									/>
									<span className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-sm">
										%
									</span>
								</div>
								<Button
									type="button"
									onClick={handleMarkAsPaid}
									disabled={
										markCommissionsMutation.isPending ||
										pendingBookingsCount === 0 ||
										!validPercentage
									}
								>
									Marcar comisiones regulares como pagadas
								</Button>
							</>
						)}
						<Button
							variant="outline"
							onClick={handleGeneratePdf}
							disabled={
								isGeneratingPdf || sales.length === 0 || (!isSpecial && !validPercentage)
							}
							className="gap-2"
						>
							{isGeneratingPdf ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Download className="h-4 w-4" />
							)}
							{isGeneratingPdf ? "Generando..." : "PDF"}
						</Button>
					</div>
				)}
			</div>

			{/* Resumen */}
			<CommissionSummaryCards
				kind={kind}
				filters={filters}
				commissionPercentage={validPercentage ? parsedPercentage : 0}
			/>

			{/* Tabla de Ventas */}
			<CommissionTable kind={kind} filters={filters} />
		</div>
	)
}

export function CommissionsView() {
	const today = new Date()
	const [dateRange, setDateRange] = useState({
		startDate: startOfMonth(today),
		endDate: endOfMonth(today),
	})
	const [activeTab, setActiveTab] = useState<CommissionKind>("REGULAR")
	const [operatorId, setOperatorId] = useState("")

	const { data: session, isPending: isLoadingSession } = authClient.useSession()
	const currentUserId = session?.user?.id ?? ""
	const currentUserRole = (session?.user as { role?: string } | undefined)?.role
	const isAdmin = currentUserRole === USER_ROLE.ADMIN

	// Non-admin users only see their own commissions: pin operatorId to their user id.
	useEffect(() => {
		if (!isLoadingSession && !isAdmin && currentUserId && operatorId !== currentUserId) {
			setOperatorId(currentUserId)
		}
	}, [isLoadingSession, isAdmin, currentUserId, operatorId])

	// Operators dropdown is only used by admins; skip the heavy load otherwise.
	const { isLoading: isLoadingRegular } = useCommissionOperators("REGULAR", dateRange, {
		enabled: isAdmin,
	})
	const { isLoading: isLoadingSpecial } = useCommissionOperators("SPECIAL", dateRange, {
		enabled: isAdmin,
	})
	const isLoadingOperators = isAdmin && (isLoadingRegular || isLoadingSpecial)

	if (isLoadingSession || isLoadingOperators) {
		return (
			<ModuleLoadingSkeleton
				titleWidthClassName="w-[240px]"
				descriptionWidthClassName="w-[430px]"
			/>
		)
	}

	return (
		<div className="flex flex-col gap-6">
			{/* Header */}
			<div>
				<h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
					<Percent className="h-7 w-7" />
					Comisiones
				</h1>
				<p className="text-muted-foreground">
					Calculá comisiones de operadoras sobre el valor neto de tours
				</p>
			</div>

			{/* Tabs (left) + shared date filter (right) on the same row */}
			<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CommissionKind)}>
				<div className="flex flex-wrap items-center justify-between gap-4">
					<TabsList>
						<TabsTrigger value="REGULAR">Regulares</TabsTrigger>
						<TabsTrigger value="SPECIAL">Especiales (Volcanes/Uyuni)</TabsTrigger>
					</TabsList>

					<CommissionDateFilters dateRange={dateRange} onDateRangeChange={setDateRange} />
				</div>

				<TabsContent value="REGULAR" className="mt-6">
					<CommissionTabPanel
						kind="REGULAR"
						dateRange={dateRange}
						operatorId={operatorId}
						onOperatorChange={setOperatorId}
						isAdmin={isAdmin}
					/>
				</TabsContent>

				<TabsContent value="SPECIAL" className="mt-6">
					<CommissionTabPanel
						kind="SPECIAL"
						dateRange={dateRange}
						operatorId={operatorId}
						onOperatorChange={setOperatorId}
						isAdmin={isAdmin}
					/>
				</TabsContent>
			</Tabs>
		</div>
	)
}
