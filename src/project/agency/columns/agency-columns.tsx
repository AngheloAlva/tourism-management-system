"use client"

import { CircleCheckIcon, CircleXIcon, MoreHorizontal, Pencil, Power, Trash2 } from "lucide-react"
import { es } from "date-fns/locale"
import { format } from "date-fns"

import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import { DataGridColumnHeader } from "@/shared/components/data-grid/data-grid-column-header"
import {
	DropdownMenu,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuContent,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
} from "@/shared/components/ui/dropdown-menu"

import type { ColumnDef } from "@tanstack/react-table"
import type { Agency } from "../types/agency"

export const agencyColumns: ColumnDef<Agency>[] = [
	{
		accessorKey: "name",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Nombre" />,
		cell: ({ row }) => {
			const name = row.getValue("name") as string
			const codePrefix = row.original.codePrefix
			return (
				<div className="flex flex-col">
					<span className="font-medium">{name}</span>
					{codePrefix && (
						<span className="text-muted-foreground text-xs">
							Prefijo: <span className="text-primary">{codePrefix}</span>
						</span>
					)}
				</div>
			)
		},
	},
	{
		accessorKey: "contactEmails",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Correos de Contacto" />,
		cell: ({ row }) => {
			const emails = row.getValue("contactEmails") as string[]
			return (
				<div className="flex flex-col gap-1">
					<span className="text-muted-foreground text-sm">{emails[0]}</span>
					{emails.length > 1 && <span className="text-muted-foreground text-xs">...</span>}
				</div>
			)
		},
	},
	{
		accessorKey: "phone",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Teléfono" />,
		cell: ({ row }) => {
			const phone = row.getValue("phone") as string | null
			return <span className="text-sm">{phone || "-"}</span>
		},
	},
	{
		accessorKey: "country",
		header: ({ column }) => <DataGridColumnHeader column={column} title="País" />,
		cell: ({ row }) => {
			const country = row.getValue("country") as string | null
			return <span className="text-sm">{country || "-"}</span>
		},
	},
	{
		accessorKey: "active",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Estado" />,
		cell: ({ row }) => {
			const active = row.getValue("active") as boolean
			return (
				<Badge variant={"outline"} className="text-muted-foreground gap-1 px-1.5">
					{row.original.active ? (
						<CircleCheckIcon className="size-4 fill-green-500 text-white dark:text-neutral-900" />
					) : (
						<CircleXIcon className="size-4 fill-red-500 text-white dark:text-neutral-900" />
					)}
					{active ? "Activa" : "Inactiva"}
				</Badge>
			)
		},
	},
	{
		accessorKey: "createdAt",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Fecha de Registro" />,
		cell: ({ row }) => {
			const date = row.getValue("createdAt") as Date
			return (
				<span className="text-muted-foreground text-sm">
					{format(date, "dd MMM yyyy", { locale: es })}
				</span>
			)
		},
	},
	{
		id: "actions",
		cell: ({ row }) => {
			const agency = row.original

			return (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className="h-8 w-8 p-0">
							<span className="sr-only">Abrir menú</span>
							<MoreHorizontal className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuLabel>Acciones</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={() => {
								// Esta función se implementará en el componente padre
								const event = new CustomEvent("editAgency", { detail: agency })
								window.dispatchEvent(event)
							}}
						>
							<Pencil className="h-4 w-4" />
							Editar
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => {
								const event = new CustomEvent("toggleAgency", { detail: agency.id })
								window.dispatchEvent(event)
							}}
						>
							<Power className="h-4 w-4" />
							{agency.active ? "Desactivar" : "Activar"}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={() => {
								const event = new CustomEvent("deleteAgency", { detail: agency.id })
								window.dispatchEvent(event)
							}}
							className="text-destructive"
						>
							<Trash2 className="h-4 w-4" />
							Eliminar
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)
		},
	},
]
