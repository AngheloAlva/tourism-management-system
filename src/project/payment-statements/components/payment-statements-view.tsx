"use client"

import { endOfMonth, format, startOfMonth } from "date-fns"
import { FileText, Download, Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { ModuleLoadingSkeleton } from "@/shared/components/ui/module-loading-skeleton"
import { PaymentStatementFiltersComponent } from "./payment-statement-filters"
import { useAgenciesWithSales } from "../hooks/use-payment-statements"
import { PaymentStatementSummary } from "./payment-statement-summary"
import { PaymentStatementTable } from "./payment-statement-table"
import { Button } from "@/shared/components/ui/button"
import { SaleDetailSheet } from "./sale-detail-sheet"

import type {
	PaymentStatementFilters,
	PaymentStatementSale,
} from "../types/payment-statement.types"

export function PaymentStatementsView() {
	const today = new Date()
	const [filters, setFilters] = useState<PaymentStatementFilters>({
		startDate: startOfMonth(today),
		endDate: endOfMonth(today),
	})
	const [selectedSale, setSelectedSale] = useState<PaymentStatementSale | null>(null)
	const [isSheetOpen, setIsSheetOpen] = useState(false)
	const [isGenerating, setIsGenerating] = useState(false)

	const { data: agencies, isLoading: isLoadingAgencies } = useAgenciesWithSales()

	if (isLoadingAgencies && !agencies) {
		return (
			<ModuleLoadingSkeleton
				titleWidthClassName="w-[260px]"
				descriptionWidthClassName="w-[400px]"
			/>
		)
	}

	const handleViewDetail = (sale: PaymentStatementSale) => {
		setSelectedSale(sale)
		setIsSheetOpen(true)
	}

	const handleCloseSheet = () => {
		setIsSheetOpen(false)
		setTimeout(() => setSelectedSale(null), 300)
	}

	const hasAgencies = (filters.agencyIds?.length ?? 0) > 0

	const handleGeneratePdf = async () => {
		if (!hasAgencies) {
			toast.error("Selecciona al menos una agencia primero")
			return
		}

		setIsGenerating(true)
		try {
			const startDate = filters.startDate.toISOString()
			const endDate = filters.endDate.toISOString()
			const fileDateRange = `${format(filters.startDate, "yyyy-MM-dd")}_${format(filters.endDate, "yyyy-MM-dd")}`
			const agencyIdsParam = (filters.agencyIds ?? []).join(",")

			const response = await fetch(
				`/api/payment-statements/pdf?agencyIds=${encodeURIComponent(agencyIdsParam)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
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
			const agencyLabel =
				(filters.agencyIds?.length ?? 0) === 1
					? (agencies?.find((ag) => ag.id === filters.agencyIds?.[0])?.name ?? "agencia")
					: "multiagencia"
			a.download = `estado-pago-${agencyLabel}-${fileDateRange}.pdf`
			document.body.appendChild(a)
			a.click()
			window.URL.revokeObjectURL(url)
			document.body.removeChild(a)

			toast.success("PDF generado exitosamente")
		} catch (error) {
			console.error("Error generating PDF:", error)
			toast.error(error instanceof Error ? error.message : "Error al generar el PDF")
		} finally {
			setIsGenerating(false)
		}
	}

	return (
		<div className="flex flex-col gap-6">
			{/* Header */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
						<FileText className="h-7 w-7" />
						Facturación
					</h1>
					<p className="text-muted-foreground">
						Genera documentos de pago consolidados para agencias mayoristas
					</p>
				</div>

				{hasAgencies && (
					<Button onClick={handleGeneratePdf} disabled={isGenerating} className="gap-2">
						{isGenerating ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Download className="h-4 w-4" />
						)}
						{isGenerating ? "Generando..." : "Generar PDF del Período"}
					</Button>
				)}
			</div>

			{/* Filtros */}
			<PaymentStatementFiltersComponent filters={filters} onFiltersChange={setFilters} />

			{/* Resumen */}
			<PaymentStatementSummary filters={filters} />

			{/* Tabla de Ventas */}
			<PaymentStatementTable filters={filters} onViewDetail={handleViewDetail} />

			{/* Sheet de Detalle */}
			<SaleDetailSheet sale={selectedSale} open={isSheetOpen} onOpenChange={handleCloseSheet} />
		</div>
	)
}
