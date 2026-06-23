"use client"

import { CalendarIcon, FilterXIcon, Search } from "lucide-react"
import { format } from "date-fns"
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

import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover"
import { Calendar } from "@/shared/components/ui/calendar"
import { TableFilterDropdown } from "@/shared/components/ui/table-filter-dropdown"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { DataGrid, DataGridContainer } from "@/shared/components/data-grid/data-grid"
import { DataGridTable } from "@/shared/components/data-grid/data-grid-table"
import { DataGridPagination } from "@/shared/components/data-grid/data-grid-pagination"
import type { ReceptionWithDetails, ReceptionFilters } from "../../actions/reception.actions"
import type { ColumnDef, SortingState, ColumnFiltersState } from "@tanstack/react-table"
import { CardDescription, CardTitle } from "@/shared/components/ui/card"
import { ScrollArea } from "@/shared/components/ui/scroll-area"
import { Switch } from "@/shared/components/ui/switch"
import { Label } from "@/shared/components/ui/label"

const QUICK_PAYMENT_STATUS_FILTERS = [
	{ value: "PENDING", label: "Pendiente" },
	{ value: "ENTRANCE_ONLY", label: "Solo Entradas" },
	{ value: "TOUR_ONLY", label: "Solo Tour" },
	{ value: "FULLY_PAID", label: "Pagado" },
] as const

interface ReceptionDataTableProps<TData extends object, TValue> {
	columns: ColumnDef<TData, TValue>[]
	data: TData[]
	filters?: ReceptionFilters
	onFiltersChange?: (filters: ReceptionFilters) => void
	isLoading?: boolean
	onRowClick?: (row: TData) => void
	totalRecords: number
	pagination: PaginationState
	onPaginationChange: (pagination: PaginationState) => void
	sorting: SortingState
	onSortingChange: (sorting: SortingState) => void
}

export function ReceptionDataTable<TData extends object, TValue>({
	columns,
	data,
	filters,
	onFiltersChange,
	isLoading = false,
	onRowClick,
	totalRecords,
	pagination,
	onPaginationChange,
	sorting,
	onSortingChange,
}: ReceptionDataTableProps<TData, TValue>) {
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [searchTerm, setSearchTerm] = useState<string>("")
	const debouncedSearchTerm = useDebounce(searchTerm, 400)

	const agencies = useMemo(
		() =>
			Array.from(
				new Set((data as ReceptionWithDetails[]).map((reception) => reception.agency.name))
			).sort(),
		[data]
	)

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
		filters?.paymentStatus ||
		filters?.agencyName ||
		filters?.startDate ||
		filters?.endDate ||
		searchTerm
	)

	const clearFilters = () => {
		setSearchTerm("")
		onFiltersChange?.({})
	}

	const handleDateRangeChange = (range: { from?: Date; to?: Date } | undefined) => {
		onFiltersChange?.({
			...filters,
			startDate: range?.from,
			endDate: range?.to,
		})
	}

	const handleFilterChange = (key: keyof ReceptionFilters, value: string | undefined) => {
		onFiltersChange?.({
			...filters,
			[key]: value === "all" || !value ? undefined : value,
		})
	}

	const filterGroups = [
		{
			key: "agency",
			label: "Agencia",
			value: filters?.agencyName ?? "all",
			allLabel: "Todas las agencias",
			options: agencies.map((agency) => ({ label: agency, value: agency })),
			onChange: (value: string) => handleFilterChange("agencyName", value),
		},
		{
			key: "paymentStatus",
			label: "Estado de pago",
			value: filters?.paymentStatus ?? "all",
			allLabel: "Todos los estados",
			options: QUICK_PAYMENT_STATUS_FILTERS.map((status) => ({
				label: status.label,
				value: status.value,
			})),
			onChange: (value: string) => handleFilterChange("paymentStatus", value),
		},
	]

	return (
		<div className="space-y-4">
			<div className="flex items-start justify-between">
				<div className="space-y-1">
					<CardTitle>Historial de Recepciones</CardTitle>
					<CardDescription>
						Lista completa de todas las recepciones ({totalRecords} registros)
					</CardDescription>
				</div>

				<div className="relative md:w-[200px] lg:w-[350px]">
					<Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
					<Input
						className="bg-background w-full pl-8"
						placeholder="Buscar por agencia, pasajero o voucher..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
				</div>
			</div>

			<div className="space-y-4">
				<div className="space-y-3">
					<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
						<div className="flex items-center gap-3">
							<TableFilterDropdown
								groups={filterGroups}
								onClearAll={() => {
									handleFilterChange("agencyName", "all")
									handleFilterChange("paymentStatus", "all")
								}}
							/>

							<div className="flex items-center gap-2">
								<Switch
									id="show-cancelled-receptions"
									checked={!!filters?.showCancelled}
									onCheckedChange={(checked) =>
										onFiltersChange?.({ ...filters, showCancelled: checked || undefined })
									}
								/>
								<Label
									htmlFor="show-cancelled-receptions"
									className="text-muted-foreground cursor-pointer text-sm"
								>
									Mostrar cancelados
								</Label>
							</div>
						</div>

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
											"Seleccionar rango"
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
										onSelect={handleDateRangeChange}
										numberOfMonths={2}
										locale={es}
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
					emptyMessage="No se encontraron recepciones."
					onRowClick={onRowClick}
					tableLayout={{ columnsResizable: true, headerSticky: true }}
				>
					<DataGridContainer>
						<DataGridTable />
					</DataGridContainer>
					<DataGridPagination rowsPerPageLabel="Filas por página" info="{from} - {to} de {count}" />
				</DataGrid>
			</div>
		</div>
	)
}
