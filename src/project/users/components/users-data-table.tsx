"use client"

import {
	getCoreRowModel,
	useReactTable,
	type ColumnDef,
	type SortingState,
	type PaginationState,
} from "@tanstack/react-table"
import { useEffect, useMemo, useState } from "react"
import { useDebounce } from "@/shared/hooks/use-debounce"
import { Input } from "@/shared/components/ui/input"
import { Button } from "@/shared/components/ui/button"
import { TableFilterDropdown } from "@/shared/components/ui/table-filter-dropdown"
import { DataGrid, DataGridContainer } from "@/shared/components/data-grid/data-grid"
import { DataGridTable } from "@/shared/components/data-grid/data-grid-table"
import { DataGridPagination } from "@/shared/components/data-grid/data-grid-pagination"
import { getRoleLabel } from "@/project/users/constants/roles"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/shared/components/empty-state"
import { FilterXIcon, Search, UserPlus } from "lucide-react"

interface DataTableProps<TData extends object, TValue> {
	columns: ColumnDef<TData, TValue>[]
	data: TData[]
	totalRecords: number
	pagination: PaginationState
	onPaginationChange: (pagination: PaginationState) => void
	sorting: SortingState
	onSortingChange: (sorting: SortingState) => void
	isLoading?: boolean
	onSearchChange?: (search: string) => void
}

type UserFilterable = {
	name: string
	email: string
	role: string | null
	banned: boolean
}

const USER_STATUS_FILTER = {
	ALL: "all",
	ACTIVE: "active",
	BANNED: "banned",
} as const

export function UsersDataTable<TData extends object, TValue>({
	columns,
	data,
	totalRecords,
	pagination,
	onPaginationChange,
	sorting,
	onSortingChange,
	isLoading = false,
	onSearchChange,
}: DataTableProps<TData, TValue>) {
	const [statusFilter, setStatusFilter] = useState<string>(USER_STATUS_FILTER.ALL)
	const [roleFilter, setRoleFilter] = useState<string>(USER_STATUS_FILTER.ALL)
	const [nameInput, setNameInput] = useState("")
	const debouncedName = useDebounce(nameInput, 400)

	const roleOptions = useMemo(
		() =>
			Array.from(
				new Set(
					(data as UserFilterable[])
						.map((user) => user.role)
						.filter((role): role is string => Boolean(role))
				)
			)
				.sort((a, b) => a.localeCompare(b, "es-CL"))
				.map((role) => ({ value: role, label: getRoleLabel(role) })),
		[data]
	)

	useEffect(() => {
		onSearchChange?.(debouncedName)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [debouncedName])

	const filteredData = useMemo(() => {
		return (data as UserFilterable[]).filter((user) => {
			if (statusFilter === USER_STATUS_FILTER.ACTIVE && user.banned) {
				return false
			}

			if (statusFilter === USER_STATUS_FILTER.BANNED && !user.banned) {
				return false
			}

			if (roleFilter !== USER_STATUS_FILTER.ALL && user.role !== roleFilter) {
				return false
			}

			return true
		})
	}, [data, roleFilter, statusFilter])

	const filterGroups = useMemo(
		() => [
			{
				key: "status",
				label: "Estado",
				value: statusFilter,
				allLabel: "Todos los estados",
				options: [
					{ value: USER_STATUS_FILTER.ACTIVE, label: "Activos" },
					{ value: USER_STATUS_FILTER.BANNED, label: "Baneados" },
				],
				onChange: (nextValue: string) => setStatusFilter(nextValue),
			},
			{
				key: "role",
				label: "Rol",
				value: roleFilter,
				allLabel: "Todos los roles",
				options: roleOptions,
				onChange: (nextValue: string) => setRoleFilter(nextValue),
			},
		],
		[roleFilter, roleOptions, statusFilter]
	)

	const clearFilters = () => {
		setStatusFilter(USER_STATUS_FILTER.ALL)
		setRoleFilter(USER_STATUS_FILTER.ALL)
		setNameInput("")
	}

	const hasActiveFilters =
		statusFilter !== USER_STATUS_FILTER.ALL ||
		roleFilter !== USER_STATUS_FILTER.ALL ||
		nameInput.trim().length > 0

	const pageCount = Math.ceil(totalRecords / pagination.pageSize)

	const table = useReactTable({
		data: filteredData as TData[],
		columns,
		getCoreRowModel: getCoreRowModel(),
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
		state: {
			sorting,
			pagination,
		},
	})

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				<div className="relative w-full lg:max-w-sm">
					<Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
					<Input
						placeholder="Buscar por nombre o email..."
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
				recordCount={totalRecords}
				isLoading={isLoading}
				emptyMessage={
					totalRecords === 0 && !hasActiveFilters ? (
						<EmptyState
							icon={UserPlus}
							title="Todavía no hay usuarios"
							description="Cada persona que opera el sistema necesita su propio usuario. Creá el primero para empezar."
						/>
					) : hasActiveFilters ? (
						<EmptyState
							title="No se encontraron usuarios"
							description="Probá limpiar los filtros."
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
