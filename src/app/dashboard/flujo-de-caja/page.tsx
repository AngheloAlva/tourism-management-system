"use client"

import dynamic from "next/dynamic"
import { Clock, Landmark, Truck, Receipt, CalendarIcon, Lock, ArrowRightLeft } from "lucide-react"
import { format, isSameDay } from "date-fns"
import { es } from "date-fns/locale"
import { useState } from "react"

import { useDailyCashBox } from "@/project/cash-flow/hooks/use-cash-flow"
import { cn } from "@/lib/utils"

import { SupplierPaymentDialog } from "@/project/cash-flow/components/supplier-payment-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover"
import { OtherExpenseDialog } from "@/project/cash-flow/components/other-expense-dialog"
import { CashFlowDataTable } from "@/project/cash-flow/components/cash-flow-data-table"
import { CashFlowSummary } from "@/project/cash-flow/components/cash-flow-summary"
import { CashCountDialog } from "@/project/cash-flow/components/cash-count-dialog"
import { DepositDialog } from "@/project/cash-flow/components/deposit-dialog"
import { UsdExchangeDialog } from "@/project/cash-flow/components/usd-exchange-dialog"
import { Calendar } from "@/shared/components/ui/calendar"
import { Button } from "@/shared/components/ui/button"
import { ModuleLoadingSkeleton } from "@/shared/components/ui/module-loading-skeleton"

const CashFlowChart = dynamic(
	() =>
		import("@/project/cash-flow/components/cash-flow-chart").then((m) => ({
			default: m.CashFlowChart,
		})),
	{ ssr: false }
)

export default function CashFlowPage() {
	const [date, setDate] = useState<Date>(new Date())

	const { data: cashBox, isLoading } = useDailyCashBox(date)

	if (isLoading && !cashBox) {
		return (
			<ModuleLoadingSkeleton
				titleWidthClassName="w-[220px]"
				descriptionWidthClassName="w-[520px]"
			/>
		)
	}

	const isToday = isSameDay(date, new Date())
	const isClosed = cashBox?.status === "CLOSED"

	const isLocked = !isToday || isClosed

	return (
		<div className="flex flex-1 flex-col gap-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Flujo de Caja</h1>
					<p className="text-muted-foreground">
						Control de todos los ingresos y egresos: ventas, traspasos y operaciones
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<Popover>
						<PopoverTrigger asChild>
							<Button
								variant={"outline"}
								className={cn(
									"w-[240px] justify-start text-left font-normal",
									!date && "text-muted-foreground"
								)}
							>
								<CalendarIcon className="h-4 w-4" />
								{date ? format(date, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-auto p-0" align="end">
							<Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} />
						</PopoverContent>
					</Popover>

					<CashCountDialog>
						<Button variant="outline" className="gap-2" disabled={!isToday}>
							<Clock className="h-4 w-4" />
							<span className="hidden sm:inline">Conteo de Caja</span>
							<span className="sm:hidden">Conteo</span>
						</Button>
					</CashCountDialog>

					<DepositDialog>
						<Button variant="outline" className="gap-2" disabled={isLocked}>
							{isLocked && <Lock className="mr-1 h-3 w-3" />}
							<Landmark className="h-4 w-4" />
							<span className="hidden sm:inline">Depósito</span>
						</Button>
					</DepositDialog>

					<SupplierPaymentDialog>
						<Button variant="outline" className="gap-2" disabled={isLocked}>
							{isLocked && <Lock className="mr-1 h-3 w-3" />}
							<Truck className="h-4 w-4" />
							<span className="hidden sm:inline">Proveedor</span>
						</Button>
					</SupplierPaymentDialog>

					<OtherExpenseDialog>
						<Button variant="outline" className="gap-2" disabled={isLocked}>
							{isLocked && <Lock className="mr-1 h-3 w-3" />}
							<Receipt className="h-4 w-4" />
							<span className="hidden sm:inline">Gasto</span>
						</Button>
					</OtherExpenseDialog>

					<UsdExchangeDialog>
						<Button variant="outline" className="gap-2" disabled={isLocked}>
							{isLocked && <Lock className="mr-1 h-3 w-3" />}
							<ArrowRightLeft className="h-4 w-4" />
							<span className="hidden sm:inline">Cambio USD</span>
						</Button>
					</UsdExchangeDialog>
				</div>
			</div>

			<CashFlowSummary date={date} />

			<div className="grid gap-6">
				<CashFlowDataTable date={date} />
				<CashFlowChart />
			</div>
		</div>
	)
}
