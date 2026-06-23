"use client"

import { Check, ChevronsUpDown } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/shared/components/ui/button"
import {
	Command,
	CommandItem,
	CommandList,
	CommandEmpty,
	CommandGroup,
	CommandInput,
} from "@/shared/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover"
import { Badge } from "@/shared/components/ui/badge"

export type Option = {
	label: string
	value: string
}

interface MultiSelectProps {
	options: Option[]
	selected: string[]
	onChange: (selected: string[]) => void
	placeholder?: string
	className?: string
}

export function MultiSelect({
	options,
	selected,
	onChange,
	placeholder = "Seleccionar...",
	className,
}: MultiSelectProps) {
	const [open, setOpen] = React.useState(false)

	const handleSelect = (value: string) => {
		const newSelected = selected.includes(value)
			? selected.filter((item) => item !== value)
			: [...selected, value]
		onChange(newSelected)
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className={cn("h-auto min-h-10 w-full justify-between", className)}
				>
					<div className="flex flex-wrap gap-1">
						{selected.length === 0 && <span className="text-muted-foreground">{placeholder}</span>}
						{selected.length > 0 &&
							selected.length <= 3 &&
							selected.map((value) => (
								<Badge variant="secondary" key={value} className="mr-1 mb-1">
									{options.find((opt) => opt.value === value)?.label || value}
								</Badge>
							))}
						{selected.length > 3 && (
							<Badge variant="secondary" className="mr-1">
								{selected.length} seleccionados
							</Badge>
						)}
					</div>
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[300px] p-0">
				<Command>
					<CommandInput placeholder="Buscar..." />
					<CommandList>
						<CommandEmpty>No se encontraron resultados.</CommandEmpty>
						<CommandGroup className="max-h-64 overflow-auto">
							{options.map((option) => (
								<CommandItem
									key={option.value}
									value={option.label} // Serach by label
									onSelect={() => handleSelect(option.value)}
								>
									<Check
										className={cn(
											"mr-2 h-4 w-4",
											selected.includes(option.value) ? "opacity-100" : "opacity-0"
										)}
									/>
									{option.label}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	)
}
