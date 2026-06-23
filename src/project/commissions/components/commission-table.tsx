"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { formatCalendarDay } from "@/shared/utils/calendar-day"

import { useCommissionSales } from "../hooks/use-commissions"
import { getSaleChannelLabel } from "@/project/sales/constants/channel-labels"

import { Badge } from "@/shared/components/ui/badge"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/components/ui/table"

import type { CommissionFilters, CommissionKind } from "../types/commission.types"

interface CommissionTableProps {
	kind: CommissionKind
	filters: CommissionFilters
}

function formatCLP(amount: number) {
	return new Intl.NumberFormat("es-CL", {
		style: "currency",
		currency: "CLP",
	}).format(amount)
}

export function CommissionTable({ kind, filters }: CommissionTableProps) {
	const { data: sales, isLoading } = useCommissionSales(kind, filters)

	if (!filters.operatorId) {
		return (
			<div className="flex h-32 items-center justify-center">
				<p className="text-muted-foreground">Selecciona una operadora para ver sus ventas</p>
			</div>
		)
	}

	if (isLoading) {
		return (
			<div className="flex h-32 items-center justify-center">
				<p className="text-muted-foreground">Cargando ventas...</p>
			</div>
		)
	}

	if (!sales || sales.length === 0) {
		return (
			<div className="flex h-32 items-center justify-center">
				<p className="text-muted-foreground">
					No hay ventas en el rango seleccionado para esta operadora
				</p>
			</div>
		)
	}

	return (
		<section className="space-y-4">
			<div>
				<h2 className="text-lg font-semibold">Detalle de Ventas</h2>
				<p className="text-muted-foreground text-sm">
					{sales.length} venta(s) en el período seleccionado
				</p>
			</div>
			<div className="bg-muted/30 rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Voucher</TableHead>
							<TableHead>N° File</TableHead>
							<TableHead>Canal</TableHead>
							<TableHead>Fecha</TableHead>
							<TableHead>Tour</TableHead>
							<TableHead className="text-right">Total Bruto</TableHead>
							<TableHead className="text-right">Entradas</TableHead>
							<TableHead className="text-right">Total Tours</TableHead>
							<TableHead>Comisión</TableHead>
							<TableHead>Fecha Pago</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{sales.map((sale) => {
							const paidCount = sale.bookings.filter((b) => b.commissionPaid).length
							const totalCount = sale.bookings.length

							return sale.bookings.map((booking, bookingIndex) => (
								<TableRow key={booking.id}>
									{bookingIndex === 0 ? (
										<>
											<TableCell rowSpan={totalCount}>
												<div className="flex flex-col gap-1">
													<Badge variant="outline">V-{sale.voucher}</Badge>
													{totalCount > 1 && (
														<span className="text-muted-foreground text-xs">
															{paidCount}/{totalCount} pagados
														</span>
													)}
												</div>
											</TableCell>
											<TableCell rowSpan={totalCount}>
												{sale.fileNumber || "-"}
											</TableCell>
											<TableCell rowSpan={totalCount}>
												<Badge variant="secondary" className="text-xs">
													{getSaleChannelLabel(sale.channel)}
												</Badge>
											</TableCell>
										</>
									) : null}
									<TableCell>
										<span className="text-muted-foreground text-xs">
											{formatCalendarDay(booking.date, "dd/MM")}
										</span>
									</TableCell>
									<TableCell>
										<div className="flex flex-col gap-0.5">
											<span className="text-foreground truncate text-sm font-medium">
												{booking.tourName}
											</span>
											<span className="text-muted-foreground text-xs">
												{booking.entries.map((e) => `${e.count}×${e.name}`).join(" ")}
											</span>
										</div>
									</TableCell>
									<TableCell className="text-right font-medium">
										{formatCLP(booking.saleAmount)}
									</TableCell>
									<TableCell className="text-right text-amber-600">
										{booking.entranceFees > 0 ? `-${formatCLP(booking.entranceFees)}` : "—"}
									</TableCell>
									<TableCell className="text-right font-semibold text-emerald-600">
										{formatCLP(booking.tourOnlyAmount)}
									</TableCell>
									<TableCell>
										{booking.commissionPaid ? (
											<Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
												Pagada
											</Badge>
										) : (
											<Badge variant="outline">Pendiente</Badge>
										)}
									</TableCell>
									<TableCell className="text-sm">
										{booking.commission?.paidAt
											? format(new Date(booking.commission.paidAt), "dd/MM/yyyy", { locale: es })
											: "-"}
									</TableCell>
								</TableRow>
							))
						})}

						{/* Totals row */}
						<TableRow className="bg-muted/50 font-bold">
							<TableCell colSpan={5} className="text-right">
								TOTALES
							</TableCell>
							<TableCell className="text-right">
								{formatCLP(sales.reduce((sum, s) => sum + s.totalSaleAmount, 0))}
							</TableCell>
							<TableCell className="text-right text-amber-600">
								-{formatCLP(sales.reduce((sum, s) => sum + s.totalEntranceFees, 0))}
							</TableCell>
							<TableCell className="text-right text-emerald-600">
								{formatCLP(sales.reduce((sum, s) => sum + s.totalTourOnly, 0))}
							</TableCell>
							<TableCell />
							<TableCell />
						</TableRow>
					</TableBody>
				</Table>
			</div>
		</section>
	)
}
