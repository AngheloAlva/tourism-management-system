"use client"

import { FileText, CheckCircle, Clock, Eye, Send } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

import { usePaymentStatementSales } from "../hooks/use-payment-statements"
import { Badge } from "@/shared/components/ui/badge"
import { Button } from "@/shared/components/ui/button"
import { Skeleton } from "@/shared/components/ui/skeleton"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/components/ui/table"

import type {
	PaymentStatementFilters,
	PaymentStatementSale,
} from "../types/payment-statement.types"

interface PaymentStatementTableProps {
	filters: PaymentStatementFilters
	onViewDetail: (sale: PaymentStatementSale) => void
}

export function PaymentStatementTable({ filters, onViewDetail }: PaymentStatementTableProps) {
	const { data: sales, isLoading } = usePaymentStatementSales(filters)

	const formatCurrency = (amount: number) =>
		new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(amount)

	if (!filters.agencyIds || filters.agencyIds.length === 0) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="text-center">
					<FileText className="text-muted-foreground mx-auto h-12 w-12" />
					<h3 className="text-muted-foreground mt-4 text-lg font-medium">Selecciona una agencia</h3>
					<p className="text-muted-foreground mt-2 text-sm">
						Elige una o más agencias para ver sus ventas del período
					</p>
				</div>
			</div>
		)
	}

	if (isLoading) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-6 w-48" />
				{Array.from({ length: 5 }).map((_, i) => (
					<Skeleton key={i} className="h-12 w-full" />
				))}
			</div>
		)
	}

	if (!sales || sales.length === 0) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="text-center">
					<FileText className="text-muted-foreground mx-auto h-12 w-12" />
					<h3 className="text-muted-foreground mt-4 text-lg font-medium">
						No hay ventas en este período
					</h3>
					<p className="text-muted-foreground mt-2 text-sm">
						No se encontraron ventas para la agencia en el período seleccionado
					</p>
				</div>
			</div>
		)
	}

	const getStatusBadge = (sale: PaymentStatementSale) => {
		if (sale.isPaid) {
			return (
				<Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-500/20 dark:text-green-300 dark:hover:bg-green-500/20">
					<CheckCircle className="mr-1 h-3 w-3" />
					Pagado
				</Badge>
			)
		}
		return (
			<Badge
				variant="outline"
				className="dark:border-primary/60 border-orange-300 text-orange-700 dark:text-orange-300"
			>
				<Clock className="mr-1 h-3 w-3" />
				Pendiente
			</Badge>
		)
	}

	const getDocumentBadge = (status: PaymentStatementSale["documentStatus"]) => {
		switch (status) {
			case "generated":
				return (
					<Badge
						variant="outline"
						className="border-blue-300 text-blue-700 dark:border-blue-500/60 dark:text-blue-300"
					>
						<FileText className="mr-1 h-3 w-3" />
						Generado
					</Badge>
				)
			case "sent":
				return (
					<Badge
						variant="outline"
						className="border-green-300 text-green-700 dark:border-green-500/60 dark:text-green-300"
					>
						<Send className="mr-1 h-3 w-3" />
						Enviado
					</Badge>
				)
			default:
				return (
					<Badge variant="outline" className="text-muted-foreground">
						<Clock className="mr-1 h-3 w-3" />
						Pendiente
					</Badge>
				)
		}
	}

	return (
		<section className="space-y-4">
			<h2 className="text-lg font-semibold">Ventas del Período ({sales.length})</h2>
			<div className="bg-muted/30 rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Voucher</TableHead>
							<TableHead>File</TableHead>
							<TableHead>Agencia</TableHead>
							<TableHead>Fecha</TableHead>
							<TableHead>Eventos</TableHead>
							<TableHead className="text-right">Total</TableHead>
							<TableHead className="text-right">Pagado</TableHead>
							<TableHead>Estado Pago</TableHead>
							<TableHead>Documento</TableHead>
							<TableHead className="text-center">Acciones</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{sales.map((sale) => (
							<TableRow
								key={sale.id}
								className="hover:bg-muted/50 cursor-pointer"
								onClick={() => onViewDetail(sale)}
							>
								<TableCell className="font-medium">V-{sale.voucher}</TableCell>
								<TableCell className="font-mono text-sm">{sale.fileNumber || "-"}</TableCell>
								<TableCell className="text-muted-foreground">
									{sale.agencyName || "-"}
								</TableCell>
								<TableCell>
									{format(new Date(sale.createdAt), "dd/MM/yyyy", { locale: es })}
								</TableCell>
								<TableCell>{sale.events.length}</TableCell>
								<TableCell className="text-right font-medium">
									{formatCurrency(sale.totalAmount)}
								</TableCell>
								<TableCell className="text-right">{formatCurrency(sale.paidAmount)}</TableCell>
								<TableCell>{getStatusBadge(sale)}</TableCell>
								<TableCell>{getDocumentBadge(sale.documentStatus)}</TableCell>
								<TableCell className="text-center">
									<Button
										variant="ghost"
										size="sm"
										onClick={(e) => {
											e.stopPropagation()
											onViewDetail(sale)
										}}
									>
										<Eye className="h-4 w-4" />
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</section>
	)
}
