"use client"

import { useState, useTransition } from "react"
import { PencilIcon, Loader2Icon, ChevronsUpDownIcon, CheckIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/shared/components/ui/button"
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/shared/components/ui/popover"
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/shared/components/ui/command"
import { resolveAgencyTargetColumnClient } from "@/project/sales/utils/agency-target-column"

/** Minimal sale shape needed for agency resolution */
interface SaleForAgencyEdit {
	channel: string
	isWholesale: boolean
	agency: { id: string; name: string } | null
	wholesaleAgency: { id: string; name: string } | null
	updatedAt: Date
}

type SaveResult = { success: true } | { success: false; error: string }

/** Minimal agency shape needed by this component */
interface AgencyOption {
	id: string
	name: string
}

interface InlineEditableAgencyProps {
	/** The sale record (channel + isWholesale + agency data used to determine editability) */
	sale: SaleForAgencyEdit
	/** Full list of active agencies to show in the picker */
	agencies: AgencyOption[]
	/** Called when user selects a new agency. Return the action result. */
	onSave: (agencyId: string | null, expectedUpdatedAt: Date) => Promise<SaveResult>
	/** When true, disables the combobox regardless of channel */
	disabled?: boolean
	/** Additional class names */
	className?: string
}

/**
 * InlineEditableAgency — channel-locked agency combobox.
 *
 * Pattern:
 * - Determines editability via resolveAgencyTargetColumn(sale).
 * - Disabled tooltip: "Esta venta no acepta cambio de agencia" when not eligible.
 * - Open: shows a Popover+Command combobox listing all active agencies.
 * - Select: commits immediately with optimistic update + updatedAt token.
 * - Error: reverts to previous display name.
 *
 * Used for: agencyId (WHOLESALE) and wholesaleAgencyId (ONLINE/PHYSICAL + isWholesale).
 */
export function InlineEditableAgency({
	sale,
	agencies,
	onSave,
	disabled = false,
	className,
}: InlineEditableAgencyProps) {
	const targetColumn = resolveAgencyTargetColumnClient(sale)
	const isEditable = !disabled && targetColumn !== null

	// Derive the current displayed agency name from the sale
	const currentAgency =
		targetColumn === "agencyId"
			? sale.agency
			: targetColumn === "wholesaleAgencyId"
			? sale.wholesaleAgency
			: null

	const [open, setOpen] = useState(false)
	const [displayAgency, setDisplayAgency] = useState<{ id: string; name: string } | null>(
		currentAgency ?? null
	)
	const [isPending, startTransition] = useTransition()

	// Label shown in the button
	const label =
		targetColumn === "wholesaleAgencyId" ? "Agencia referidora" : "Agencia"

	// Accent + case insensitive comparator used by cmdk's filter. cmdk's
	// default fuzzy scorer was hiding agencies whose names did not pass its
	// scoring (e.g. accented chars), so we replace it with a normalized
	// substring match: any agency that contains the typed query (ignoring
	// case and tildes) is shown.
	const normalize = (s: string) =>
		s
			.toLowerCase()
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")

	const commandFilter = (value: string, search: string) =>
		normalize(value).includes(normalize(search)) ? 1 : 0

	const handleSelect = (agencyId: string) => {
		// Dirty check — picking the currently selected agency is a no-op.
		if (displayAgency?.id === agencyId) {
			setOpen(false)
			return
		}

		const selected = agencies.find((a) => a.id === agencyId) ?? null
		const previous = displayAgency

		// Optimistic
		setDisplayAgency(selected)
		setOpen(false)

		startTransition(async () => {
			const result = await onSave(agencyId, sale.updatedAt)
			if (!result.success) {
				// Rollback
				setDisplayAgency(previous)
			}
		})
	}

	const handleClear = () => {
		// Dirty check — clearing when already empty is a no-op.
		if (displayAgency === null) {
			setOpen(false)
			return
		}

		const previous = displayAgency

		// Optimistic
		setDisplayAgency(null)
		setOpen(false)

		startTransition(async () => {
			const result = await onSave(null, sale.updatedAt)
			if (!result.success) {
				setDisplayAgency(previous)
			}
		})
	}

	if (!isEditable) {
		return (
			<div
				data-testid="inline-edit-agency"
				className={cn("flex items-center gap-1.5 opacity-70", className)}
				title="Esta venta no acepta cambio de agencia"
			>
				<span className="text-muted-foreground text-sm italic">
					{currentAgency?.name ?? "Sin agencia"}
				</span>
			</div>
		)
	}

	return (
		<div
			data-testid="inline-edit-agency"
			className={cn("group flex items-center gap-1.5", isPending && "opacity-50", className)}
		>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="ghost"
						role="combobox"
						aria-expanded={open}
						aria-label={`Editar ${label}`}
						disabled={isPending}
						className={cn(
							"h-auto gap-1.5 px-0 py-0 text-sm font-normal",
							"hover:bg-transparent"
						)}
					>
						<span
							className={cn(
								!displayAgency?.name && "text-muted-foreground italic"
							)}
						>
							{displayAgency?.name ?? `Sin ${label.toLowerCase()}`}
						</span>
						{isPending ? (
							<Loader2Icon className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
						) : (
							<PencilIcon className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
						)}
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-[280px] p-0" align="end">
					<Command filter={commandFilter}>
						<CommandInput placeholder={`Buscar ${label.toLowerCase()}...`} />
						<CommandList>
							<CommandEmpty>No se encontraron agencias.</CommandEmpty>
							<CommandGroup>
								{/* Allow clearing */}
								<CommandItem
									value="__clear__"
									onSelect={handleClear}
									className="text-muted-foreground italic"
								>
									<span>Sin agencia</span>
									{!displayAgency && (
										<CheckIcon className="ml-auto h-4 w-4 opacity-100" />
									)}
								</CommandItem>
								{agencies.map((agency) => (
									<CommandItem
										key={agency.id}
										value={agency.name}
										onSelect={() => handleSelect(agency.id)}
									>
										{agency.name}
										{displayAgency?.id === agency.id && (
											<CheckIcon className="ml-auto h-4 w-4 opacity-100" />
										)}
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</div>
	)
}
