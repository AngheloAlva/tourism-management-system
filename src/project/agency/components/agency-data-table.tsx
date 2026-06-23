"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, FilterXIcon, Building2 } from "lucide-react"
import { useDebounce } from "@/shared/hooks/use-debounce"
import {
	type ColumnDef,
	type ColumnFiltersState,
	type SortingState,
	type VisibilityState,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table"
import { DataGrid, DataGridContainer } from "@/shared/components/data-grid/data-grid"
import { DataGridTable } from "@/shared/components/data-grid/data-grid-table"
import { DataGridPagination } from "@/shared/components/data-grid/data-grid-pagination"
import { TableFilterDropdown } from "@/shared/components/ui/table-filter-dropdown"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { EmptyState } from "@/shared/components/empty-state"
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type AgencyFilterable = {
	active?: boolean
	country?: string | null
}

interface DataTableProps<TData extends object, TValue> {
	columns: ColumnDef<TData, TValue>[]
	data: TData[]
}

export function AgencyDataTable<TData extends object, TValue>({ columns, data }: DataTableProps<TData, TValue>) {
	const [sorting, setSorting] = useState<SortingState>([])
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
	const [nameInput, setNameInput] = useState("")
	const [statusFilter, setStatusFilter] = useState("all")
	const [countryFilter, setCountryFilter] = useState("all")
	const debouncedName = useDebounce(nameInput, 400)

	const countries = useMemo(
		() =>
			Array.from(
				new Set(
					(data as AgencyFilterable[])
						.map((agency) => agency.country?.trim())
						.filter((country): country is string => Boolean(country))
				)
			).sort((a, b) => a.localeCompare(b, "es-CL")),
		[data]
	)

	const filteredData = useMemo(
		() =>
			(data as AgencyFilterable[]).filter((agency) => {
				if (statusFilter === "active" && !agency.active) return false
				if (statusFilter === "inactive" && agency.active) return false

				if (countryFilter !== "all" && (agency.country || "") !== countryFilter) {
					return false
				}

				return true
			}),
		[data, statusFilter, countryFilter]
	)

	const table = useReactTable({
		data: filteredData as TData[],
		columns,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		onSortingChange: setSorting,
		getSortedRowModel: getSortedRowModel(),
		onColumnFiltersChange: setColumnFilters,
		getFilteredRowModel: getFilteredRowModel(),
		onColumnVisibilityChange: setColumnVisibility,
		state: {
			sorting,
			columnFilters,
			columnVisibility,
		},
	})

	useEffect(() => {
		table.getColumn("name")?.setFilterValue(debouncedName)
	}, [debouncedName, table])

	const hasActiveFilters =
		statusFilter !== "all" || countryFilter !== "all" || debouncedName.trim().length > 0

	const filterGroups = [
		{
			key: "status",
			label: "Estado",
			value: statusFilter,
			allLabel: "Todos los estados",
			options: [
				{ value: "active", label: "Activas" },
				{ value: "inactive", label: "Inactivas" },
			],
			onChange: (value: string) => setStatusFilter(value),
		},
		{
			key: "country",
			label: "Pais",
			value: countryFilter,
			allLabel: "Todos los paises",
			options: countries.map((country) => ({ value: country, label: country })),
			onChange: (value: string) => setCountryFilter(value),
		},
	]

	const clearFilters = () => {
		setStatusFilter("all")
		setCountryFilter("all")
		setNameInput("")
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				<div className="relative w-full lg:max-w-sm">
					<Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
					<Input
						placeholder="Buscar por nombre..."
						value={nameInput}
						onChange={(event) => setNameInput(event.target.value)}
						className="w-full pl-8"
					/>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<TableFilterDropdown groups={filterGroups} onClearAll={clearFilters} />

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline">Columnas</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{table
								.getAllColumns()
								.filter((column) => column.getCanHide())
								.map((column) => (
									<DropdownMenuCheckboxItem
										key={column.id}
										className="capitalize"
										checked={column.getIsVisible()}
										onCheckedChange={(value) => column.toggleVisibility(!!value)}
									>
										{column.id}
									</DropdownMenuCheckboxItem>
								))}
						</DropdownMenuContent>
					</DropdownMenu>

					<Button
						variant="outline"
						onClick={clearFilters}
						className={cn("gap-2", !hasActiveFilters && "hidden")}
					>
						<FilterXIcon className="h-4 w-4" />
						Limpiar filtros
					</Button>
				</div>
			</div>

			<DataGrid
				table={table}
				recordCount={table.getFilteredRowModel().rows.length}
				emptyMessage={
					data.length === 0 ? (
						<EmptyState
							icon={Building2}
							title="Todavía no hay mayoristas cargados"
							description="Los mayoristas son empresas externas que compran tours a TurismoChileTours. Creá el primero para empezar a facturarles."
						/>
					) : hasActiveFilters ? (
						<EmptyState
							title="No se encontraron resultados"
							description="Probá limpiar los filtros para ver todos los mayoristas."
							action={
								<Button variant="outline" size="sm" onClick={clearFilters}>
									<FilterXIcon className="h-4 w-4" />
									Limpiar filtros
								</Button>
							}
						/>
					) : (
						<EmptyState title="No se encontraron resultados" />
					)
				}
				tableLayout={{ columnsResizable: true, headerSticky: true }}
			>
				<DataGridContainer>
					<DataGridTable />
				</DataGridContainer>
				<DataGridPagination rowsPerPageLabel="Filas por página" info="{from} - {to} de {count}" />
			</DataGrid>
		</div>
	)
}
