"use client"

import { es } from "date-fns/locale"
import { format } from "date-fns"
import {
	EyeIcon,
	MailIcon,
	PencilIcon,
	ShieldBanIcon,
	ShieldCheckIcon,
	MoreHorizontalIcon,
	KeyRoundIcon,
} from "lucide-react"
import { USER_ROLE, getRoleLabel } from "../constants/roles"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip"
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar"
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

import type { UserWithStats } from "../actions/user.actions"
import type { ColumnDef } from "@tanstack/react-table"

export const createUserColumns = (
	onViewDetails: (user: UserWithStats) => void,
	onEdit: (user: UserWithStats) => void,
	onToggleBan: (user: UserWithStats) => void,
	onResetPassword?: (user: UserWithStats) => void
): ColumnDef<UserWithStats>[] => [
	{
		accessorKey: "name",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Usuario" />,
		cell: ({ row }) => {
			const user = row.original
			const initials = user.name
				.split(" ")
				.map((n) => n[0])
				.join("")
				.toUpperCase()
				.slice(0, 2)

			return (
				<div className="flex items-center gap-3">
					<Avatar className="h-8 w-8">
						<AvatarImage src={user.image || undefined} alt={user.name} />
						<AvatarFallback>{initials}</AvatarFallback>
					</Avatar>
					<div>
						<div className="font-medium">{user.name}</div>
						<div className="text-muted-foreground flex items-center gap-1 text-xs">
							<MailIcon className="h-3 w-3" />
							{user.email}
						</div>
					</div>
				</div>
			)
		},
	},
	{
		accessorKey: "role",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Rol" />,
		cell: ({ row }) => {
			const role = (row.getValue("role") as string | null) || USER_ROLE.USER
			return <Badge variant="outline">{getRoleLabel(role)}</Badge>
		},
	},
	{
		id: "contact",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Contacto" />,
		cell: ({ row }) => {
			const user = row.original
			return (
				<div className="space-y-0.5 text-xs">
					<p className="font-medium">{user.phone || "Sin teléfono"}</p>
					<p className="text-muted-foreground">{user.rut || "Sin RUT"}</p>
				</div>
			)
		},
	},
	{
		id: "salesCount",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Ventas" />,
		cell: ({ row }) => {
			const salesCount = row.original._count.sales
			return <div className="text-center font-medium">{salesCount}</div>
		},
	},
	{
		accessorKey: "emailVerified",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Email Verificado" />,
		cell: ({ row }) => {
			const verified = row.getValue("emailVerified") as boolean
			return (
				<div className="flex items-center justify-center">
					<Tooltip>
						<TooltipTrigger>
							{verified ? (
								<ShieldCheckIcon className="h-4 w-4 text-green-600" />
							) : (
								<ShieldBanIcon className="text-primary h-4 w-4" />
							)}
						</TooltipTrigger>
						<TooltipContent>{verified ? "Email verificado" : "Email no verificado"}</TooltipContent>
					</Tooltip>
				</div>
			)
		},
	},
	{
		accessorKey: "banned",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Estado" />,
		cell: ({ row }) => {
			const banned = row.getValue("banned") as boolean | null
			return (
				<Badge variant={banned ? "destructive" : "outline"}>{banned ? "Baneado" : "Activo"}</Badge>
			)
		},
	},
	{
		accessorKey: "createdAt",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Fecha de Registro" />,
		cell: ({ row }) => {
			const date = row.getValue("createdAt") as Date
			return <div className="text-sm">{format(new Date(date), "dd MMM yyyy", { locale: es })}</div>
		},
	},
	{
		id: "actions",
		cell: ({ row }) => {
			const user = row.original

			return (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className="h-8 w-8 p-0">
							<span className="sr-only">Abrir menú</span>
							<MoreHorizontalIcon className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuLabel>Acciones</DropdownMenuLabel>
						<DropdownMenuItem onClick={() => onViewDetails(user)}>
							<EyeIcon className="h-4 w-4" />
							Ver detalles
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => onEdit(user)}>
							<PencilIcon className="h-4 w-4" />
							Editar
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						{onResetPassword && (
							<DropdownMenuItem onClick={() => onResetPassword(user)}>
								<KeyRoundIcon className="h-4 w-4" />
								Resetear contraseña
							</DropdownMenuItem>
						)}
						<DropdownMenuItem
							onClick={() => onToggleBan(user)}
							className={user.banned ? "text-green-600" : "text-orange-600"}
						>
							{user.banned ? (
								<>
									<ShieldCheckIcon className="h-4 w-4" />
									Desbanear
								</>
							) : (
								<>
									<ShieldBanIcon className="h-4 w-4" />
									Banear
								</>
							)}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)
		},
	},
]
