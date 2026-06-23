"use client"

import { useState, useEffect, useMemo } from "react"
import { useDebounce } from "@/shared/hooks/use-debounce"
import {
	type ColumnDef,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	type ColumnFiltersState,
	useReactTable,
} from "@tanstack/react-table"
import { FilterXIcon, MapPinned, Search } from "lucide-react"

import { cn } from "@/lib/utils"

import { DataGrid, DataGridContainer } from "@/shared/components/data-grid/data-grid"
import { DataGridTable } from "@/shared/components/data-grid/data-grid-table"
import { DataGridPagination } from "@/shared/components/data-grid/data-grid-pagination"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { TableFilterDropdown } from "@/shared/components/ui/table-filter-dropdown"
import { EmptyState } from "@/shared/components/empty-state"

import type { TourWithRelations } from "@/project/tours/columns/tour.columns"

interface TourTableRow extends TourWithRelations {
	privatePricing?: Array<{ capacity: number; price: number }>
}

interface ToursDataTableProps {
	columns: ColumnDef<TourWithRelations>[]
	data: TourTableRow[]
}

export function ToursDataTable({ columns, data }: ToursDataTableProps) {
	const [sorting, setSorting] = useState<SortingState>([])
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [nameInput, setNameInput] = useState("")
	const [statusFilter, setStatusFilter] = useState("all")
	const [privatePricingFilter, setPrivatePricingFilter] = useState("all")
	const [priceCategoriesFilter, setPriceCategoriesFilter] = useState("all")
	const debouncedName = useDebounce(nameInput, 400)

	const rows = data as TourTableRow[]

	const filteredData = useMemo(
		() =>
			rows.filter((tour) => {
				if (statusFilter === "active" && !tour.active) return false
				if (statusFilter === "inactive" && tour.active) return false

				const privateTierCount = tour.privatePriceTiers?.length ?? tour.privatePricing?.length ?? 0
				if (privatePricingFilter === "withPrivate" && privateTierCount === 0) return false
				if (privatePricingFilter === "withoutPrivate" && privateTierCount > 0) return false

				const priceCategoryCount = tour.priceCategories?.length ?? 0
				if (priceCategoriesFilter === "withCategories" && priceCategoryCount === 0) return false
				if (priceCategoriesFilter === "withoutCategories" && priceCategoryCount > 0) return false

				return true
			}),
		[rows, statusFilter, privatePricingFilter, priceCategoriesFilter]
	)

	const filterGroups = [
		{
			key: "status",
			label: "Estado",
			value: statusFilter,
			allLabel: "Todos los estados",
			options: [
				{ value: "active", label: "Activos" },
				{ value: "inactive", label: "Inactivos" },
			],
			onChange: (nextValue: string) => setStatusFilter(nextValue),
		},
		{
			key: "privatePricing",
			label: "Precios privados",
			value: privatePricingFilter,
			allLabel: "Todos",
			options: [
				{ value: "withPrivate", label: "Con tiers" },
				{ value: "withoutPrivate", label: "Sin tiers" },
			],
			onChange: (nextValue: string) => setPrivatePricingFilter(nextValue),
		},
		{
			key: "priceCategories",
			label: "Categorías de precio",
			value: priceCategoriesFilter,
			allLabel: "Todos",
			options: [
				{ value: "withCategories", label: "Con categorías" },
				{ value: "withoutCategories", label: "Sin categorías" },
			],
			onChange: (nextValue: string) => setPriceCategoriesFilter(nextValue),
		},
	]

	const clearFilters = () => {
		setStatusFilter("all")
		setPrivatePricingFilter("all")
		setPriceCategoriesFilter("all")
		setNameInput("")
	}

	const hasActiveFilters =
		statusFilter !== "all" ||
		privatePricingFilter !== "all" ||
		priceCategoriesFilter !== "all" ||
		nameInput.trim().length > 0

	// Apply debounced filter
	useEffect(() => {
		table.getColumn("name")?.setFilterValue(debouncedName)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [debouncedName])

	const table = useReactTable({
		data: filteredData,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		state: {
			sorting,
			columnFilters,
		},
		initialState: {
			pagination: {
				pageSize: 15,
			},
		},
	})

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				<div className="relative w-full lg:max-w-sm">
					<Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
					<Input
						placeholder="Buscar tours..."
						value={nameInput}
						onChange={(event) => setNameInput(event.target.value)}
						className="w-full pl-8"
					/>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<TableFilterDropdown groups={filterGroups} onClearAll={clearFilters} />
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
							icon={MapPinned}
							title="Todavía no hay tours cargados"
							description="Los tours son el catálogo de servicios que vas a vender. Creá el primero para poder asignarlo en ventas, eventos y traspasos."
						/>
					) : hasActiveFilters ? (
						<EmptyState
							title="No se encontraron tours"
							description="Probá limpiar los filtros para ver todo el catálogo."
							action={
								<Button variant="outline" size="sm" onClick={clearFilters}>
									<FilterXIcon className="h-4 w-4" />
									Limpiar filtros
								</Button>
							}
						/>
					) : (
						<EmptyState title="No se encontraron tours" />
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
