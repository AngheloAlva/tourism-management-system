"use client"

import { FilterXIcon } from "lucide-react"

import { useCommissionOperators } from "../hooks/use-commissions"

import { Button } from "@/shared/components/ui/button"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select"

import type { CommissionKind } from "../types/commission.types"

interface CommissionOperatorFilterProps {
	kind: CommissionKind
	operatorId: string
	onOperatorChange: (operatorId: string) => void
	dateRange: { startDate: Date; endDate: Date }
}

export function CommissionOperatorFilter({
	kind,
	operatorId,
	onOperatorChange,
	dateRange,
}: CommissionOperatorFilterProps) {
	const { data: operators, isLoading } = useCommissionOperators(kind, dateRange)

	const handleChange = (value: string) => {
		onOperatorChange(value === "all" ? "" : value)
	}

	return (
		<div className="flex items-center gap-2">
			<Select
				value={operatorId || "all"}
				onValueChange={handleChange}
				disabled={isLoading}
			>
				<SelectTrigger className="w-[260px]">
					<SelectValue placeholder="Seleccionar operadora" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">Todas las operadoras</SelectItem>
					{(operators || []).map((operator) => (
						<SelectItem key={operator.id} value={operator.id}>
							{operator.name} ({operator.bookingsCount} eventos)
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			{operatorId && (
				<Button
					variant="ghost"
					size="sm"
					className="h-8 gap-1.5"
					onClick={() => onOperatorChange("")}
				>
					<FilterXIcon className="h-3.5 w-3.5" />
					Limpiar
				</Button>
			)}
		</div>
	)
}
