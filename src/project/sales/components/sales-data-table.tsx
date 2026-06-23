"use client"

import { FilterXIcon, Search, CalendarIcon } from "lucide-react"
import { useState, useEffect } from "react"
import { es } from "date-fns/locale"
import { format } from "date-fns"
import {
	useReactTable,
	getCoreRowModel,
	getFilteredRowModel,
} from "@tanstack/react-table"
import type { PaginationState } from "@tanstack/react-table"

import { useUsers } from "@/project/users/hooks/use-users"
import { useActiveAgencies } from "@/project/agency/hooks/use-agencies"
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
import type { SaleRecordFilters, SaleRecordWithDetails } from "../actions/sale-record.actions"
import type { ColumnDef, SortingState, ColumnFiltersState } from "@tanstack/react-table"

const QUICK_CHANNEL_FILTERS = [
	{ value: "ONLINE", label: "Online" },
	{ value: "AGENCY", label: "Agencia" },
	{ value: "PHYSICAL", label: "Fisico" },
	{ value: "WHOLESALE", label: "Mayorista" },
] as const

const QUICK_STATUS_FILTERS = [
	{ value: "TO_BE_DONE", label: "Por Hacer" },
	{ value: "IN_PROGRESS", label: "En Progreso" },
	{ value: "COMPLETED", label: "Completado" },
] as const

interface DataTableProps<TData extends object, TValue> {
	columns: ColumnDef<TData, TValue>[]
	data: TData[]
	filters?: SaleRecordFilters
	onFiltersChange?: (filters: SaleRecordFilters) => void
	isLoading?: boolean
	onRowClick?: (row: TData) => void
	historyTitle: string
	historyDescription: string
	totalRecords: number
	pagination: PaginationState
	onPaginationChange: (pagination: PaginationState) => void
	sorting: SortingState
	onSortingChange: (sorting: SortingState) => void
}

export function SalesDataTable<TData extends object, TValue>({
	data,
	filters,
	columns,
	onRowClick,
	historyTitle,
	onFiltersChange,
	isLoading = false,
	historyDescription,
	totalRecords,
	pagination,
	onPaginationChange,
	sorting,
	onSortingChange,
}: DataTableProps<TData, TValue>) {
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [searchTerm, setSearchTerm] = useState("")
	const debouncedSearchTerm = useDebounce(searchTerm, 400)

	const { data: usersData } = useUsers()
	const { data: agenciesData } = useActiveAgencies()

	// Sync debounced search to server-side filters
	useEffect(() => {
		const currentSearch = filters?.search ?? ""
		if (debouncedSearchTerm !== currentSearch) {
			onFiltersChange?.({
				...filters,
				search: debouncedSearchTerm || undefined,
			})
			onPaginationChange({ ...pagination, pageIndex: 0 })
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

	const hasActiveFilters = !!(
		filters?.channel ||
		filters?.sellerId ||
		filters?.wholesaleAgencyId ||
		filters?.status ||
		filters?.startDate ||
		filters?.endDate ||
		searchTerm
	)

	const clearFilters = () => {
		setSearchTerm("")
		onFiltersChange?.({ type: filters?.type })
	}

	const handleDateRangeChange = (range: { from?: Date; to?: Date } | undefined) => {
		onFiltersChange?.({
			...filters,
			startDate: range?.from,
			endDate: range?.to,
		})
	}

	const handleFilterChange = (key: keyof SaleRecordFilters, value: string | undefined) => {
		onFiltersChange?.({
			...filters,
			[key]: value === "all" || !value ? undefined : value,
		})
	}

	const filterGroups = [
		{
			key: "channel",
			label: "Canal",
			value: filters?.channel ?? "all",
			allLabel: "Todos los canales",
			options: QUICK_CHANNEL_FILTERS.map((channel) => ({
				label: channel.label,
				value: channel.value,
			})),
			onChange: (value: string) => handleFilterChange("channel", value),
		},
		{
			key: "sellerId",
			label: "Vendedor",
			value: filters?.sellerId ?? "all",
			allLabel: "Todos los vendedores",
			options: (usersData || []).map((user) => ({ label: user.name, value: user.id })),
			onChange: (value: string) => handleFilterChange("sellerId", value),
		},
		{
			key: "wholesaleAgencyId",
			label: "Agencia Mayorista",
			value: filters?.wholesaleAgencyId ?? "all",
			allLabel: "Todas las mayoristas",
			options: (agenciesData || []).map((agency) => ({ label: agency.name, value: agency.id })),
			onChange: (value: string) => handleFilterChange("wholesaleAgencyId", value),
		},
		{
			key: "status",
			label: "Estado",
			value: filters?.status ?? "all",
			allLabel: "Todos los estados",
			options: QUICK_STATUS_FILTERS.map((status) => ({
				label: status.label,
				value: status.value,
			})),
			onChange: (value: string) => handleFilterChange("status", value),
		},
	]

	return (
		<>
			<CardHeader className="flex items-start justify-between">
				<div className="space-y-1">
					<CardTitle>{historyTitle}</CardTitle>
					<CardDescription>
						{historyDescription} ({totalRecords} registros)
					</CardDescription>
				</div>

				<div className="relative md:w-[300px] lg:w-[420px]">
					<Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
					<Input
						placeholder="Buscar por voucher, file, agencia, pasajero o vendedor..."
						value={searchTerm}
						onChange={(event) => setSearchTerm(event.target.value)}
						className="w-full pl-8"
					/>
				</div>
			</CardHeader>

			<CardContent className="min-w-0">
				<div className="min-w-0 space-y-8">
					<div className="space-y-3">
						<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
							<TableFilterDropdown
								groups={filterGroups}
								onClearAll={() => {
									handleFilterChange("channel", "all")
									handleFilterChange("sellerId", "all")
									handleFilterChange("wholesaleAgencyId", "all")
									handleFilterChange("status", "all")
								}}
							/>

							<div className="flex flex-wrap items-center gap-2">
								<Popover>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											className={cn(
												"w-full justify-start text-left font-normal sm:w-[290px]",
												!filters?.startDate && !filters?.endDate && "text-muted-foreground"
											)}
										>
											<CalendarIcon className="h-4 w-4" />
											{filters?.startDate && filters?.endDate ? (
												<>
													{format(filters.startDate, "dd/MM/yyyy", { locale: es })} -{" "}
													{format(filters.endDate, "dd/MM/yyyy", { locale: es })}
												</>
											) : filters?.startDate ? (
												format(filters.startDate, "dd/MM/yyyy", { locale: es })
											) : (
												"Seleccionar fechas"
											)}
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-auto p-0" align="end">
										<Calendar
											mode="range"
											selected={{
												from: filters?.startDate,
												to: filters?.endDate,
											}}
											numberOfMonths={2}
											onSelect={handleDateRangeChange}
										/>
									</PopoverContent>
								</Popover>

								{hasActiveFilters ? (
									<Button variant="outline" onClick={clearFilters} className="gap-2">
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
						emptyMessage="No se encontraron resultados."
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
