"use client"

import { CalendarIcon, FilterXIcon, Search } from "lucide-react"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
import { useState, useMemo, useEffect } from "react"
import { es } from "date-fns/locale"
import {
	useReactTable,
	getCoreRowModel,
	getFilteredRowModel,
} from "@tanstack/react-table"
import type { PaginationState } from "@tanstack/react-table"

import { useDebounce } from "@/shared/hooks/use-debounce"
import { cn } from "@/lib/utils"

import { CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover"
import { Calendar } from "@/shared/components/ui/calendar"
import { TableFilterDropdown } from "@/shared/components/ui/table-filter-dropdown"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { DataGrid, DataGridContainer } from "@/shared/components/data-grid/data-grid"
import { DataGridTable } from "@/shared/components/data-grid/data-grid-table"
import { DataGridPagination } from "@/shared/components/data-grid/data-grid-pagination"
import { Switch } from "@/shared/components/ui/switch"
import { Label } from "@/shared/components/ui/label"

import type { ColumnDef, SortingState, ColumnFiltersState } from "@tanstack/react-table"
import type { TransferWithDetails } from "../../actions/transfer.actions"

const QUICK_PAYMENT_STATUS_FILTERS = [
	{ value: "PENDING", label: "Pendiente" },
	{ value: "ENTRANCE_ONLY", label: "Solo Entradas" },
	{ value: "TOUR_ONLY", label: "Solo Tour" },
	{ value: "FULLY_PAID", label: "Pagado" },
] as const

interface TransferDataTableProps<TData extends object, TValue> {
	columns: ColumnDef<TData, TValue>[]
	data: TData[]
	dateFilter?: DateRange | undefined
	setDateFilter?: (dateRange: DateRange | undefined) => void
	paymentStatusFilter?: string
	setPaymentStatusFilter?: (status: string) => void
	agencyFilter?: string
	setAgencyFilter?: (agency: string) => void
	searchFilter?: string
	setSearchFilter?: (search: string) => void
	isLoading?: boolean
	onRowClick?: (row: TData) => void
	totalRecords: number
	pagination: PaginationState
	onPaginationChange: (pagination: PaginationState) => void
	sorting: SortingState
	onSortingChange: (sorting: SortingState) => void
	showCancelled?: boolean
	onShowCancelledChange?: (checked: boolean) => void
}

export function TransferDataTable<TData extends object, TValue>({
	columns,
	data,
	dateFilter: externalDateFilter,
	setDateFilter: externalSetDateFilter,
	paymentStatusFilter: externalPaymentStatusFilter,
	setPaymentStatusFilter: externalSetPaymentStatusFilter,
	agencyFilter: externalAgencyFilter,
	setAgencyFilter: externalSetAgencyFilter,
	searchFilter: externalSearchFilter,
	setSearchFilter: externalSetSearchFilter,
	isLoading = false,
	onRowClick,
	totalRecords,
	pagination,
	onPaginationChange,
	sorting,
	onSortingChange,
	showCancelled = false,
	onShowCancelledChange,
}: TransferDataTableProps<TData, TValue>) {
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [internalDateFilter, setInternalDateFilter] = useState<DateRange | undefined>(undefined)
	const [internalPaymentStatusFilter, setInternalPaymentStatusFilter] = useState<string>("all")
	const [internalAgencyFilter, setInternalAgencyFilter] = useState<string>("")
	const [searchTerm, setSearchTerm] = useState<string>("")
	const debouncedSearchTerm = useDebounce(searchTerm, 400)

	const dateFilter = externalDateFilter !== undefined ? externalDateFilter : internalDateFilter
	const setDateFilter = externalSetDateFilter || setInternalDateFilter
	const paymentStatusFilter = externalPaymentStatusFilter || internalPaymentStatusFilter
	const setPaymentStatusFilter = externalSetPaymentStatusFilter || setInternalPaymentStatusFilter
	const agencyFilter =
		externalAgencyFilter !== undefined ? externalAgencyFilter : internalAgencyFilter
	const setAgencyFilter = externalSetAgencyFilter || setInternalAgencyFilter
	const setSearchFilter = externalSetSearchFilter || (() => {})

	const agencies = useMemo(
		() =>
			Array.from(
				new Set((data as TransferWithDetails[]).map((transfer) => transfer.agency.name))
			).sort(),
		[data]
	)

	useEffect(() => {
		const currentSearch = externalSearchFilter ?? ""
		if (debouncedSearchTerm !== currentSearch) {
			setSearchFilter(debouncedSearchTerm)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [debouncedSearchTerm])

	const pageCount = Math.ceil(totalRecords / pagination.pageSize)

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		manualPagination: true,
		manualSorting: true,
		pageCount,
		onPaginationChange: (updater) => {
			const next = typeof updater === "function" ? updater(pagination) : updater
			onPaginationChange(next)
		},
		onSortingChange: (updater) => {
			const next = typeof updater === "function" ? updater(sorting) : updater
			onSortingChange(next)
		},
		onColumnFiltersChange: setColumnFilters,
		state: {
			sorting,
			columnFilters,
			pagination,
		},
	})

	const handleClearFilters = () => {
		setDateFilter(undefined)
		setPaymentStatusFilter("all")
		setAgencyFilter("")
		setSearchTerm("")
	}

	const hasActiveFilters =
		dateFilter?.from !== undefined ||
		paymentStatusFilter !== "all" ||
		(agencyFilter && agencyFilter.length > 0 && agencyFilter !== "all") ||
		searchTerm.length > 0

	const filterGroups = [
		{
			key: "agency",
			label: "Agencia",
			value: agencyFilter || "all",
			allLabel: "Todas las agencias",
			options: agencies.map((agency) => ({ label: agency, value: agency })),
			onChange: (value: string) => setAgencyFilter(value === "all" ? "" : value),
		},
		{
			key: "paymentStatus",
			label: "Estado de pago",
			value: paymentStatusFilter || "all",
			allLabel: "Todos los estados",
			options: QUICK_PAYMENT_STATUS_FILTERS.map((status) => ({
				label: status.label,
				value: status.value,
			})),
			onChange: (value: string) => setPaymentStatusFilter(value),
		},
	]

	return (
		<>
			<CardHeader className="flex items-start justify-between">
				<div className="space-y-1">
					<CardTitle>Historial de Traspasos</CardTitle>
					<CardDescription>
						Lista completa de todos los traspasos ({totalRecords} registros)
					</CardDescription>
				</div>

				<div className="relative md:w-[300px] lg:w-[420px]">
					<Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
					<Input
						className="bg-background w-full pl-8"
						placeholder="Buscar por agencia, pasajero o voucher..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
				</div>
			</CardHeader>

			<CardContent>
				<div className="space-y-8">
					<div className="space-y-3">
						<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
							<div className="flex items-center gap-3">
								<TableFilterDropdown
									groups={filterGroups}
									onClearAll={() => {
										setAgencyFilter("")
										setPaymentStatusFilter("all")
									}}
								/>

								{onShowCancelledChange && (
									<div className="flex items-center gap-2">
										<Switch
											id="show-cancelled-transfers"
											checked={showCancelled}
											onCheckedChange={onShowCancelledChange}
										/>
										<Label
											htmlFor="show-cancelled-transfers"
											className="text-muted-foreground cursor-pointer text-sm"
										>
											Mostrar cancelados
										</Label>
									</div>
								)}
							</div>

							<div className="flex flex-wrap items-center gap-2">
								<Popover>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											className={cn(
												"w-full justify-start text-left font-normal sm:w-[290px]",
												!dateFilter?.from && "text-muted-foreground"
											)}
										>
											<CalendarIcon className="h-4 w-4" />
											{dateFilter?.from && dateFilter?.to ? (
												<>
													{format(dateFilter.from, "dd/MM/yyyy", { locale: es })} -{" "}
													{format(dateFilter.to, "dd/MM/yyyy", { locale: es })}
												</>
											) : dateFilter?.from ? (
												format(dateFilter.from, "dd/MM/yyyy", { locale: es })
											) : (
												"Seleccionar rango"
											)}
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-auto p-0" align="end">
										<Calendar
											mode="range"
											selected={dateFilter}
											onSelect={setDateFilter}
											numberOfMonths={2}
											initialFocus
											locale={es}
										/>
									</PopoverContent>
								</Popover>

								{hasActiveFilters ? (
									<Button variant="outline" onClick={handleClearFilters} className="gap-2">
										<FilterXIcon className="h-4 w-4" />
										Limpiar filtros
									</Button>
								) : null}
							</div>
						</div>
					</div>

					<DataGrid
						table={table}
						recordCount={totalRecords}
						isLoading={isLoading}
						emptyMessage="No se encontraron traspasos."
						onRowClick={onRowClick}
						tableLayout={{ columnsResizable: true, headerSticky: true }}
					>
						<DataGridContainer>
							<DataGridTable />
						</DataGridContainer>
						<DataGridPagination rowsPerPageLabel="Filas por página" info="{from} - {to} de {count}" />
					</DataGrid>
				</div>
			</CardContent>
		</>
	)
}
