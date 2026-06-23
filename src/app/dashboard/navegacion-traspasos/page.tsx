"use client"

import { endOfDay, startOfDay } from "date-fns"
import { AlertCircle } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import type { PaginationState, SortingState } from "@tanstack/react-table"

import { createTransferColumns } from "@/project/transfers/columns/transfer-columns"
import { useTransfers } from "@/project/transfers/hooks/use-transfers"

import { AgencyTransferDetailSheet } from "@/project/transfers/components/agency-transfer-detail-sheet"
import { TutorialVideosDialog } from "@/shared/components/tutorials/tutorial-videos-dialog"
import { TransferDataTable } from "@/project/transfers/components/data/transfer-data-table"
import { TransferInsights } from "@/project/transfers/components/stats/transfer-insights"
import { ModuleLoadingSkeleton } from "@/shared/components/ui/module-loading-skeleton"
import { AuditDialog } from "@/shared/components/audit/audit-dialog"

import type {
	TransferWithDetails,
	TransferFilters,
} from "@/project/transfers/actions/transfer.actions"
import type { DateRange } from "react-day-picker"

export default function TransfersNavigationPage() {
	const router = useRouter()
	const [showCancelled, setShowCancelled] = useState(false)
	const [filters, setFilters] = useState<TransferFilters>({})
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 })
	const [sorting, setSorting] = useState<SortingState>([])
	const sortParam = sorting[0]
		? { field: sorting[0].id, order: (sorting[0].desc ? "desc" : "asc") as "asc" | "desc" }
		: undefined
	const {
		data: paginatedTransfers,
		isLoading,
		isFetching,
		error,
	} = useTransfers(
		{ ...filters, showCancelled },
		pagination.pageIndex + 1,
		pagination.pageSize,
		sortParam
	)

	const [selectedTransfer, setSelectedTransfer] = useState<TransferWithDetails | null>(null)
	const [sheetOpen, setSheetOpen] = useState(false)
	const [auditDialogOpen, setAuditDialogOpen] = useState(false)
	const [auditTransfer, setAuditTransfer] = useState<TransferWithDetails | null>(null)

	const [dateFilter, setDateFilter] = useState<DateRange | undefined>(undefined)
	const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all")
	const [agencyFilter, setAgencyFilter] = useState<string>("")
	const [searchFilter, setSearchFilter] = useState<string>("")

	const transfers = paginatedTransfers?.data || []
	const totalRecords = paginatedTransfers?.total || 0

	// Sync filter dropdown state with server-side filters
	const handlePaymentStatusFilterChange = (status: string) => {
		setPaymentStatusFilter(status)
		setFilters((prev) => ({
			...prev,
			paymentStatus: status === "all" ? undefined : (status as TransferFilters["paymentStatus"]),
		}))
		setPagination((prev) => ({ ...prev, pageIndex: 0 }))
	}

	const handleAgencyFilterChange = (agency: string) => {
		setAgencyFilter(agency)
		setFilters((prev) => ({
			...prev,
			agencyName: agency && agency !== "all" ? agency : undefined,
		}))
		setPagination((prev) => ({ ...prev, pageIndex: 0 }))
	}

	const handleDateFilterChange = (range: DateRange | undefined) => {
		setDateFilter(range)
		setFilters((prev) => ({
			...prev,
			startDate: range?.from ? startOfDay(range.from) : undefined,
			endDate: range?.to ? endOfDay(range.to) : range?.from ? endOfDay(range.from) : undefined,
		}))
		setPagination((prev) => ({ ...prev, pageIndex: 0 }))
	}

	const handleSearchFilterChange = (search: string) => {
		setSearchFilter(search)
		setFilters((prev) => ({
			...prev,
			search: search || undefined,
		}))
		setPagination((prev) => ({ ...prev, pageIndex: 0 }))
	}

	const handleViewDetails = (transfer: TransferWithDetails) => {
		setSelectedTransfer(transfer)
		setSheetOpen(true)
	}

	const handleViewAudit = (transfer: TransferWithDetails) => {
		setAuditTransfer(transfer)
		setAuditDialogOpen(true)
	}

	const handleShowCancelledChange = (checked: boolean) => {
		setShowCancelled(checked)
		setPagination((prev) => ({ ...prev, pageIndex: 0 }))
	}

	const handleEdit = (transfer: TransferWithDetails) => {
		router.push(`/dashboard/navegacion-traspasos/${transfer.id}/editar`)
	}

	const columns = createTransferColumns(handleViewDetails, handleViewAudit, handleEdit)

	if (error) {
		return (
			<div className="flex min-h-[400px] items-center justify-center">
				<div className="text-center">
					<AlertCircle className="text-destructive mx-auto h-8 w-8" />
					<p className="text-destructive mt-4">Error al cargar los traspasos</p>
					<p className="text-muted-foreground mt-2 text-sm">
						{error?.message || "Error desconocido"}
					</p>
				</div>
			</div>
		)
	}

	if (isLoading && !paginatedTransfers) {
		return (
			<ModuleLoadingSkeleton
				titleWidthClassName="w-[340px]"
				descriptionWidthClassName="w-[410px]"
			/>
		)
	}

	return (
		<div className="space-y-6">
			<section>
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold tracking-tight">Navegacion de Traspasos</h1>
						<p className="text-muted-foreground mt-1">
							Gestiona y visualiza todos los traspasos a agencias
						</p>
					</div>
					<TutorialVideosDialog
						buttonLabel="Tutorial Navegación"
						title="Navegación de Traspasos"
						description="Aprende a navegar y gestionar todos los traspasos a agencias."
						videos={[
							{
								title: "Navegación de Traspasos",
								url: "https://youtu.be/Sp7u9YJVsi0",
							},
						]}
					/>
				</div>
			</section>

			{transfers && <TransferInsights transfers={transfers} />}

			<TransferDataTable
				columns={columns}
				data={transfers}
				dateFilter={dateFilter}
				setDateFilter={handleDateFilterChange}
				paymentStatusFilter={paymentStatusFilter}
				setPaymentStatusFilter={handlePaymentStatusFilterChange}
				agencyFilter={agencyFilter}
				setAgencyFilter={handleAgencyFilterChange}
				searchFilter={searchFilter}
				setSearchFilter={handleSearchFilterChange}
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
				showCancelled={showCancelled}
				onShowCancelledChange={handleShowCancelledChange}
			/>

			{selectedTransfer && (
				<AgencyTransferDetailSheet
					data={selectedTransfer}
					variant="transfer"
					open={sheetOpen}
					onOpenChange={setSheetOpen}
				/>
			)}

			{auditTransfer && (
				<AuditDialog
					open={auditDialogOpen}
					onOpenChange={setAuditDialogOpen}
					entityType="Transfer"
					entityId={auditTransfer.id}
					entityName={`Traspaso #${auditTransfer.saleRecord?.voucher}`}
				/>
			)}
		</div>
	)
}
