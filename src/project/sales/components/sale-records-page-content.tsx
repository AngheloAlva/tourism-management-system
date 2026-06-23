"use client"

import { AlertCircle, BadgeDollarSign, FileText } from "lucide-react"
import { useState } from "react"
import type { PaginationState, SortingState } from "@tanstack/react-table"

import { useSaleRecords, useSalesSummary } from "@/project/sales/hooks/use-sale-records"
import { createSaleRecordColumns } from "@/project/sales/columns/sale-record.columns"

import { QuotesOnlyInsights } from "@/project/sales/components/quotes-only-insights"
import { SalesOnlyInsights } from "@/project/sales/components/sales-only-insights"
import { DeleteSaleDialog } from "@/project/sales/components/delete-sale-dialog"
import { CancelSaleDialog } from "@/project/sales/components/cancel-sale-dialog"
import { SaleDetailSheet } from "@/project/sales/components/sale-detail-sheet"
import { SalesDataTable } from "@/project/sales/components/sales-data-table"
import { InsightsSkeleton } from "@/shared/components/ui/insights-skeleton"
import { AuditDialog } from "@/shared/components/audit/audit-dialog"

import type {
	SaleRecordFilters,
	SaleRecordWithDetails,
} from "@/project/sales/actions/sale-record.actions"

type RecordsPageMode = "SALE" | "QUOTE"

interface SaleRecordsPageContentProps {
	mode: RecordsPageMode
}

interface ModeConfig {
	title: string
	description: string
	historyTitle: string
	historyDescription: string
	entityName: string
	headerIcon: typeof BadgeDollarSign
	headerIconClassName: string
}

const MODE_CONFIG: Record<RecordsPageMode, ModeConfig> = {
	SALE: {
		title: "Navegación de Ventas",
		description: "Gestiona y visualiza todas tus ventas confirmadas",
		historyTitle: "Historial de Ventas",
		historyDescription: "Lista completa de todas las ventas confirmadas",
		entityName: "Venta",
		headerIcon: BadgeDollarSign,
		headerIconClassName: "text-emerald-600",
	},
	QUOTE: {
		title: "Navegación de Cotizaciones",
		description: "Gestiona y visualiza todas tus cotizaciones pendientes",
		historyTitle: "Historial de Cotizaciones",
		historyDescription: "Lista completa de todas las cotizaciones pendientes",
		entityName: "Cotización",
		headerIcon: FileText,
		headerIconClassName: "text-sky-600",
	},
}

export function SaleRecordsPageContent({ mode }: SaleRecordsPageContentProps) {
	const config = MODE_CONFIG[mode]
	const [filters, setFilters] = useState<SaleRecordFilters>({ type: mode })
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 })
	const [sorting, setSorting] = useState<SortingState>([])
	const sortParam = sorting[0]
		? { field: sorting[0].id, order: (sorting[0].desc ? "desc" : "asc") as "asc" | "desc" }
		: undefined
	const {
		data: paginatedRecords,
		isFetching: recordsFetching,
		error: recordsError,
	} = useSaleRecords(filters, pagination.pageIndex + 1, pagination.pageSize, sortParam)
	const { data: summary, isLoading: summaryLoading, error: summaryError } = useSalesSummary(filters)

	const [selectedRecord, setSelectedRecord] = useState<SaleRecordWithDetails | null>(null)
	const [sheetOpen, setSheetOpen] = useState(false)
	const [auditDialogOpen, setAuditDialogOpen] = useState(false)
	const [auditRecord, setAuditRecord] = useState<SaleRecordWithDetails | null>(null)
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [deletingRecord, setDeletingRecord] = useState<SaleRecordWithDetails | null>(null)
	const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
	const [cancellingRecord, setCancellingRecord] = useState<SaleRecordWithDetails | null>(null)

	const records = paginatedRecords?.data || []
	const totalRecords = paginatedRecords?.total || 0

	const handleViewDetails = (record: SaleRecordWithDetails) => {
		setSelectedRecord(record)
		setSheetOpen(true)
	}

	const handleViewAudit = (record: SaleRecordWithDetails) => {
		setAuditRecord(record)
		setAuditDialogOpen(true)
	}

	const handleDelete = (record: SaleRecordWithDetails) => {
		setDeletingRecord(record)
		setDeleteDialogOpen(true)
	}

	const handleCancel = (record: SaleRecordWithDetails) => {
		setCancellingRecord(record)
		setCancelDialogOpen(true)
	}

	const columns = createSaleRecordColumns(handleViewDetails, handleViewAudit, handleDelete, handleCancel)
	const HeaderIcon = config.headerIcon

	if (recordsError || summaryError) {
		return (
			<div className="flex min-h-[400px] items-center justify-center">
				<div className="text-center">
					<AlertCircle className="text-destructive mx-auto h-8 w-8" />
					<p className="text-destructive mt-4">Error al cargar los datos</p>
					<p className="text-muted-foreground mt-2 text-sm">
						{recordsError?.message || summaryError?.message}
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className="w-full min-w-0 space-y-6">
			<section>
				<div className="flex items-start justify-between gap-3">
					<div>
						<h1 className="text-2xl font-bold tracking-tight md:text-3xl">{config.title}</h1>
						<p className="text-muted-foreground mt-1">{config.description}</p>
					</div>
					<div className="bg-background/80 rounded-full border p-2 shadow-sm">
						<HeaderIcon className={`h-5 w-5 ${config.headerIconClassName}`} />
					</div>
				</div>
			</section>

			{summaryLoading ? (
				<InsightsSkeleton count={3} />
			) : mode === "SALE" ? (
				summary && <SalesOnlyInsights summary={summary} />
			) : (
				summary && <QuotesOnlyInsights summary={summary} />
			)}

			<SalesDataTable
				data={records}
				filters={filters}
				columns={columns}
				isLoading={recordsFetching}
				historyTitle={config.historyTitle}
				onFiltersChange={(newFilters) => {
					setFilters(newFilters)
					setPagination((prev) => ({ ...prev, pageIndex: 0 }))
				}}
				onRowClick={handleViewDetails}
				historyDescription={config.historyDescription}
				totalRecords={totalRecords}
				pagination={pagination}
				onPaginationChange={setPagination}
				sorting={sorting}
				onSortingChange={(next) => {
					setSorting(next)
					setPagination((prev) => ({ ...prev, pageIndex: 0 }))
				}}
			/>

			<SaleDetailSheet
				sale={selectedRecord}
				open={sheetOpen}
				onOpenChange={setSheetOpen}
				onViewAudit={handleViewAudit}
				onDelete={handleDelete}
				onCancel={handleCancel}
			/>

			<DeleteSaleDialog
				sale={deletingRecord}
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
			/>

			<CancelSaleDialog
				sale={cancellingRecord}
				open={cancelDialogOpen}
				onOpenChange={setCancelDialogOpen}
			/>

			{auditRecord && (
				<AuditDialog
					open={auditDialogOpen}
					onOpenChange={setAuditDialogOpen}
					entityType="SaleRecord"
					entityId={auditRecord.id}
					entityName={`${config.entityName} #${auditRecord.voucher}`}
				/>
			)}
		</div>
	)
}
