"use client"

import dynamic from "next/dynamic"
import { BarChart3 } from "lucide-react"
import { useState } from "react"

import { AnalyticsFiltersComponent } from "@/project/analytics/components/analytics-filters"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"
import { AnalyticsSummary } from "@/project/analytics/components/analytics-summary"
import { BillingSummary } from "@/project/billing/components/billing-summary"
import { CustomersMap } from "@/project/analytics/components/customers-map"

const BookingLeadTimeChart = dynamic(
	() =>
		import("@/project/analytics/components/booking-lead-time-chart").then((m) => ({
			default: m.BookingLeadTimeChart,
		})),
	{ ssr: false }
)

const TopToursByMonthChart = dynamic(
	() =>
		import("@/project/analytics/components/top-tours-by-month-chart").then((m) => ({
			default: m.TopToursByMonthChart,
		})),
	{ ssr: false }
)

const SalesEvolutionChart = dynamic(
	() =>
		import("@/project/analytics/components/sales-evolution-chart").then((m) => ({
			default: m.SalesEvolutionChart,
		})),
	{ ssr: false }
)

const PaymentMethodsChart = dynamic(
	() =>
		import("@/project/analytics/components/payment-methods-chart").then((m) => ({
			default: m.PaymentMethodsChart,
		})),
	{ ssr: false }
)

const SalesBySellerChart = dynamic(
	() =>
		import("@/project/billing/components/sales-by-seller-chart").then((m) => ({
			default: m.SalesBySellerChart,
		})),
	{ ssr: false }
)

const SalesByDateChart = dynamic(
	() =>
		import("@/project/billing/components/sales-by-date-chart").then((m) => ({
			default: m.SalesByDateChart,
		})),
	{ ssr: false }
)

const ToursTreemap = dynamic(
	() =>
		import("@/project/analytics/components/tours-treemap").then((m) => ({
			default: m.ToursTreemap,
		})),
	{ ssr: false }
)

import type { AnalyticsFilters } from "@/project/analytics/actions/analytics.actions"
import type { BillingFilters } from "@/project/billing/actions/billing.actions"

export default function AnalyticsPage() {
	const [filters, setFilters] = useState<AnalyticsFilters>({})
	const [salesFilters, setSalesFilters] = useState<AnalyticsFilters>({})
	const [activeTab, setActiveTab] = useState("overview")

	// Convertir AnalyticsFilters a BillingFilters para componentes de billing
	const billingFilters: BillingFilters = {
		startDate: salesFilters.startDate,
		endDate: salesFilters.endDate,
		sellerId: salesFilters.sellerId,
		channel: salesFilters.channel,
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
						<BarChart3 className="h-6 w-6" />
						Análisis de Datos
					</h1>
					<p className="text-muted-foreground">
						Visualiza el rendimiento del negocio, ventas y patrones de clientes
					</p>
				</div>
			</div>

			<Tabs value={activeTab} onValueChange={setActiveTab}>
				{/*<TabsList className="grid w-full grid-cols-2">
					<TabsTrigger value="overview">Panorama General</TabsTrigger>
					<TabsTrigger value="sales">Análisis de Ventas</TabsTrigger>
				</TabsList>*/}

				{/*<TabsContent value="overview" className="space-y-6 pt-4">*/}
				<AnalyticsFiltersComponent filters={filters} onFiltersChange={setFilters} />

				<AnalyticsSummary filters={filters} />

				<div className="grid gap-6 lg:grid-cols-2">
					<div className="lg:col-span-2">
						<SalesEvolutionChart filters={filters} />
					</div>

					<div className="lg:col-span-2">
						<TopToursByMonthChart filters={filters} />
					</div>

					<PaymentMethodsChart filters={filters} />
					<BookingLeadTimeChart filters={filters} />

					<CustomersMap filters={filters} />
					<ToursTreemap filters={filters} />

					<SalesBySellerChart filters={filters} />
				</div>
				{/*</TabsContent>*/}

				{/*<TabsContent value="sales" className="space-y-6 pt-4">
					<AnalyticsFiltersComponent filters={salesFilters} onFiltersChange={setSalesFilters} />

					<BillingSummary filters={billingFilters} />

					<div className="grid gap-6 lg:grid-cols-2">
						<SalesByDateChart filters={billingFilters} groupBy="day" />
						<SalesBySellerChart filters={billingFilters} />
					</div>
				</TabsContent>*/}
			</Tabs>
		</div>
	)
}
