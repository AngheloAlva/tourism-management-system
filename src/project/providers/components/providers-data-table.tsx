"use client"

import { FilterXIcon, Search, Users } from "lucide-react"
import { useMemo, useState } from "react"
import {
	useReactTable,
	getCoreRowModel,
	getSortedRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	type ColumnDef,
	type SortingState,
	type ColumnFiltersState,
} from "@tanstack/react-table"

import { useDebounce } from "@/shared/hooks/use-debounce"
import { cn } from "@/lib/utils"

import { DataGrid, DataGridContainer } from "@/shared/components/data-grid/data-grid"
import { DataGridTable } from "@/shared/components/data-grid/data-grid-table"
import { DataGridPagination } from "@/shared/components/data-grid/data-grid-pagination"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { TableFilterDropdown } from "@/shared/components/ui/table-filter-dropdown"
import { EmptyState } from "@/shared/components/empty-state"

interface ProvidersDataTableProps<TData extends object, TValue> {
	columns: ColumnDef<TData, TValue>[]
	data: TData[]
}

type ProviderFilterable = {
	rut: string
	type: "NATURAL" | "JURIDICA"
	isActive: boolean
	fullName: string | null
	companyName: string | null
	guia: boolean
	conductor: boolean
	conductorMaquina: boolean
	maquina: boolean
	transferIn: boolean
	transferOut: boolean
	cocteleria: boolean
	otros: boolean
}

const SERVICE_OPTIONS = [
	{ value: "guia", label: "Guía" },
	{ value: "conductor", label: "Conductor" },
	{ value: "maquina", label: "Máquina" },
	{ value: "transferIn", label: "Transfer In" },
	{ value: "transferOut", label: "Transfer Out" },
	{ value: "cocteleria", label: "Coctelería" },
	{ value: "otros", label: "Otros" },
] as const

export function ProvidersDataTable<TData extends object, TValue>({
	columns,
	data,
}: ProvidersDataTableProps<TData, TValue>) {
	const [sorting, setSorting] = useState<SortingState>([])
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [searchInput, setSearchInput] = useState("")
	const [statusFilter, setStatusFilter] = useState("all")
	const [personTypeFilter, setPersonTypeFilter] = useState("all")
	const [serviceFilter, setServiceFilter] = useState("all")
	const debouncedSearch = useDebounce(searchInput, 400)

	const filteredData = useMemo(
		() =>
			(data as ProviderFilterable[]).filter((provider) => {
				if (statusFilter === "active" && !provider.isActive) return false
				if (statusFilter === "inactive" && provider.isActive) return false

				if (personTypeFilter !== "all" && provider.type !== personTypeFilter) {
					return false
				}

				if (serviceFilter !== "all") {
					const hasService =
						(serviceFilter === "guia" && provider.guia) ||
						(serviceFilter === "conductor" && (provider.conductor || provider.conductorMaquina)) ||
						(serviceFilter === "maquina" && (provider.maquina || provider.conductorMaquina)) ||
						(serviceFilter === "transferIn" && provider.transferIn) ||
						(serviceFilter === "transferOut" && provider.transferOut) ||
						(serviceFilter === "cocteleria" && provider.cocteleria) ||
						(serviceFilter === "otros" && provider.otros)

					if (!hasService) return false
				}

				if (debouncedSearch.trim()) {
					const normalizedSearch = debouncedSearch.toLowerCase().trim()
					const providerName = provider.fullName || provider.companyName || ""
					if (
						!provider.rut.toLowerCase().includes(normalizedSearch) &&
						!providerName.toLowerCase().includes(normalizedSearch)
					) {
						return false
					}
				}

				return true
			}),
		[data, statusFilter, personTypeFilter, serviceFilter, debouncedSearch]
	)

	// eslint-disable-next-line react-hooks/incompatible-library
	const table = useReactTable({
		data: filteredData as TData[],
		columns,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		onSortingChange: setSorting,
		getSortedRowModel: getSortedRowModel(),
		onColumnFiltersChange: setColumnFilters,
		getFilteredRowModel: getFilteredRowModel(),
		state: {
			sorting,
			columnFilters,
		},
	})

	const hasActiveFilters =
		statusFilter !== "all" ||
		personTypeFilter !== "all" ||
		serviceFilter !== "all" ||
		searchInput.trim().length > 0

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
			key: "personType",
			label: "Tipo",
			value: personTypeFilter,
			allLabel: "Todos los tipos",
			options: [
				{ value: "NATURAL", label: "Persona Natural" },
				{ value: "JURIDICA", label: "Persona Jurídica" },
			],
			onChange: (nextValue: string) => setPersonTypeFilter(nextValue),
		},
		{
			key: "service",
			label: "Servicio",
			value: serviceFilter,
			allLabel: "Todos los servicios",
			options: [...SERVICE_OPTIONS],
			onChange: (nextValue: string) => setServiceFilter(nextValue),
		},
	]

	const clearFilters = () => {
		setStatusFilter("all")
		setPersonTypeFilter("all")
		setServiceFilter("all")
		setSearchInput("")
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				<div className="relative w-full lg:max-w-sm">
					<Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
					<Input
						placeholder="Buscar por RUT o nombre..."
						value={searchInput}
						onChange={(event) => setSearchInput(event.target.value)}
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
							icon={Users}
							title="Todavía no hay proveedores cargados"
							description="Los proveedores son guías, conductores y vehículos que vas a asignar a tus eventos. Creá el primero para empezar."
						/>
					) : hasActiveFilters ? (
						<EmptyState
							title="No se encontraron resultados"
							description="Probá limpiar los filtros para ver todos los proveedores."
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
