"use client"

import { BuildingIcon, CalendarIcon, CheckIcon, FilterXIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"
import { es } from "date-fns/locale"
import { format } from "date-fns"

import { useAgenciesWithSales } from "../hooks/use-payment-statements"
import { cn } from "@/lib/utils"

import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover"
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/shared/components/ui/command"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select"
import { Calendar } from "@/shared/components/ui/calendar"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"

import type { PaymentStatementFilters } from "../types/payment-statement.types"

interface PaymentStatementFiltersComponentProps {
	filters: PaymentStatementFilters
	onFiltersChange: (filters: PaymentStatementFilters) => void
}

export function PaymentStatementFiltersComponent({
	filters,
	onFiltersChange,
}: PaymentStatementFiltersComponentProps) {
	const { data: agencies, isLoading: isLoadingAgencies } = useAgenciesWithSales()

	const dateRange: DateRange = {
		from: filters.startDate,
		to: filters.endDate,
	}

	const selectedIds = new Set(filters.agencyIds ?? [])
	const selectedAgencies = (agencies ?? []).filter((a) => selectedIds.has(a.id))

	const handleRangeChange = (range: DateRange | undefined) => {
		if (!range?.from) return

		onFiltersChange({
			...filters,
			startDate: range.from,
			endDate: range.to ?? range.from,
		})
	}

	const toggleAgency = (agencyId: string) => {
		const next = new Set(selectedIds)
		if (next.has(agencyId)) next.delete(agencyId)
		else next.add(agencyId)
		onFiltersChange({
			...filters,
			agencyIds: next.size > 0 ? Array.from(next) : undefined,
		})
	}

	const clearAgencies = () => {
		onFiltersChange({ ...filters, agencyIds: undefined })
	}

	const handleStatusChange = (value: string) => {
		onFiltersChange({
			...filters,
			status: value as PaymentStatementFilters["status"],
		})
	}

	const hasActiveFilters = !!(
		(filters.agencyIds && filters.agencyIds.length > 0) ||
		(filters.status && filters.status !== "all")
	)

	const agencyTriggerLabel =
		selectedAgencies.length === 0
			? "Todas las agencias"
			: selectedAgencies.length === 1
				? selectedAgencies[0].name
				: `${selectedAgencies.length} agencias`

	return (
		<div className="flex flex-wrap items-center gap-3">
			<Popover>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						className={cn(
							"w-[290px] justify-start text-left font-normal",
							!dateRange.from && "text-muted-foreground"
						)}
					>
						<CalendarIcon className="h-4 w-4" />
						{dateRange.from && dateRange.to ? (
							<>
								{format(dateRange.from, "dd/MM/yyyy", { locale: es })} -{" "}
								{format(dateRange.to, "dd/MM/yyyy", { locale: es })}
							</>
						) : dateRange.from ? (
							format(dateRange.from, "dd/MM/yyyy", { locale: es })
						) : (
							"Seleccionar rango"
						)}
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-auto p-0" align="start">
					<Calendar
						mode="range"
						selected={dateRange}
						onSelect={handleRangeChange}
						numberOfMonths={2}
						locale={es}
						initialFocus
					/>
				</PopoverContent>
			</Popover>

			<Popover>
				<PopoverTrigger asChild>
					<Button variant="outline" className="min-w-[220px] justify-start">
						<BuildingIcon className="h-4 w-4" />
						<span className="truncate">{agencyTriggerLabel}</span>
						{selectedAgencies.length > 0 && (
							<Badge variant="secondary" className="ml-auto">
								{selectedAgencies.length}
							</Badge>
						)}
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-[280px] p-0" align="start">
					<Command>
						<CommandInput placeholder="Buscar agencia..." />
						<CommandList>
							<CommandEmpty>
								{isLoadingAgencies ? "Cargando..." : "Sin agencias"}
							</CommandEmpty>
							<CommandGroup>
								{(agencies ?? []).map((agency) => {
									const isSelected = selectedIds.has(agency.id)
									return (
										<CommandItem
											key={agency.id}
											value={agency.name}
											onSelect={() => toggleAgency(agency.id)}
										>
											<div
												className={cn(
													"mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
													isSelected
														? "bg-primary border-primary text-primary-foreground"
														: "opacity-50"
												)}
											>
												{isSelected && <CheckIcon className="h-3 w-3" />}
											</div>
											<span className="flex-1 truncate">{agency.name}</span>
											<span className="text-muted-foreground ml-2 text-xs">
												{agency.salesCount}
											</span>
										</CommandItem>
									)
								})}
							</CommandGroup>
							{selectedAgencies.length > 0 && (
								<div className="border-t p-1">
									<Button
										variant="ghost"
										size="sm"
										className="w-full justify-center text-xs"
										onClick={clearAgencies}
									>
										Limpiar selección
									</Button>
								</div>
							)}
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>

			<Select value={filters.status ?? "all"} onValueChange={handleStatusChange}>
				<SelectTrigger className="w-[180px]">
					<SelectValue placeholder="Estado" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">Todos los estados</SelectItem>
					<SelectItem value="paid">Pagados</SelectItem>
					<SelectItem value="pending">Pendientes</SelectItem>
					<SelectItem value="generated">Documentos generados</SelectItem>
				</SelectContent>
			</Select>

			{hasActiveFilters ? (
				<Button
					variant="ghost"
					size="sm"
					className="h-8 gap-1.5"
					onClick={() =>
						onFiltersChange({
							...filters,
							agencyIds: undefined,
							status: "all",
						})
					}
				>
					<FilterXIcon className="h-3.5 w-3.5" />
					Limpiar
				</Button>
			) : null}
		</div>
	)
}
