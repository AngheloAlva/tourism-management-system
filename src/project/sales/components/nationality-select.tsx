"use client"

import { Check, ChevronsUpDown } from "lucide-react"
import { useMemo, useState } from "react"

import { paises } from "../constants/paises"

import { cn } from "@/lib/utils"

import { Button } from "@/shared/components/ui/button"
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/shared/components/ui/command"
import { Input } from "@/shared/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover"

// Sentinel value for the "Otro" option. It must not collide with any real
// country name in `paises`. When selected, a free-text input is revealed and
// the typed value is stored directly in the nationality field.
export const OTRO_NACIONALIDAD = "__OTRO__"

// Strip diacritics so "peru" matches "Perú", "belgica" matches "Bélgica", etc.
function normalize(value: string) {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.trim()
}

interface NationalitySelectProps {
	name?: string
	value: string
	onChange: (value: string) => void
	onBlur?: () => void
	invalid?: boolean
}

export function NationalitySelect({ name, value, onChange, onBlur, invalid }: NationalitySelectProps) {
	const [open, setOpen] = useState(false)
	const [search, setSearch] = useState("")
	// Custom mode when there is a value that is not one of the listed countries
	// (covers editing a sale/reception saved with a typed country).
	const [isCustom, setIsCustom] = useState(value !== "" && !paises.includes(value))

	const filteredPaises = useMemo(() => {
		const query = normalize(search)
		if (!query) return paises
		return paises.filter((pais) => normalize(pais).includes(query))
	}, [search])

	const triggerLabel = isCustom ? "Otro (especificar)" : value

	const handleSelectCountry = (pais: string) => {
		setIsCustom(false)
		onChange(pais)
		setOpen(false)
		setSearch("")
	}

	const handleSelectOtro = () => {
		setIsCustom(true)
		onChange("")
		setOpen(false)
		setSearch("")
	}

	return (
		<div className="w-full space-y-2">
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						type="button"
						role="combobox"
						variant="outline"
						aria-expanded={open}
						aria-invalid={invalid}
						className="w-full justify-between font-normal"
					>
						{triggerLabel ? (
							<span className="truncate">{triggerLabel}</span>
						) : (
							<span className="text-muted-foreground">Seleccione la nacionalidad</span>
						)}
						<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</Button>
				</PopoverTrigger>

				<PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
					<Command shouldFilter={false}>
						<CommandInput
							placeholder="Buscar país..."
							value={search}
							onValueChange={setSearch}
						/>

						<CommandList>
							<CommandEmpty>No se encontraron países.</CommandEmpty>

							<CommandGroup>
								{filteredPaises.map((pais) => (
									<CommandItem
										key={pais}
										value={pais}
										onSelect={() => handleSelectCountry(pais)}
										className="flex items-center justify-between"
									>
										<span className="truncate">{pais}</span>
										<Check
											className={cn(
												"ml-2 h-4 w-4 shrink-0",
												!isCustom && value === pais ? "opacity-100" : "opacity-0"
											)}
										/>
									</CommandItem>
								))}
							</CommandGroup>

							<CommandGroup>
								<CommandItem
									value={OTRO_NACIONALIDAD}
									onSelect={handleSelectOtro}
									className="flex items-center justify-between"
								>
									<span>Otro (especificar)</span>
									<Check
										className={cn(
											"ml-2 h-4 w-4 shrink-0",
											isCustom ? "opacity-100" : "opacity-0"
										)}
									/>
								</CommandItem>
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>

			{isCustom && (
				<Input
					name={name}
					placeholder="Escribe el país"
					type="text"
					value={value}
					onBlur={onBlur}
					onChange={(e) => onChange(e.target.value)}
					aria-invalid={invalid}
				/>
			)}
		</div>
	)
}
