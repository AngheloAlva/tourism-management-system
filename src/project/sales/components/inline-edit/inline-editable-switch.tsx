"use client"

import { useRef, useState, useTransition } from "react"
import { Loader2Icon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Switch } from "@/shared/components/ui/switch"
import { Label } from "@/shared/components/ui/label"

type SaveResult = { success: true } | { success: false; error: string }

interface InlineEditableSwitchProps {
	/** Current persisted value */
	value: boolean
	/** Called immediately when the user toggles. Return the action result. */
	onSave: (next: boolean) => Promise<SaveResult>
	/** Accessible label displayed next to the switch */
	label: string
	/** When true, the switch is not interactive */
	disabled?: boolean
	/** Additional class names for the wrapper */
	className?: string
}

/**
 * InlineEditableSwitch — instant-commit boolean toggle.
 *
 * Pattern:
 * - Resting: Switch + label.
 * - Toggle: commits immediately; optimistic state updates the switch.
 * - Error: reverts the optimistic toggle.
 * - Pending: switch is disabled + spinner shown.
 *
 * Used for: `contacted`.
 */
export function InlineEditableSwitch({
	value,
	onSave,
	label,
	disabled = false,
	className,
}: InlineEditableSwitchProps) {
	const [displayValue, setDisplayValue] = useState(value)
	const [isPending, startTransition] = useTransition()

	// Sync external value (after onRefresh)
	const prevRef = useRef(value)
	if (prevRef.current !== value && !isPending) {
		prevRef.current = value
		setDisplayValue(value)
	}

	const handleToggle = (next: boolean) => {
		if (disabled || isPending) return
		const previous = displayValue

		// Optimistic
		setDisplayValue(next)

		startTransition(async () => {
			const result = await onSave(next)
			if (!result.success) {
				// Rollback
				setDisplayValue(previous)
			}
		})
	}

	return (
		<div
			data-testid={`inline-edit-switch-${label}`}
			className={cn("flex items-center gap-2", className)}
		>
			<Switch
				checked={displayValue}
				onCheckedChange={handleToggle}
				disabled={disabled || isPending}
				aria-label={label}
				id={`inline-switch-${label}`}
			/>
			<Label
				htmlFor={`inline-switch-${label}`}
				className={cn(
					"cursor-pointer text-sm",
					(disabled || isPending) && "cursor-default opacity-70"
				)}
			>
				{label}
			</Label>
			{isPending && (
				<Loader2Icon className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
			)}
		</div>
	)
}
