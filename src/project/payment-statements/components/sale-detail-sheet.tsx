"use client"

import { Calendar, DollarSign, FileText, Users, CreditCard, CheckCircle, Clock } from "lucide-react"
import { es } from "date-fns/locale"
import { format } from "date-fns"

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Separator } from "@/shared/components/ui/separator"
import { Badge } from "@/shared/components/ui/badge"
import { ScrollArea } from "@/shared/components/ui/scroll-area"
import {
	Sheet,
	SheetTitle,
	SheetHeader,
	SheetContent,
	SheetDescription,
} from "@/shared/components/ui/sheet"
import { PaymentStatementRegisterPaymentDialog } from "./payment-statement-register-payment-dialog"

import { formatCurrency } from "@/shared/lib/format-currency"
import { getPaymentMethodLabel } from "@/shared/lib/payment-method-labels"

import type { PaymentStatementSale } from "../types/payment-statement.types"

interface SaleDetailSheetProps {
	sale: PaymentStatementSale | null
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function SaleDetailSheet({ sale, open, onOpenChange }: SaleDetailSheetProps) {
	if (!sale) return null

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full sm:max-w-xl">
				<SheetHeader>
					<SheetTitle className="flex items-center gap-2">
						<FileText className="h-5 w-5" />
						Venta V-{sale.voucher}
					</SheetTitle>
					<SheetDescription>
						File: {sale.fileNumber || "Sin file"} • Creada el{" "}
						{format(new Date(sale.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: es })}
					</SheetDescription>
				</SheetHeader>

				<ScrollArea className="h-[calc(100vh-8rem)] px-4">
					<div className="space-y-6">
						{/* Estado General */}
						<div className="flex flex-wrap items-center gap-3">
							{sale.isPaid ? (
								<Badge className="bg-green-500/10 text-green-500">
									<CheckCircle className="mr-1 h-3 w-3" />
									Pagado Completo
								</Badge>
							) : (
								<Badge variant="outline" className="bg-orange-500/10 text-orange-500">
									<Clock className="mr-1 h-3 w-3" />
									Pendiente: {formatCurrency(sale.pendingAmount)}
								</Badge>
							)}

							{/*{sale.invoiceId ? (
								<Badge variant="outline" className="text-muted-foreground">
									Factura vinculada
								</Badge>
							) : (
								<Badge variant="outline" className="text-muted-foreground">
									Sin factura mayorista
								</Badge>
							)}*/}

							{sale.invoiceId && sale.pendingAmount > 0 ? (
								<PaymentStatementRegisterPaymentDialog
									invoiceId={sale.invoiceId}
									pendingAmount={sale.pendingAmount}
								/>
							) : null}
						</div>

						{/* Eventos */}
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="flex items-center gap-2 text-base">
									<Calendar className="h-4 w-4" />
									Eventos ({sale.events.length})
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								{sale.events.map((event) => (
									<div
										key={event.id}
										className="bg-muted/50 flex items-center justify-between rounded-lg p-3"
									>
										<div>
											<p className="font-medium">{event.tourName}</p>
											<p className="text-muted-foreground text-sm">
												{/* event.date is @db.Date (UTC midnight); reconstruct for locale-aware format */}
												{format(
													new Date(event.date.getUTCFullYear(), event.date.getUTCMonth(), event.date.getUTCDate()),
													"EEEE, dd 'de' MMMM",
													{ locale: es },
												)}
											</p>
											<div className="mt-1">
												{event.isFullyTransferred ? (
													<Badge
														variant="outline"
														className="border-amber-500 bg-amber-50 text-amber-700"
													>
														Traspasado ({event.transferredPassengerCount}/{event.participantCount})
													</Badge>
												) : event.isPartiallyTransferred ? (
													<Badge
														variant="outline"
														className="border-blue-500 bg-blue-50 text-blue-700"
													>
														Parcial ({event.transferredPassengerCount}/{event.participantCount})
													</Badge>
												) : (
													<Badge variant="outline">Pendiente</Badge>
												)}
											</div>
										</div>
										<div className="text-right">
											<div className="flex items-center gap-1 text-sm">
												<Users className="h-3 w-3" />
												<span>{event.participantCount} pax</span>
											</div>
											<p className="font-medium">{formatCurrency(event.amount)}</p>
										</div>
									</div>
								))}
							</CardContent>
						</Card>

						{/* Pagos */}
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="flex items-center gap-2 text-base">
									<CreditCard className="h-4 w-4" />
									Pagos ({sale.payments.length})
								</CardTitle>
							</CardHeader>
							<CardContent>
								{sale.payments.length === 0 ? (
									<p className="text-muted-foreground text-sm">No hay pagos registrados</p>
								) : (
									<div className="space-y-2">
										{sale.payments.map((payment) => (
											<div
												key={payment.id}
												className="flex items-center justify-between rounded-lg border p-3"
											>
												<div>
													<p className="font-medium">
														{payment.refund ? "Devolución - " : ""}
														{getPaymentMethodLabel(payment.method)}
													</p>
													<p className="text-muted-foreground text-sm">
														{format(new Date(payment.date), "dd/MM/yyyy", { locale: es })}
													</p>
												</div>
												<p className={`font-medium ${payment.refund ? "text-red-600" : ""}`}>
													{payment.refund ? "-" : ""}
													{formatCurrency(payment.amount)}
												</p>
											</div>
										))}
									</div>
								)}
							</CardContent>
						</Card>

						{/* Resumen */}
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="flex items-center gap-2 text-base">
									<DollarSign className="h-4 w-4" />
									Resumen
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-2">
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">Total Eventos:</span>
									<span className="font-medium">{formatCurrency(sale.totalAmount)}</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">Total Pagado:</span>
									<span className="font-medium text-green-600">
										{formatCurrency(sale.paidAmount)}
									</span>
								</div>
								<Separator />
								<div className="flex justify-between">
									<span className="font-medium">Saldo Pendiente:</span>
									<span
										className={`text-lg font-bold ${sale.pendingAmount > 0 ? "text-orange-600" : "text-green-600"}`}
									>
										{formatCurrency(sale.pendingAmount)}
									</span>
								</div>
							</CardContent>
						</Card>
					</div>
				</ScrollArea>
			</SheetContent>
		</Sheet>
	)
}
