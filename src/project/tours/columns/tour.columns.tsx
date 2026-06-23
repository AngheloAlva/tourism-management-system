"use client"

import { MoreHorizontal, Pencil, Trash2, Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import { DataGridColumnHeader } from "@/shared/components/data-grid/data-grid-column-header"
import {
	DropdownMenu,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuSeparator,
} from "@/shared/components/ui/dropdown-menu"

import type { ColumnDef } from "@tanstack/react-table"
import type { Tour } from "@/generated/prisma/client"

export interface TourWithRelations extends Tour {
	priceCategories?: Array<{ entries?: Array<unknown> }>
	privatePriceTiers?: Array<unknown>
}

interface TourColumnsProps {
	onEdit: (tour: Tour) => void
	onDelete: (id: string) => void
	onToggleStatus: (id: string, active: boolean) => void
}

export const createTourColumns = ({
	onEdit,
	onDelete,
	onToggleStatus,
}: TourColumnsProps): ColumnDef<TourWithRelations>[] => [
	{
		accessorKey: "name",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Nombre" />,
		cell: ({ row }) => {
			const tour = row.original
			return (
				<div className="flex flex-col">
					<span className="font-medium">{tour.name}</span>
					{tour.description && (
						<span className="text-muted-foreground line-clamp-1 max-w-72 truncate text-xs">
							{tour.description}
						</span>
					)}
				</div>
			)
		},
	},
	{
		accessorKey: "maxCapacity",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Capacidad" />,
		cell: ({ row }) => {
			return <span className="text-sm">{row.original.maxCapacity}</span>
		},
	},
	{
		accessorKey: "startTime",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Horario" />,
		cell: ({ row }) => {
			const { startTime, endTime } = row.original
			if (!startTime && !endTime) return <span className="text-muted-foreground">-</span>
			return (
				<span className="text-sm">
					{startTime || "?"} - {endTime || "?"}
				</span>
			)
		},
	},
	{
		id: "priceCategories",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Categorías" />,
		cell: ({ row }) => {
			const tour = row.original
			const count = tour.priceCategories?.length ?? 0
			return (
				<span className={cn("text-sm", count === 0 && "text-muted-foreground")}>
					{count}
				</span>
			)
		},
	},
	{
		id: "entries",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Entradas" />,
		cell: ({ row }) => {
			const tour = row.original
			const count = tour.priceCategories?.reduce(
				(sum, cat) => sum + (cat.entries?.length ?? 0),
				0
			) ?? 0
			return (
				<span className={cn("text-sm", count === 0 && "text-muted-foreground")}>
					{count}
				</span>
			)
		},
	},
	{
		id: "privateTiers",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Tiers privados" />,
		cell: ({ row }) => {
			const tour = row.original
			const count = tour.privatePriceTiers?.length ?? 0
			return (
				<span className={cn("text-sm", count === 0 && "text-muted-foreground")}>
					{count}
				</span>
			)
		},
	},
	{
		accessorKey: "active",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Estado" />,
		cell: ({ row }) => {
			const active = row.original.active
			return active ? (
				<Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-200">Activo</Badge>
			) : (
				<Badge variant="secondary">Inactivo</Badge>
			)
		},
	},
	{
		id: "actions",
		cell: ({ row }) => {
			const tour = row.original

			return (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className="h-8 w-8 p-0">
							<span className="sr-only">Abrir menu</span>
							<MoreHorizontal className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuLabel>Acciones</DropdownMenuLabel>
						<DropdownMenuItem onClick={() => onEdit(tour)}>
							<Pencil className="h-4 w-4" />
							Editar
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => onToggleStatus(tour.id, !tour.active)}>
							{tour.active ? (
								<>
									<EyeOff className="h-4 w-4" />
									Desactivar
								</>
							) : (
								<>
									<Eye className="h-4 w-4" />
									Activar
								</>
							)}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={() => onDelete(tour.id)} className="text-destructive">
							<Trash2 className="h-4 w-4" />
							Eliminar
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)
		},
	},
]
