"use client"

import { useState } from "react"
import { MoreHorizontal, Eye, FileText, Pencil, X } from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"
import { es } from "date-fns/locale"
import { format } from "date-fns"

import { PaymentStatusBadge } from "@/shared/components/payment-status-badge"
import { Badge } from "@/shared/components/ui/badge"
import { Button } from "@/shared/components/ui/button"
import { DataGridColumnHeader } from "@/shared/components/data-grid/data-grid-column-header"
import {
	DropdownMenu,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuSeparator,
} from "@/shared/components/ui/dropdown-menu"

import type { TransferWithDetails } from "../actions/transfer.actions"
import { CancelTransferDialog } from "../components/cancel-transfer-dialog"

/**
 * Calcula los montos esperados según el estado de pago
 */
function calculateExpectedAmounts(transfer: TransferWithDetails) {
	const totalTourPrice = transfer.priceDetails.reduce((sum, p) => sum + p.tourPrice, 0)
	const totalEntrancePrice = transfer.priceDetails.reduce((sum, p) => sum + p.entrancePrice, 0)
	const totalPrice = totalTourPrice + totalEntrancePrice

	const totalPaid = transfer.payments.reduce((sum, payment) => {
		return payment.refund ? sum - payment.amount : sum + payment.amount
	}, 0)

	const pendingAmount = totalPrice - totalPaid

	let pendingDescription = ""
	switch (transfer.paymentStatus) {
		case "TOUR_ONLY":
			pendingDescription = "Entradas pendientes"
			break
		case "ENTRANCE_ONLY":
			pendingDescription = "Tours pendientes"
			break
		case "PENDING":
			pendingDescription = "Todo pendiente"
			break
	}

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
	transfer: TransferWithDetails
	onViewDetails: (transfer: TransferWithDetails) => void
	onViewAudit?: (transfer: TransferWithDetails) => void
	onEdit?: (transfer: TransferWithDetails) => void
}

function ActionsCell({ transfer, onViewDetails, onViewAudit, onEdit }: ActionsCellProps) {
	const [cancelOpen, setCancelOpen] = useState(false)
	const isCancelled = transfer.status === "CANCELLED"

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
					<DropdownMenuItem onClick={() => onViewDetails(transfer)}>
						<Eye className="h-4 w-4" />
						Ver detalles
					</DropdownMenuItem>
					{onViewAudit && (
						<DropdownMenuItem onClick={() => onViewAudit(transfer)}>
							<FileText className="h-4 w-4" />
							Ver auditoría
						</DropdownMenuItem>
					)}
					{onEdit && (
						<DropdownMenuItem
							onClick={() => onEdit(transfer)}
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
						<X className="h-4 w-4" />
						Cancelar traspaso
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<CancelTransferDialog
				open={cancelOpen}
				onOpenChange={setCancelOpen}
				transferId={transfer.id}
				transferVoucher={transfer.voucher}
				transferType={transfer.type}
			/>
		</>
	)
}

export const createTransferColumns = (
	onViewDetails: (transfer: TransferWithDetails) => void,
	onViewAudit?: (transfer: TransferWithDetails) => void,
	onEdit?: (transfer: TransferWithDetails) => void
): ColumnDef<TransferWithDetails>[] => [
	{
		accessorKey: "status",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Estado" />,
		cell: ({ row }) => {
			const status = row.original.status
			return status === "CANCELLED"
				? <Badge variant="destructive" className="text-xs">Cancelado</Badge>
				: <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400 text-xs">Activo</Badge>
		},
	},
	{
		accessorKey: "voucher",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Voucher" />,
		cell: ({ row }) => {
			const voucher = row.original.voucher
			return <span className="font-medium">#{voucher}</span>
		},
	},
	{
		accessorKey: "date",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Fecha" />,
		cell: ({ row }) => {
			return format(new Date(row.original.date), "dd/MM/yyyy", { locale: es })
		},
	},
	{
		accessorKey: "agency",
		enableSorting: false,
		header: ({ column }) => <DataGridColumnHeader column={column} title="Agencia" />,
		cell: ({ row }) => {
			return <span className="font-medium">{row.original.agency.name}</span>
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
		id: "totalAmountTours",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Monto Total Tours" />,
		cell: ({ row }) => {
			const total = row.original.priceDetails.reduce((sum, price) => sum + price.tourPrice, 0)
			return <span className="font-medium">${total.toLocaleString("es-CL")}</span>
		},
	},
	{
		id: "totalAmountEntrances",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Monto Total Entradas" />,
		cell: ({ row }) => {
			const total = row.original.priceDetails.reduce((sum, price) => sum + price.entrancePrice, 0)
			return <span className="font-medium">${total.toLocaleString("es-CL")}</span>
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
		cell: ({ row }) => (
			<ActionsCell
				transfer={row.original}
				onViewDetails={onViewDetails}
				onViewAudit={onViewAudit}
				onEdit={onEdit}
			/>
		),
	},
]
