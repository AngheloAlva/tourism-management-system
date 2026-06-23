"use client"

import { es } from "date-fns/locale"
import { format } from "date-fns"
import Link from "next/link"
import {
	EyeIcon,
	PencilIcon,
	Trash2Icon,
	BanIcon,
	XCircleIcon,
	CheckCircleIcon,
	MoreHorizontalIcon,
	HistoryIcon,
	ArrowRightIcon,
} from "lucide-react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip"
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
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/shared/components/ui/hover-card"
import { isPassengerComplete } from "@/shared/utils/passenger-utils"

import type { SaleRecordWithDetails } from "../actions/sale-record.actions"
import type { ColumnDef } from "@tanstack/react-table"
import { SaleType } from "../constants/enums"
import { getSaleChannelLabel } from "../constants/channel-labels"
import { calculateBookingRevenue } from "../utils/booking-revenue"

const statusConfig = {
	TO_BE_DONE: { label: "Por Realizar" },
	IN_PROGRESS: { label: "En Progreso" },
	COMPLETED: { label: "Finalizado" },
	CANCELLED: { label: "Anulado" },
}

export const createSaleRecordColumns = (
	onViewDetails: (sale: SaleRecordWithDetails) => void,
	// onEdit: (sale: SaleRecordWithDetails) => void,
	onViewAudit?: (sale: SaleRecordWithDetails) => void,
	onDelete?: (sale: SaleRecordWithDetails) => void,
	onCancel?: (sale: SaleRecordWithDetails) => void
): ColumnDef<SaleRecordWithDetails>[] => [
	{
		accessorKey: "voucher",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Voucher" />,
		cell: ({ row }) => {
			const voucher = row.getValue("voucher") as number
			const type = row.original.type

			return (
				<div className="font-semibold">
					{type === SaleType.SALE ? "V-" : "COT-"}
					{voucher}
				</div>
			)
		},
	},
	{
		accessorKey: "channel",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Canal" />,
		cell: ({ row }) => {
			const channel = row.getValue("channel") as string
			return <Badge variant={"outline"}>{getSaleChannelLabel(channel)}</Badge>
		},
	},
	{
		accessorKey: "status",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Estado" />,
		cell: ({ row }) => {
			const status = row.getValue("status") as keyof typeof statusConfig
			const config = statusConfig[status]
			return <Badge variant={"secondary"}>{config.label}</Badge>
		},
	},
	{
		accessorKey: "fileNumber",
		header: ({ column }) => <DataGridColumnHeader column={column} title="N° File" />,
		cell: ({ row }) => {
			const fileNumber = row.getValue("fileNumber") as string | null
			return (
				<div className="font-medium">
					{fileNumber || <span className="text-muted-foreground">Pendiente</span>}
				</div>
			)
		},
	},
	{
		id: "passenger",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Pasajero" />,
		cell: ({ row }) => {
			const passengers = row.original.passengers
			const firstPassenger = passengers && passengers.length > 0 ? passengers[0] : null

			if (!firstPassenger) {
				return <span className="text-muted-foreground">Sin pasajeros</span>
			}

			return (
				<HoverCard>
					<HoverCardTrigger asChild>
						<Button variant="link" className="h-auto p-0 font-medium">
							{firstPassenger.name || "Sin nombre"}
						</Button>
					</HoverCardTrigger>
					<HoverCardContent className="w-80">
						<div className="flex justify-between space-x-4">
							<div className="space-y-1">
								<h4 className="text-sm font-semibold">{firstPassenger.name}</h4>
								<div className="text-sm">
									<span className="text-muted-foreground font-medium">Documento:</span>{" "}
									{firstPassenger.document || "N/A"}
								</div>
								<div className="text-sm">
									<span className="text-muted-foreground font-medium">Email:</span>{" "}
									{firstPassenger.email || "N/A"}
								</div>
								<div className="text-sm">
									<span className="text-muted-foreground font-medium">Teléfono:</span>{" "}
									{firstPassenger.phone || "N/A"}
								</div>
								<div className="text-sm">
									<span className="text-muted-foreground font-medium">Edad:</span>{" "}
									{firstPassenger.age || "N/A"}
								</div>
							</div>
						</div>
					</HoverCardContent>
				</HoverCard>
			)
		},
	},
	{
		accessorKey: "agency",
		enableSorting: false,
		header: ({ column }) => <DataGridColumnHeader column={column} title="Mayorista" />,
		cell: ({ row }) => {
			const agency = row.original.agency
			return <div className="font-medium">{agency ? agency.name : ""}</div>
		},
	},
	{
		id: "totalPassengers",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Pasajeros" />,
		cell: ({ row }) => {
			const totalPassengers = row.original.passengers?.length || 0
			return <div className="text-center">{totalPassengers}</div>
		},
		size: 90,
	},
	{
		id: "totalEvents",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Eventos" />,
		cell: ({ row }) => {
			const totalEvents = row.original.eventBookings?.length || 0
			return <div className="text-center">{totalEvents}</div>
		},
		size: 80,
	},
	{
		id: "passengerDataStatus",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Datos Pasajeros" />,
		cell: ({ row }) => {
			const allPassengersComplete = row.original.passengers.every(
				(passenger) => isPassengerComplete(passenger) && passenger.age && passenger.diet
			)

			return (
				<div className="flex items-center justify-center">
					<Tooltip>
						<TooltipTrigger>
							{allPassengersComplete ? (
								<CheckCircleIcon className="h-4 w-4 text-green-600" />
							) : (
								<XCircleIcon className="text-primary h-4 w-4" />
							)}
						</TooltipTrigger>
						<TooltipContent>
							{allPassengersComplete ? "Información completa" : "Información incompleta"}
						</TooltipContent>
					</Tooltip>
				</div>
			)
		},
		filterFn: (row, _id, value) => {
			const allPassengersComplete = row.original.passengers.every(
				(passenger) => isPassengerComplete(passenger) && passenger.age && passenger.diet
			)
			if (value === "complete") return allPassengersComplete
			if (value === "incomplete") return !allPassengersComplete
			return true
		},
	},
	{
		id: "totalAmount",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Monto Total" />,
		cell: ({ row }) => {
			const sale = row.original
			const saleTotal = sale.eventBookings.reduce((acc, booking) => {
				const revenue = calculateBookingRevenue(
					booking.priceEntries || [],
					booking.entrySnapshots || []
				)
				return acc + revenue.grandTotal
			}, 0)
			const total = saleTotal - sale.discount

			const paymentTotal = sale.paymentRecords.reduce(
				(acc, payment) => (payment.refund ? acc - payment.amount : acc + payment.amount),
				0
			)
			const hasPendingBalance = sale.type === "SALE" && paymentTotal < total

			return (
				<div className={`font-medium ${hasPendingBalance ? "text-red-600" : ""}`}>
					{new Intl.NumberFormat("es-CL", {
						style: "currency",
						currency: "CLP",
					}).format(total)}
				</div>
			)
		},
	},
	{
		accessorKey: "seller",
		enableSorting: false,
		header: ({ column }) => <DataGridColumnHeader column={column} title="Vendedor" />,
		cell: ({ row }) => {
			const seller = row.original.seller
			return <div>{seller.name}</div>
		},
		filterFn: (row, id, value) => {
			return row.original.seller.name === value
		},
	},
	{
		accessorKey: "createdAt",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Fecha" />,
		cell: ({ row }) => {
			const date = row.getValue("createdAt") as Date
			return <div className="text-sm">{format(new Date(date), "dd MMM yyyy", { locale: es })}</div>
		},
	},
	{
		id: "actions",
		cell: ({ row }) => {
			const sale = row.original

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

						<DropdownMenuItem onClick={() => onViewDetails(sale)}>
							<EyeIcon className="h-4 w-4" />
							Ver detalles
						</DropdownMenuItem>

						<DropdownMenuItem asChild>
							<Link
								href={
									sale.type === "SALE"
										? `/dashboard/registro-de-ventas/${sale.id}`
										: `/dashboard/navegacion-cotizacion/${sale.id}`
								}
							>
								<PencilIcon className="h-4 w-4" />
								Editar
							</Link>
						</DropdownMenuItem>

						{/* Opción de convertir a venta solo para cotizaciones no convertidas */}
						{sale.type === "QUOTE" && !sale.convertedToSale && (
							<DropdownMenuItem asChild>
								<Link href={`/dashboard/convertir-cotizacion/${sale.id}`}>
									<ArrowRightIcon className="h-4 w-4" />
									Convertir a Venta
								</Link>
							</DropdownMenuItem>
						)}

						{onViewAudit && (
							<DropdownMenuItem onClick={() => onViewAudit(sale)}>
								<HistoryIcon className="h-4 w-4" />
								Ver historial
							</DropdownMenuItem>
						)}

						{(onCancel || onDelete) && sale.status !== "CANCELLED" && (
							<>
								<DropdownMenuSeparator />
								{onCancel && (
									<DropdownMenuItem
										className="text-amber-600"
										onClick={() => onCancel(sale)}
									>
										<BanIcon className="h-4 w-4" />
										Anular venta
									</DropdownMenuItem>
								)}
								{onDelete && (
									<DropdownMenuItem
										className="text-destructive"
										onClick={() => onDelete(sale)}
									>
										<Trash2Icon className="h-4 w-4" />
										Eliminar
									</DropdownMenuItem>
								)}
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			)
		},
	},
]
