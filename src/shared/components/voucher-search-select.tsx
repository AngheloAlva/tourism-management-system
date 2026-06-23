"use client"

import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { useState, useEffect, useCallback } from "react"

import { useDebounce } from "@/shared/hooks/use-debounce"
import { cn } from "@/lib/utils"
import {
	searchVouchers,
	type VoucherSearchResult,
} from "@/project/sales/actions/search-vouchers.actions"

import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover"
import { Button } from "@/shared/components/ui/button"
import {
	Command,
	CommandList,
	CommandItem,
	CommandEmpty,
	CommandGroup,
	CommandInput,
} from "@/shared/components/ui/command"

interface VoucherSearchSelectProps {
	value?: string
	onValueChange: (value: string) => void
	placeholder?: string
	type?: "SALE" | "QUOTE"
	disabled?: boolean
}

export function VoucherSearchSelect({
	value,
	onValueChange,
	placeholder = "Buscar voucher...",
	type,
	disabled = false,
}: VoucherSearchSelectProps) {
	const [open, setOpen] = useState(false)
	const [searchQuery, setSearchQuery] = useState("")
	const [vouchers, setVouchers] = useState<VoucherSearchResult[]>([])
	const [isLoading, setIsLoading] = useState(false)

	const debouncedSearch = useDebounce(searchQuery, 300)

	const selectedVoucher = vouchers.find((v) => v.id === value)

	const fetchVouchers = useCallback(
		async (query: string) => {
			setIsLoading(true)
			try {
				const results = await searchVouchers(query, type)
				setVouchers(results)
			} catch (error) {
				console.error("Error fetching vouchers:", error)
				setVouchers([])
			} finally {
				setIsLoading(false)
			}
		},
		[type]
	)

	useEffect(() => {
		void fetchVouchers("")
	}, [fetchVouchers])

	useEffect(() => {
		if (open && vouchers.length === 0) {
			void fetchVouchers("")
		}
	}, [open, vouchers.length, fetchVouchers])

	useEffect(() => {
		if (open) {
			void fetchVouchers(debouncedSearch)
		}
	}, [debouncedSearch, open, fetchVouchers])

	const handleSelect = (voucherId: string) => {
		onValueChange(voucherId === value ? "" : voucherId)
		setOpen(false)
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className="w-full justify-between"
					disabled={disabled}
				>
					{selectedVoucher ? (
						<span className="flex items-center gap-2">
							<span className="font-semibold">#{selectedVoucher.voucher}</span>
							{selectedVoucher.passengerNames.length > 0 && (
								<span className="text-muted-foreground text-sm">
									- {selectedVoucher.passengerNames[0]}
									{selectedVoucher.passengerNames.length > 1 &&
										` +${selectedVoucher.passengerNames.length - 1}`}
								</span>
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
					<div className="flex items-center justify-between border-b px-3">
						<CommandInput
							placeholder="Buscar por voucher, email o nombre..."
							value={searchQuery}
							onValueChange={setSearchQuery}
							className="border-0 focus:ring-0"
						/>
						{isLoading && <Loader2 className="h-4 w-4 animate-spin opacity-50" />}
					</div>
					<CommandList>
						<CommandEmpty>{isLoading ? "Buscando..." : "No se encontraron vouchers."}</CommandEmpty>
						<CommandGroup>
							{vouchers.map((voucher) => (
								<CommandItem
									key={voucher.id}
									value={voucher.id}
									onSelect={() => handleSelect(voucher.id)}
									className="flex items-center justify-between"
								>
									<div className="flex flex-col gap-0.5">
										<div className="flex items-center gap-2">
											<span className="font-semibold">V-{voucher.voucher}</span>
											<span className="text-muted-foreground text-xs">
												{voucher.eventCount} evento{voucher.eventCount !== 1 ? "s" : ""}
											</span>
										</div>
										{voucher.passengerNames.length > 0 && (
											<span className="text-muted-foreground text-sm">
												{voucher.passengerNames.slice(0, 2).join(", ")}
												{voucher.passengerNames.length > 2 &&
													` +${voucher.passengerNames.length - 2} más`}
											</span>
										)}
										{voucher.clientEmail && (
											<span className="text-muted-foreground text-xs">{voucher.clientEmail}</span>
										)}
									</div>
									<Check
										className={cn(
											"ml-2 h-4 w-4",
											value === voucher.id ? "opacity-100" : "opacity-0"
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
