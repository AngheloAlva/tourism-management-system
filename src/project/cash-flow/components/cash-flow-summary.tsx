"use client"

import { Wallet, Banknote, CreditCard, Landmark, CircleDollarSign } from "lucide-react"

import { useCashFlowSummary } from "../hooks/use-cash-flow"

import { DashboardStatCard } from "@/shared/components/ui/dashboard-stat-card"
import { InsightsSkeleton } from "@/shared/components/ui/insights-skeleton"

interface CashFlowSummaryProps {
	date?: Date
}

export function CashFlowSummary({ date }: CashFlowSummaryProps) {
	const { data: summary, isLoading } = useCashFlowSummary(date)

	if (isLoading) {
		return <InsightsSkeleton count={5} />
	}

	if (!summary) return null

	const formatCurrency = (amount: number) =>
		new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(amount)
	const formatUsd = (amount: number) =>
		new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
	const effectiveSubtotal =
		summary.todayIncomeCash +
		summary.todayExchangeClp -
		summary.todayDeposits -
		summary.todayExpenses

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
			<DashboardStatCard
				title="Total"
				value={formatCurrency(summary.todayIncome)}
				description={`Efec. ${formatCurrency(summary.todayIncomeCash)} • Tarj. ${formatCurrency(summary.todayIncomeCard)} • Transfer. ${formatCurrency(summary.todayIncomeTransfer)}`}
				icon={Wallet}
				iconClassName="text-amber-500"
				iconWrapperClassName="bg-amber-500/30"
			/>

			<DashboardStatCard
				title="Efectivo"
				value={formatCurrency(summary.todayIncomeCash)}
				description={`Depositos -${formatCurrency(summary.todayDeposits)} • Gastos -${formatCurrency(summary.todayExpenses)} • Subtotal ${formatCurrency(effectiveSubtotal)}`}
				icon={Banknote}
				iconClassName="text-emerald-500"
				iconWrapperClassName="bg-emerald-500/30"
			/>

			<DashboardStatCard
				title="Tarjeta"
				value={formatCurrency(summary.todayIncomeCard)}
				description={`Credito ${formatCurrency(summary.todayIncomeCreditCard)} • Debito ${formatCurrency(summary.todayIncomeDebitCard)}`}
				icon={CreditCard}
				iconClassName="text-blue-500"
				iconWrapperClassName="bg-blue-500/30"
			/>

			<DashboardStatCard
				title="Transferencia"
				value={formatCurrency(summary.todayIncomeTransfer)}
				description={`${summary.todayIncomeTransferCount} movimiento(s)`}
				icon={Landmark}
				iconClassName="text-violet-500"
				iconWrapperClassName="bg-violet-500/30"
			/>

			<DashboardStatCard
				title="USD Disponible"
				value={formatUsd(summary.currentUsdBalance)}
				description="Saldo actual para cambios y control diario"
				icon={CircleDollarSign}
				iconClassName="text-amber-600"
				iconWrapperClassName="bg-amber-500/30"
			/>
		</div>
	)
}
