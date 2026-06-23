"use client"

import { Check, Filter, X } from "lucide-react"

import {
	DropdownMenu,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSub,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuSeparator,
	DropdownMenuSubTrigger,
	DropdownMenuSubContent,
} from "@/shared/components/ui/dropdown-menu"
import { Badge } from "@/shared/components/ui/badge"
import { Button } from "@/shared/components/ui/button"
import { cn } from "@/lib/utils"

interface FilterOption {
	label: string
	value: string
}

interface FilterGroup {
	key: string
	label: string
	value: string
	allLabel: string
	options: FilterOption[]
	onChange: (nextValue: string) => void
}

interface TableFilterDropdownProps {
	groups: FilterGroup[]
	onClearAll?: () => void
	className?: string
	triggerLabel?: string
}

export function TableFilterDropdown({
	groups,
	onClearAll,
	className,
	triggerLabel = "Filtros",
}: TableFilterDropdownProps) {
	const activeFilters = groups
		.filter((group) => group.value && group.value !== "all")
		.map((group) => {
			const selectedOption = group.options.find((option) => option.value === group.value)
			return {
				key: group.key,
				label: group.label,
				valueLabel: selectedOption?.label ?? group.value,
				clear: () => group.onChange("all"),
			}
		})

	return (
		<div className={cn("flex flex-wrap items-center gap-2", className)}>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" className="gap-2">
						<Filter className="h-4 w-4" />
						{triggerLabel}
						{activeFilters.length > 0 ? (
							<Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
								{activeFilters.length}
							</Badge>
						) : null}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-56">
					<DropdownMenuLabel>Filtros</DropdownMenuLabel>
					<DropdownMenuSeparator />
					{groups.map((group) => (
						<DropdownMenuSub key={group.key}>
							<DropdownMenuSubTrigger>{group.label}</DropdownMenuSubTrigger>
							<DropdownMenuSubContent className="max-h-52 overflow-y-auto">
								<DropdownMenuItem onClick={() => group.onChange("all")}>
									<span>{group.allLabel}</span>
									{group.value === "all" || !group.value ? (
										<Check className="ml-auto h-4 w-4" />
									) : null}
								</DropdownMenuItem>
								{group.options.map((option) => (
									<DropdownMenuItem key={option.value} onClick={() => group.onChange(option.value)}>
										<span>{option.label}</span>
										{group.value === option.value ? <Check className="ml-auto h-4 w-4" /> : null}
									</DropdownMenuItem>
								))}
							</DropdownMenuSubContent>
						</DropdownMenuSub>
					))}
					{onClearAll && activeFilters.length > 0 ? (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={onClearAll}>Limpiar filtros</DropdownMenuItem>
						</>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>

			{activeFilters.map((activeFilter) => (
				<Badge
					key={activeFilter.key}
					variant="outline"
					onClick={activeFilter.clear}
					className="group dark:hover:border-primary/60 dark:hover:bg-primary/20 cursor-pointer gap-1 px-2 py-1 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 dark:hover:text-orange-200"
				>
					<span className="text-muted-foreground group-hover:text-orange-600 dark:group-hover:text-orange-200">
						{activeFilter.label}:
					</span>
					<span>{activeFilter.valueLabel}</span>
					<X className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" />
				</Badge>
			))}
		</div>
	)
}
