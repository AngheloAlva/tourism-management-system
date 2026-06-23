"use client"

import { useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, Filter, X, Download, Loader2 } from "lucide-react"
import type { DateRange } from "react-day-picker"
import { toast } from "sonner"

import { useSellers } from "@/project/billing/hooks/use-billing"
import { useTours } from "@/project/tours/hooks/use-tours"
import { exportAnalyticsSales, type AnalyticsFilters } from "../actions/analytics.actions"
import { MultiSelect } from "./multi-select"

import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover"
import { Calendar } from "@/shared/components/ui/calendar"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select"
import { cn } from "@/lib/utils"

interface AnalyticsFiltersProps {
	filters: AnalyticsFilters
	onFiltersChange: (filters: AnalyticsFilters) => void
}

const CHANNELS = [
	{ value: "ONLINE", label: "Online" },
	{ value: "AGENCY", label: "Agencia" },
	{ value: "PHYSICAL", label: "Físico" },
	{ value: "WHOLESALE", label: "Mayorista" },
]

const MODES = [
	{ value: "REGULAR", label: "Regular" },
	{ value: "PRIVATE", label: "Privado" },
]

export function AnalyticsFiltersComponent({ filters, onFiltersChange }: AnalyticsFiltersProps) {
	const [dateRange, setDateRange] = useState<DateRange | undefined>(
		filters.startDate && filters.endDate
			? { from: filters.startDate, to: filters.endDate }
			: undefined
	)
	const [isExporting, setIsExporting] = useState(false)

	const { data: sellers = [] } = useSellers()
	const { data: tours = [] } = useTours()

	const activeFiltersCount = [
		filters.sellerId,
		filters.channel,
		filters.mode,
		filters.startDate || filters.endDate,
		filters.tourIds?.length,
	].filter(Boolean).length

	const handleSellerChange = (value: string) => {
		onFiltersChange({
			...filters,
			sellerId: value === "all" ? undefined : value,
		})
	}

	const handleChannelChange = (value: string) => {
		onFiltersChange({
			...filters,
			channel: value === "all" ? undefined : (value as AnalyticsFilters["channel"]),
		})
	}

	const handleModeChange = (value: string) => {
		onFiltersChange({
			...filters,
			mode: value === "all" ? undefined : (value as AnalyticsFilters["mode"]),
		})
	}

	const handleTourChange = (selected: string[]) => {
		onFiltersChange({
			...filters,
			tourIds: selected.length > 0 ? selected : undefined,
		})
	}

	const handleDateRangeChange = (range: DateRange | undefined) => {
		setDateRange(range)
		onFiltersChange({
			...filters,
			startDate: range?.from,
			endDate: range?.to,
		})
	}

	const clearFilters = () => {
		setDateRange(undefined)
		onFiltersChange({})
	}

	const handleExport = async () => {
		try {
			setIsExporting(true)
			const data = await exportAnalyticsSales(filters)

			if (data.length === 0) {
				toast.error("No hay datos para exportar")
				return
			}

			// Create CSV content
			const headers = [
				"Fecha",
				"Voucher",
				"Tour",
				"Vendedor",
				"Canal",
				"Total",
				"Pasajeros",
				"Nacionalidades",
			]
			const csvContent = [
				headers.join(","),
				...data.map((row) =>
					[
						row.fecha,
						row.voucher,
						`"${row.tour}"`, // Quote to handle commas
						`"${row.vendedor}"`,
						row.canal,
						row.total,
						row.pasajeros,
						`"${row.nacionalidades}"`,
					].join(",")
				),
			].join("\n")

			// Download file
			const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
			const url = URL.createObjectURL(blob)
			const link = document.createElement("a")
			link.setAttribute("href", url)
			link.setAttribute("download", `ventas_analisis_${format(new Date(), "yyyyMMdd")}.csv`)
			link.style.visibility = "hidden"
			document.body.appendChild(link)
			link.click()
			document.body.removeChild(link)

			toast.success("Exportación completada")
		} catch (error) {
			console.error(error)
			toast.error("Error al exportar datos")
		} finally {
			setIsExporting(false)
		}
	}

	const tourOptions = tours.map((t) => ({ label: t.name, value: t.id }))

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-3">
				<Popover>
					<PopoverTrigger asChild>
						<Button
							variant="outline"
							className={cn(
								"w-[240px] justify-start text-left font-normal",
								!dateRange?.from && "text-muted-foreground"
							)}
						>
							<CalendarIcon className="h-4 w-4" />
							{dateRange?.from ? (
								dateRange.to ? (
									<>
										{format(dateRange.from, "d MMM", { locale: es })} -{" "}
										{format(dateRange.to, "d MMM yyyy", { locale: es })}
									</>
								) : (
									format(dateRange.from, "d MMM yyyy", { locale: es })
								)
							) : (
								<span>Seleccionar fechas</span>
							)}
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-auto p-0" align="start">
						<Calendar
							initialFocus
							mode="range"
							defaultMonth={dateRange?.from}
							selected={dateRange}
							onSelect={handleDateRangeChange}
							numberOfMonths={2}
							locale={es}
						/>
					</PopoverContent>
				</Popover>

				<Select value={filters.sellerId ?? "all"} onValueChange={handleSellerChange}>
					<SelectTrigger className="w-[200px]">
						<SelectValue placeholder="Vendedor" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Todos los vendedores</SelectItem>
						{sellers.map((seller) => (
							<SelectItem key={seller.id} value={seller.id}>
								{seller.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Select value={filters.channel ?? "all"} onValueChange={handleChannelChange}>
					<SelectTrigger className="w-[150px]">
						<SelectValue placeholder="Canal" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Todos los canales</SelectItem>
						{CHANNELS.map((channel) => (
							<SelectItem key={channel.value} value={channel.value}>
								{channel.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Select value={filters.mode ?? "all"} onValueChange={handleModeChange}>
					<SelectTrigger className="w-[170px]">
						<SelectValue placeholder="Modo" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Todos los modos</SelectItem>
						{MODES.map((mode) => (
							<SelectItem key={mode.value} value={mode.value}>
								{mode.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<div className="w-[250px]">
					<MultiSelect
						options={tourOptions}
						onChange={handleTourChange}
						selected={filters.tourIds || []}
						placeholder="Filtrar por Tours..."
					/>
				</div>

				{activeFiltersCount > 0 && (
					<div className="flex items-center gap-2">
						<Badge variant="secondary" className="gap-1">
							<Filter className="h-3 w-3" />
							{activeFiltersCount} filtro{activeFiltersCount > 1 ? "s" : ""}
						</Badge>
						<Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2">
							<X className="h-4 w-4" />
							<span className="sr-only">Limpiar filtros</span>
						</Button>
					</div>
				)}

				<div className="ml-auto">
					<Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
						{isExporting ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Download className="h-4 w-4" />
						)}
						Exportar Excel
					</Button>
				</div>
			</div>
		</div>
	)
}
