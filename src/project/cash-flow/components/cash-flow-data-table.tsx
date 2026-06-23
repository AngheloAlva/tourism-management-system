"use client"

import { es } from "date-fns/locale"
import { format } from "date-fns"
import {
	Link,
	Landmark,
	Banknote,
	CreditCard,
	TrendingUp,
	ArrowUpIcon,
	TrendingDown,
	ArrowDownIcon,
	ArrowRightLeft,
} from "lucide-react"

import { useDailyCashBox } from "../hooks/use-cash-flow"
import { cn } from "@/lib/utils"

import { ScrollArea } from "@/shared/components/ui/scroll-area"
import { Badge } from "@/shared/components/ui/badge"
import {
	Table,
	TableRow,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
} from "@/shared/components/ui/table"

const entryTypeConfig: Record<string, { label: string; icon: typeof TrendingUp; color: string }> = {
	INCOME: {
		label: "Ingreso",
		icon: TrendingUp,
		color: "text-green-600 bg-green-100 dark:bg-green-900/30",
	},
	DEPOSIT: {
		label: "Depósito",
		icon: Landmark,
		color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30",
	},
	SUPPLIER_PAYMENT: {
		label: "Pago Proveedor",
		icon: TrendingDown,
		color: "text-red-600 bg-red-100 dark:bg-red-900/30",
	},
	OTHER_EXPENSE: {
		label: "Gasto",
		icon: TrendingDown,
		color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30",
	},
	CURRENCY_EXCHANGE: {
		label: "Cambio Moneda",
		icon: ArrowRightLeft,
		color: "text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30",
	},
}

const paymentMethodConfig: Record<string, { label: string; icon: typeof Banknote; color: string }> =
	{
		CASH: {
			label: "Efectivo",
			icon: Banknote,
			color:
				"text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-900 dark:text-emerald-200",
		},
		TRANSFER: {
			label: "Transferencia",
			icon: ArrowRightLeft,
			color:
				"text-violet-600 bg-violet-50 border-violet-200 dark:bg-violet-950 dark:border-violet-900 dark:text-violet-200",
		},
		CREDIT_CARD: {
			label: "T. Credito",
			icon: CreditCard,
			color:
				"text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-200",
		},
		DEBIT_CARD: {
			label: "T. Debito",
			icon: CreditCard,
			color:
				"text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-900 dark:text-blue-200",
		},
		PAYMENT_LINK_DEBIT: {
			label: "Link Debito",
			icon: Link,
			color:
				"text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-900 dark:text-amber-200",
		},
		PAYMENT_LINK_CREDIT: {
			label: "Link Credito",
			icon: Link,
			color:
				"text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-900 dark:text-amber-200",
		},
		CARD: {
			label: "Tarjeta",
			icon: CreditCard,
			color:
				"text-violet-600 bg-violet-50 border-violet-200 dark:bg-violet-950 dark:border-violet-900 dark:text-violet-200",
		},
		PAYMENT_LINK: {
			label: "Link",
			icon: Link,
			color:
				"text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-900 dark:text-amber-200",
		},
	}

const categoryLabels: Record<string, string> = {
	SUPPLIES: "Suministros",
	TRANSPORTATION: "Transporte",
	FOOD: "Alimentación",
	OTHER: "Otros",
}

interface CashFlowDataTableProps {
	date?: Date
}

export function CashFlowDataTable({ date }: CashFlowDataTableProps) {
	const { data: cashBox, isLoading } = useDailyCashBox(date)

	const formatCurrency = (amount: number) =>
		new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(Math.abs(amount))
	const formatUsdAmount = (amount: number) =>
		new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Math.abs(amount))

	if (isLoading) {
		return (
			<section className="space-y-4">
				<div>
					<h2 className="text-lg font-semibold">Movimientos del Día</h2>
					<p className="text-muted-foreground text-sm">Cargando...</p>
				</div>
				<div className="space-y-4">
					{Array.from({ length: 5 }).map((_, i) => (
						<div key={i} className="bg-muted h-12 animate-pulse rounded" />
					))}
				</div>
			</section>
		)
	}

	if (!cashBox) {
		return (
			<section className="space-y-4">
				<div>
					<h2 className="text-lg font-semibold">Movimientos del Día</h2>
					<p className="text-muted-foreground text-sm">No hay caja disponible</p>
				</div>
			</section>
		)
	}

	const entries = cashBox.entries || []

	return (
		<section className="space-y-4">
			<div>
				<h2 className="text-lg font-semibold">Movimientos del Día</h2>
				<p className="text-muted-foreground text-sm">
					{/* cashBox.date is @db.Date (UTC midnight); reconstruct local day for correct format output */}
					{format(
						new Date(cashBox.date.getUTCFullYear(), cashBox.date.getUTCMonth(), cashBox.date.getUTCDate()),
						"EEEE, d 'de' MMMM 'de' yyyy",
						{ locale: es },
					)}
					{" • "}
					{entries.length} movimientos
				</p>
			</div>
			{entries.length === 0 ? (
				<div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
					No hay movimientos registrados hoy
				</div>
			) : (
				<ScrollArea className="h-[400px]">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-[85px]">Hora</TableHead>
								<TableHead>Tipo</TableHead>
								<TableHead>Descripción</TableHead>
								<TableHead>Usuario</TableHead>
								<TableHead className="text-right">Monto</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{entries.map((entry) => {
								const config = entryTypeConfig[entry.type] || entryTypeConfig.OTHER_EXPENSE
								const displayAmount =
									entry.currency === "USD" ? (entry.originalAmount ?? 0) : entry.amount
								const isPositive = displayAmount > 0
								const Icon = config.icon

								return (
									<TableRow key={entry.id}>
										<TableCell className="text-muted-foreground text-sm">
											{format(new Date(entry.createdAt), "HH:mm")}
										</TableCell>
										<TableCell>
											<div className="flex flex-wrap items-center gap-2">
												<Badge variant="outline" className={cn("gap-1", config.color)}>
													<Icon className="h-3 w-3" />
													{config.label}
												</Badge>
												<Badge variant="secondary" className="text-[10px]">
													{entry.currency}
												</Badge>
												{entry.paymentMethod && paymentMethodConfig[entry.paymentMethod] && (
													<Badge
														variant="outline"
														className={cn(
															"gap-1 text-[10px]",
															paymentMethodConfig[entry.paymentMethod].color
														)}
													>
														{(() => {
															const MethodIcon = paymentMethodConfig[entry.paymentMethod].icon
															return <MethodIcon className="h-2.5 w-2.5" />
														})()}
														{paymentMethodConfig[entry.paymentMethod].label}
													</Badge>
												)}
												{entry.category && (
													<span className="text-muted-foreground text-xs">
														({categoryLabels[entry.category] || entry.category})
													</span>
												)}
											</div>
										</TableCell>
										<TableCell>
											<div className="font-medium">{entry.description}</div>
											{entry.reference && (
												<div className="text-muted-foreground text-xs">
													Ref: {entry.reference}
												</div>
											)}
										</TableCell>
										<TableCell>
											<span className="text-muted-foreground text-sm">
												{entry.createdBy.name}
											</span>
										</TableCell>
										<TableCell className="text-right">
											<div
												className={cn(
													"flex items-center justify-end gap-1 font-medium",
													isPositive ? "text-green-600" : "text-red-600"
												)}
											>
												{isPositive ? (
													<ArrowUpIcon className="h-3 w-3" />
												) : (
													<ArrowDownIcon className="h-3 w-3" />
												)}
												{entry.currency === "USD"
													? formatUsdAmount(displayAmount)
													: formatCurrency(entry.amount)}
											</div>
											{entry.currency === "USD" && (
												<div className="text-muted-foreground mt-1 text-xs">
													CLP {formatCurrency(entry.amount)}
												</div>
											)}
										</TableCell>
									</TableRow>
								)
							})}
						</TableBody>
					</Table>
				</ScrollArea>
			)}
		</section>
	)
}
