"use client"

import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { DateRange } from "react-day-picker"

import { Button } from "@/shared/components/ui/button"
import { Calendar } from "@/shared/components/ui/calendar"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover"

interface DateRangeValue {
	startDate: Date
	endDate: Date
}

interface CommissionDateFiltersProps {
	dateRange: DateRangeValue
	onDateRangeChange: (range: DateRangeValue) => void
}

export function CommissionDateFilters({ dateRange, onDateRangeChange }: CommissionDateFiltersProps) {
	const selectedRange: DateRange = {
		from: dateRange.startDate,
		to: dateRange.endDate,
	}

	const handleRangeChange = (range: DateRange | undefined) => {
		if (!range?.from) return
		onDateRangeChange({
			startDate: range.from,
			endDate: range.to ?? range.from,
		})
	}

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					className={cn(
						"w-[290px] justify-start text-left font-normal",
						!selectedRange.from && "text-muted-foreground"
					)}
				>
					<CalendarIcon className="h-4 w-4" />
					{selectedRange.from && selectedRange.to ? (
						<>
							{format(selectedRange.from, "dd/MM/yyyy", { locale: es })} -{" "}
							{format(selectedRange.to, "dd/MM/yyyy", { locale: es })}
						</>
					) : selectedRange.from ? (
						format(selectedRange.from, "dd/MM/yyyy", { locale: es })
					) : (
						"Seleccionar rango"
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar
					mode="range"
					selected={selectedRange}
					onSelect={handleRangeChange}
					numberOfMonths={2}
					locale={es}
					initialFocus
				/>
			</PopoverContent>
		</Popover>
	)
}
