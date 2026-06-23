"use client"

import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { useState, useEffect, useCallback } from "react"

import { useDebounce } from "@/shared/hooks/use-debounce"
import { cn } from "@/lib/utils"
import {
	searchAgencies,
	type AgencySearchResult,
} from "@/project/agency/actions/search-agencies.actions"
import { searchTransferAgencies } from "@/project/transfer-agencies/actions/search-transfer-agencies.actions"

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

interface AgencySearchSelectProps {
	value?: string
	disabled?: boolean
	activeOnly?: boolean
	agencyCatalog?: "WHOLESALE" | "TRANSFER"
	placeholder?: string
	showCodePrefix?: boolean
	onValueChange: (value: string) => void
	setCodePrefix?: (prefix: string) => void
	setCodeLength?: (length: number) => void
	onAgencySelect?: (agency: AgencySearchResult | null) => void
}

export function AgencySearchSelect({
	value,
	onValueChange,
	onAgencySelect,
	setCodePrefix,
	setCodeLength,
	disabled = false,
	activeOnly = true,
	agencyCatalog = "WHOLESALE",
	showCodePrefix = false,
	placeholder = "Buscar agencia...",
}: AgencySearchSelectProps) {
	const [agencies, setAgencies] = useState<AgencySearchResult[]>([])
	const [searchQuery, setSearchQuery] = useState("")
	const [isLoading, setIsLoading] = useState(false)
	const [open, setOpen] = useState(false)

	const debouncedSearch = useDebounce(searchQuery, 300)

	const selectedAgency = agencies.find((a) => a.id === value)

	const fetchAgencies = useCallback(
		async (query: string) => {
			setIsLoading(true)
			try {
				const results =
					agencyCatalog === "TRANSFER"
						? await searchTransferAgencies(query, activeOnly)
						: await searchAgencies(query, activeOnly)
				setAgencies(results)
			} catch (error) {
				console.error("Error fetching agencies:", error)
				setAgencies([])
			} finally {
				setIsLoading(false)
			}
		},
		[activeOnly, agencyCatalog]
	)

	useEffect(() => {
		void fetchAgencies("")
	}, [fetchAgencies])

	useEffect(() => {
		if (open && agencies.length === 0) {
			fetchAgencies("")
		}
	}, [open, agencies.length, fetchAgencies])

	useEffect(() => {
		if (open) {
			fetchAgencies(debouncedSearch)
		}
	}, [debouncedSearch, open, fetchAgencies])

	const handleSelect = (agencyId: string) => {
		const newAgency = agencies.find((a) => a.id === agencyId)
		onValueChange(agencyId === value ? "" : agencyId)
		onAgencySelect?.(agencyId === value ? null : newAgency || null)
		setOpen(false)
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
					{selectedAgency ? (
						<span className="flex items-center gap-2">
							<span>{selectedAgency.name}</span>
							{showCodePrefix && selectedAgency.codePrefix && (
								<span className="text-muted-foreground text-xs">({selectedAgency.codePrefix})</span>
							)}
						</span>
					) : (
						placeholder
					)}
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>

			<PopoverContent className="w-[400px] p-0" align="start">
				<Command shouldFilter={false}>
					<div className="flex items-center justify-between border-b pr-3 pb-2">
						<CommandInput
							placeholder="Buscar por nombre, teléfono o código..."
							value={searchQuery}
							onValueChange={setSearchQuery}
							className="min-w-[360px] border-0 focus:ring-0"
						/>
						{isLoading && <Loader2 className="h-4 w-4 animate-spin opacity-50" />}
					</div>

					<CommandList>
						<CommandEmpty>{isLoading ? "Buscando..." : "No se encontraron agencias."}</CommandEmpty>
						<CommandGroup>
							{agencies.map((agency) => (
								<CommandItem
									key={agency.id}
									value={agency.id}
									onSelect={() => {
										handleSelect(agency.id)
										setCodePrefix?.(agency.codePrefix || "")
										setCodeLength?.(agency.codeLength || 0)
									}}
									className="flex items-center justify-between"
								>
									<div className="flex flex-col gap-1">
										<div className="flex items-center gap-2">
											<span className="font-medium">{agency.name}</span>
											{agency.codePrefix && (
												<span className="text-muted-foreground text-xs">({agency.codePrefix})</span>
											)}
										</div>
										{agency.contactEmails.length > 0 && (
											<span className="text-muted-foreground text-xs">
												{agency.contactEmails[0]}
											</span>
										)}
										{agency.phone && (
											<span className="text-muted-foreground text-xs">Tel: {agency.phone}</span>
										)}
									</div>
									<Check
										className={cn(
											"ml-2 h-4 w-4",
											value === agency.id ? "opacity-100" : "opacity-0"
										)}
									/>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	)
}
