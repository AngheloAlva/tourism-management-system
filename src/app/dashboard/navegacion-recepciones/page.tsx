"use client"

import { AlertCircle } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"

import { TutorialVideosDialog } from "@/shared/components/tutorials/tutorial-videos-dialog"
import { createReceptionColumns } from "@/project/receptions/columns/reception-columns"
import { useReceptions } from "@/project/receptions/hooks/use-receptions"

import { AgencyTransferDetailSheet } from "@/project/transfers/components/agency-transfer-detail-sheet"
import { ReceptionDataTable } from "@/project/receptions/components/data/reception-data-table"
import { ReceptionInsights } from "@/project/receptions/components/stats/reception-insights"
import { ModuleLoadingSkeleton } from "@/shared/components/ui/module-loading-skeleton"
import { AuditDialog } from "@/shared/components/audit/audit-dialog"

import type { PaginationState, SortingState } from "@tanstack/react-table"

import type {
	ReceptionWithDetails,
	ReceptionFilters,
} from "@/project/receptions/actions/reception.actions"

export default function ReceptionsNavigationPage() {
	const router = useRouter()
	const [filters, setFilters] = useState<ReceptionFilters>({})
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 })
	const [sorting, setSorting] = useState<SortingState>([])
	const sortParam = sorting[0]
		? { field: sorting[0].id, order: (sorting[0].desc ? "desc" : "asc") as "asc" | "desc" }
		: undefined
	const {
		data: paginatedReceptions,
		isLoading,
		isFetching,
		error,
	} = useReceptions(filters, pagination.pageIndex + 1, pagination.pageSize, sortParam)

	const [selectedReception, setSelectedReception] = useState<ReceptionWithDetails | null>(null)
	const [sheetOpen, setSheetOpen] = useState(false)
	const [auditDialogOpen, setAuditDialogOpen] = useState(false)
	const [auditReception, setAuditReception] = useState<ReceptionWithDetails | null>(null)

	const receptions = paginatedReceptions?.data || []
	const totalRecords = paginatedReceptions?.total || 0

	const handleViewDetails = (reception: ReceptionWithDetails) => {
		setSelectedReception(reception)
		setSheetOpen(true)
	}

	const handleViewAudit = (reception: ReceptionWithDetails) => {
		setAuditReception(reception)
		setAuditDialogOpen(true)
	}

	const handleEdit = (reception: ReceptionWithDetails) => {
		router.push(`/dashboard/navegacion-recepciones/${reception.id}/editar`)
	}

	const columns = createReceptionColumns(handleViewDetails, handleViewAudit, handleEdit)

	if (error) {
		return (
			<div className="flex min-h-[400px] items-center justify-center">
				<div className="text-center">
					<AlertCircle className="text-destructive mx-auto h-8 w-8" />
					<p className="text-destructive mt-4">Error al cargar las recepciones</p>
					<p className="text-muted-foreground mt-2 text-sm">
						{error?.message || "Error desconocido"}
					</p>
				</div>
			</div>
		)
	}

	if (isLoading) {
		return (
			<ModuleLoadingSkeleton
				titleWidthClassName="w-[360px]"
				descriptionWidthClassName="w-[420px]"
			/>
		)
	}

	return (
		<div className="space-y-6">
			<section>
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold tracking-tight">Navegación de Recepciones</h1>
						<p className="text-muted-foreground mt-1">
							Gestiona y visualiza todas las recepciones de tours
						</p>
					</div>
					<TutorialVideosDialog
						buttonLabel="Tutorial Navegación"
						title="Navegación de Recepciones"
						description="Aprende a navegar y gestionar todas las recepciones de tours."
						videos={[
							{
								title: "Navegación de Recepciones",
								url: "https://youtu.be/YnZksECcMis",
							},
						]}
					/>
				</div>
			</section>

			{receptions && <ReceptionInsights receptions={receptions} />}

			<ReceptionDataTable
				columns={columns}
				data={receptions}
				filters={filters}
				onFiltersChange={(newFilters) => {
					setFilters(newFilters)
					setPagination((prev) => ({ ...prev, pageIndex: 0 }))
				}}
				isLoading={isFetching}
				onRowClick={handleViewDetails}
				totalRecords={totalRecords}
				pagination={pagination}
				onPaginationChange={setPagination}
				sorting={sorting}
				onSortingChange={(next) => {
					setSorting(next)
					setPagination((prev) => ({ ...prev, pageIndex: 0 }))
				}}
			/>

			{selectedReception && (
				<AgencyTransferDetailSheet
					data={selectedReception}
					variant="reception"
					open={sheetOpen}
					onOpenChange={setSheetOpen}
				/>
			)}

			{auditReception && (
				<AuditDialog
					entityType="Reception"
					open={auditDialogOpen}
					onOpenChange={setAuditDialogOpen}
					entityId={auditReception.id}
				/>
			)}
		</div>
	)
}
