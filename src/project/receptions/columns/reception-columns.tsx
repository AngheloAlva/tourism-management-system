"use client"

import { useState } from "react"
import { MoreHorizontal, Eye, FileText, Pencil, Ban } from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"
import { es } from "date-fns/locale"
import { format } from "date-fns"
import { formatCalendarDay } from "@/shared/utils/calendar-day"

import { PaymentStatusBadge } from "@/shared/components/payment-status-badge"
import { Badge } from "@/shared/components/ui/badge"
import { Button } from "@/shared/components/ui/button"
import { DataGridColumnHeader } from "@/shared/components/data-grid/data-grid-column-header"
import { getEventDisplayName } from "@/project/events/utils/event-display"
import {
	DropdownMenu,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuSeparator,
} from "@/shared/components/ui/dropdown-menu"
import { CancelTransferDialog } from "@/project/transfers/components/cancel-transfer-dialog"

import type { ReceptionWithDetails } from "../actions/reception.actions"

/**
 * Calcula los montos esperados según el estado de pago
 * - FULLY_PAID: Se espera pago total (tour + entradas)
 * - TOUR_ONLY: Solo se pagó tour, se debe entradas
 * - ENTRANCE_ONLY: Solo se pagó entradas, se debe tour
 * - PENDING: No se ha pagado nada
 */
function calculateExpectedAmounts(reception: ReceptionWithDetails) {
	const totalTourPrice = reception.priceDetails.reduce((sum, p) => sum + p.tourPrice, 0)
	const totalEntrancePrice = reception.priceDetails.reduce((sum, p) => sum + p.entrancePrice, 0)
	const totalPrice = totalTourPrice + totalEntrancePrice

	const totalPaid = reception.payments.reduce((sum, payment) => {
		return payment.refund ? sum - payment.amount : sum + payment.amount
	}, 0)

	// Calcular monto pendiente basado en el estado de pago
	let expectedPaid = 0
	let pendingDescription = ""

	switch (reception.paymentStatus) {
		case "FULLY_PAID":
			expectedPaid = totalPrice
			pendingDescription = ""
			break
		case "TOUR_ONLY":
			// Se pagó tour, se debe entradas
			expectedPaid = totalTourPrice
			pendingDescription = "Entradas pendientes"
			break
		case "ENTRANCE_ONLY":
			// Se pagó entradas, se debe tour
			expectedPaid = totalEntrancePrice
			pendingDescription = "Tours pendientes"
			break
		case "PENDING":
			expectedPaid = 0
			pendingDescription = "Todo pendiente"
			break
	}

	// El monto pendiente es lo que falta por pagar del total
	const pendingAmount = totalPrice - totalPaid

	return {
		totalTourPrice,
		totalEntrancePrice,
		totalPrice,
		totalPaid,
		pendingAmount: Math.max(0, pendingAmount),
		pendingDescription,
	}
}

interface ActionsCellProps {
	reception: ReceptionWithDetails
	onViewDetails: (reception: ReceptionWithDetails) => void
	onViewAudit?: (reception: ReceptionWithDetails) => void
	onEdit?: (reception: ReceptionWithDetails) => void
}

function ActionsCell({ reception, onViewDetails, onViewAudit, onEdit }: ActionsCellProps) {
	const [cancelOpen, setCancelOpen] = useState(false)

	const isCancelled = reception.status === "CANCELLED"

	return (
		<>
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
					<DropdownMenuItem onClick={() => onViewDetails(reception)}>
						<Eye className="h-4 w-4" />
						Ver detalles
					</DropdownMenuItem>
					{onViewAudit && (
						<DropdownMenuItem onClick={() => onViewAudit(reception)}>
							<FileText className="h-4 w-4" />
							Ver auditoría
						</DropdownMenuItem>
					)}
					{onEdit && (
						<DropdownMenuItem
							onClick={() => onEdit(reception)}
							disabled={isCancelled}
						>
							<Pencil className="h-4 w-4" />
							Editar
						</DropdownMenuItem>
					)}
					<DropdownMenuItem
						onClick={() => setCancelOpen(true)}
						disabled={isCancelled}
						className="text-destructive focus:text-destructive"
					>
						<Ban className="h-4 w-4" />
						Cancelar recepción
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<CancelTransferDialog
				open={cancelOpen}
				onOpenChange={setCancelOpen}
				transferId={reception.id}
				transferVoucher={reception.voucher}
				transferType="INCOMING"
			/>
		</>
	)
}

export const createReceptionColumns = (
	onViewDetails: (reception: ReceptionWithDetails) => void,
	onViewAudit?: (reception: ReceptionWithDetails) => void,
	onEdit?: (reception: ReceptionWithDetails) => void
): ColumnDef<ReceptionWithDetails>[] => [
	{
		accessorKey: "voucher",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Voucher" />,
		cell: ({ row }) => {
			const voucher = row.getValue("voucher") as number

			return (
				<div className="font-semibold">
					REC-
					{voucher}
				</div>
			)
		},
	},
	{
		id: "status",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Estado" />,
		cell: ({ row }) => {
			const status = row.original.status
			if (status === "CANCELLED") {
				return (
					<Badge variant="destructive" className="text-xs">
						Cancelado
					</Badge>
				)
			}
			return (
				<Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400 text-xs">
					Activo
				</Badge>
			)
		},
	},
	{
		id: "date",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Fecha" />,
		cell: ({ row }) => {
			const firstEvent = row.original.eventBookings[0]
			if (firstEvent?.event.date) {
				// event.date is @db.Date (UTC midnight)
				return formatCalendarDay(firstEvent.event.date, "dd/MM/yyyy")
			}
			return format(new Date(row.original.createdAt), "dd/MM/yyyy", { locale: es })
		},
	},
	{
		id: "tours",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Tours" />,
		cell: ({ row }) => {
			const tours = row.original.eventBookings
				.map((event) => getEventDisplayName(event.event))
				.filter(Boolean)
				.join(", ")
			return (
				<span className="line-clamp-1 w-52 max-w-52 truncate" title={tours}>
					{tours || "-"}
				</span>
			)
		},
	},
	{
		id: "agency",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Agencia" />,
		cell: ({ row }) => {
			return <span>{row.original.agency.name}</span>
		},
	},
	{
		id: "passengers",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Pasajeros" />,
		cell: ({ row }) => {
			return <span>{row.original.passengers.length}</span>
		},
	},
	{
		id: "events",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Eventos" />,
		cell: ({ row }) => {
			return <span>{row.original.eventBookings.length}</span>
		},
	},
	{
		id: "totalAmount",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Monto Total" />,
		cell: ({ row }) => {
			const { totalPrice } = calculateExpectedAmounts(row.original)
			return <span className="font-medium">${totalPrice.toLocaleString("es-CL")}</span>
		},
	},
	{
		id: "paidAmount",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Monto Pagado" />,
		cell: ({ row }) => {
			const { totalPaid } = calculateExpectedAmounts(row.original)
			return (
				<span className="font-medium text-green-600">${totalPaid.toLocaleString("es-CL")}</span>
			)
		},
	},
	{
		id: "paymentStatus",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Estado de Pago" />,
		cell: ({ row }) => {
			return <PaymentStatusBadge status={row.original.paymentStatus} simplified />
		},
	},
	{
		id: "pendingAmount",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Monto Pendiente" />,
		cell: ({ row }) => {
			const { pendingAmount, pendingDescription } = calculateExpectedAmounts(row.original)
			return (
				<div className="flex flex-col">
					<span
						className={
							pendingAmount > 0 ? "font-medium text-yellow-600" : "font-medium text-green-600"
						}
					>
						${pendingAmount.toLocaleString("es-CL")}
					</span>
					{pendingDescription && pendingAmount > 0 && (
						<span className="text-muted-foreground text-xs">{pendingDescription}</span>
					)}
				</div>
			)
		},
	},
	{
		accessorKey: "comments",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Comentarios" />,
		cell: ({ row }) => {
			const comments = row.original.comments
			if (!comments) return <span className="text-muted-foreground">-</span>
			return (
				<span className="max-w-[200px] truncate" title={comments}>
					{comments}
				</span>
			)
		},
	},
	{
		accessorKey: "createdByUser",
		enableSorting: false,
		header: ({ column }) => <DataGridColumnHeader column={column} title="Creado por" />,
		cell: ({ row }) => {
			return <span>{row.original.createdByUser.name}</span>
		},
	},
	{
		id: "actions",
		cell: ({ row }) => {
			return (
				<ActionsCell
					reception={row.original}
					onViewDetails={onViewDetails}
					onViewAudit={onViewAudit}
					onEdit={onEdit}
				/>
			)
		},
	},
]
