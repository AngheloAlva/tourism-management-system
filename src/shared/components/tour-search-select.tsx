"use client"

import { Check, ChevronsUpDown, MapPin, Bus } from "lucide-react"
import { useState, useMemo } from "react"

import type { ActiveTour } from "@/project/tours/actions/tour.actions"
import { cn } from "@/lib/utils"

import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover"
import { Button } from "@/shared/components/ui/button"
import {
	Command,
	CommandItem,
	CommandList,
	CommandInput,
	CommandGroup,
	CommandEmpty,
} from "@/shared/components/ui/command"

interface TourSearchSelectProps {
	tours: ActiveTour[] | undefined
	value?: string
	disabled?: boolean
	placeholder?: string
	onValueChange: (value: string) => void
	onTourSelect?: (tour: ActiveTour | null) => void
}

interface TourGroup {
	label: string
	icon: React.ReactNode
	tours: ActiveTour[]
}

function groupTours(tours: ActiveTour[]): TourGroup[] {
	const groups: TourGroup[] = []

	const tourItems = tours.filter((t) => t.serviceKind === "TOUR")
	const transferIn = tours.filter((t) => t.serviceKind === "TRANSFER" && t.direction === "IN")
	const transferOut = tours.filter((t) => t.serviceKind === "TRANSFER" && t.direction === "OUT")

	if (tourItems.length > 0) {
		groups.push({
			label: "Tours",
			icon: <MapPin className="text-muted-foreground size-3.5" />,
			tours: tourItems,
		})
	}

	if (transferIn.length > 0) {
		groups.push({
			label: "Transfer In",
			icon: <Bus className="text-muted-foreground size-3.5" />,
			tours: transferIn,
		})
	}

	if (transferOut.length > 0) {
		groups.push({
			label: "Transfer Out",
			icon: <Bus className="text-muted-foreground size-3.5 scale-x-[-1]" />,
			tours: transferOut,
		})
	}

	return groups
}

export function TourSearchSelect({
	tours,
	value,
	disabled = false,
	placeholder = "Buscar tour o transfer...",
	onValueChange,
	onTourSelect,
}: TourSearchSelectProps) {
	const [open, setOpen] = useState(false)
	const [search, setSearch] = useState("")

	const selectedTour = useMemo(() => tours?.find((t) => t.id === value), [tours, value])

	const filteredGroups = useMemo(() => {
		if (!tours) return []

		const query = search.toLowerCase().trim()
		const filtered = query ? tours.filter((t) => t.name.toLowerCase().includes(query)) : tours

		return groupTours(filtered)
	}, [tours, search])

	const handleSelect = (tourId: string) => {
		const isDeselect = tourId === value
		onValueChange(isDeselect ? "" : tourId)
		onTourSelect?.(isDeselect ? null : tours?.find((t) => t.id === tourId) ?? null)
		setOpen(false)
		setSearch("")
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					role="combobox"
					variant="outline"
					disabled={disabled}
					aria-expanded={open}
					className="w-full justify-between"
				>
					{selectedTour ? (
						<span className="flex items-center gap-2 truncate">
							{selectedTour.serviceKind === "TOUR" ? (
								<MapPin className="size-3.5 shrink-0" />
							) : (
								<Bus className="size-3.5 shrink-0" />
							)}
							<span className="truncate">{selectedTour.name}</span>
						</span>
					) : (
						<span className="text-muted-foreground">{placeholder}</span>
					)}
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>

			<PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
				<Command shouldFilter={false}>
					<CommandInput
						placeholder="Buscar por nombre..."
						value={search}
						onValueChange={setSearch}
					/>

					<CommandList>
						<CommandEmpty>No se encontraron resultados.</CommandEmpty>

						{filteredGroups.map((group) => (
							<CommandGroup
								key={group.label}
								heading={
									<span className="flex items-center gap-1.5">
										{group.icon}
										{group.label}
									</span>
								}
							>
								{group.tours.map((tour) => (
									<CommandItem
										key={tour.id}
										value={tour.id}
										onSelect={() => handleSelect(tour.id)}
										className="flex items-center justify-between"
									>
										<span className="truncate">{tour.name}</span>
										<Check
											className={cn(
												"ml-2 h-4 w-4 shrink-0",
												value === tour.id ? "opacity-100" : "opacity-0"
											)}
										/>
									</CommandItem>
								))}
							</CommandGroup>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	)
}
