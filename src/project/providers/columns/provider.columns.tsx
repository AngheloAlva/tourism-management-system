"use client"

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import { Button } from "@/shared/components/ui/button"
import { Switch } from "@/shared/components/ui/switch"
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

import type { Provider } from "@/generated/prisma/client"
import type { ColumnDef } from "@tanstack/react-table"

interface CreateProviderColumnsProps {
	onEdit: (provider: Provider) => void
	onDelete: (id: string) => void
	onToggleStatus: (id: string, active: boolean) => void
}

export function createProviderColumns({
	onEdit,
	onDelete,
	onToggleStatus,
}: CreateProviderColumnsProps): ColumnDef<Provider>[] {
	return [
		{
			accessorKey: "rut",
			header: ({ column }) => <DataGridColumnHeader column={column} title="RUT" />,
			cell: ({ row }) => <div className="font-medium">{row.getValue("rut")}</div>,
		},
		{
			id: "name",
			header: ({ column }) => <DataGridColumnHeader column={column} title="Nombre/Razón Social" />,
			cell: ({ row }) => {
				const provider = row.original
				const name = provider.type === "NATURAL" ? provider.fullName : provider.companyName
				return (
					<div>
						<div className="font-medium">{name}</div>
						<div className="text-muted-foreground text-xs">
							{provider.type === "NATURAL" ? "Persona Natural" : "Persona Jurídica"}
						</div>
					</div>
				)
			},
		},
		{
			id: "services",
			header: ({ column }) => <DataGridColumnHeader column={column} title="Servicios" />,
			cell: ({ row }) => {
				const provider = row.original
				const services = []

				if (provider.guia) services.push("Guía")
				if (provider.conductor) services.push("Conductor")
				if (provider.conductorMaquina) services.push("Conductor+Máquina")
				if (provider.maquina) services.push("Máquina")
				if (provider.transferIn) services.push("Transfer In")
				if (provider.transferOut) services.push("Transfer Out")
				if (provider.cocteleria) services.push("Coctelería")
				if (provider.otros) services.push("Otros")

				return (
					<div className="flex flex-wrap gap-1">
						{services.map((service, idx) => (
							<Badge key={idx} variant="secondary" className="text-xs">
								{service}
							</Badge>
						))}
					</div>
				)
			},
		},
		{
			accessorKey: "phone",
			header: ({ column }) => <DataGridColumnHeader column={column} title="Teléfono" />,
			cell: ({ row }) => row.getValue("phone") || "-",
		},
		{
			accessorKey: "email",
			header: ({ column }) => <DataGridColumnHeader column={column} title="Email" />,
			cell: ({ row }) => row.getValue("email") || "-",
		},
		{
			id: "status",
			header: ({ column }) => <DataGridColumnHeader column={column} title="Estado" />,
			cell: ({ row }) => {
				const provider = row.original

				return (
					<div className="flex items-center gap-2">
						<Switch
							checked={provider.isActive}
							className="data-[state=checked]:bg-primary"
							onCheckedChange={(checked) => onToggleStatus(provider.id, checked)}
						/>
						<span className="text-sm">{provider.isActive ? "Activo" : "Inactivo"}</span>
					</div>
				)
			},
		},
		{
			id: "actions",
			cell: ({ row }) => {
				const provider = row.original

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
							<DropdownMenuItem onClick={() => onEdit(provider)}>
								<Pencil className="h-4 w-4" />
								Editar
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => onDelete(provider.id)}
								className="text-destructive focus:text-destructive"
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
}
