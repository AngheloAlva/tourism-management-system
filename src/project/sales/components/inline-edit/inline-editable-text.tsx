"use client"

import { useState, useTransition, useRef } from "react"
import { PencilIcon, Loader2Icon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/shared/components/ui/input"
import { Textarea } from "@/shared/components/ui/textarea"

type SaveResult = { success: true } | { success: false; error: string }

interface InlineEditableTextProps {
	/** Current persisted value (null = empty) */
	value: string | null
	/** Called when user commits an edit. Return the action result. */
	onSave: (next: string | null) => Promise<SaveResult>
	/** Placeholder shown when value is null/empty in read mode */
	placeholder?: string
	/** Render as a multiline Textarea instead of a single-line Input */
	multiline?: boolean
	/** When true, hides the pencil affordance and blocks editing */
	disabled?: boolean
	/** Accessible label used in aria attributes and title */
	label: string
	/** Additional class names for the wrapper */
	className?: string
}

/**
 * InlineEditableText — click-to-edit component for plain text fields.
 *
 * Pattern:
 * - Resting: read-only display + hover PencilIcon.
 * - Active: Input / Textarea.
 * - Enter (single-line) or blur: commits save → optimistic update.
 * - Escape: cancels, reverts to last server value.
 * - Pending: dim + spinner while useTransition is active.
 * - Error: reverts optimistic value + toast is handled by the parent via the returned error.
 *
 * Used for: fileNumber (single-line) and comments (multiline=true).
 */
export function InlineEditableText({
	value,
	onSave,
	placeholder = "Sin valor",
	multiline = false,
	disabled = false,
	label,
	className,
}: InlineEditableTextProps) {
	const [isEditing, setIsEditing] = useState(false)
	// Optimistic display value
	const [displayValue, setDisplayValue] = useState<string | null>(value)
	// Draft while editing
	const [draftValue, setDraftValue] = useState<string>("")
	const [isPending, startTransition] = useTransition()
	const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

	// Sync external value changes (e.g. after onRefresh)
	const prevValueRef = useRef(value)
	if (prevValueRef.current !== value && !isEditing) {
		prevValueRef.current = value
		setDisplayValue(value)
	}

	const enterEditMode = () => {
		if (disabled || isPending) return
		setDraftValue(displayValue ?? "")
		setIsEditing(true)
		// Focus is handled via autoFocus on the input element
	}

	const commit = () => {
		const next = draftValue.trim() === "" ? null : draftValue.trim()
		const previous = displayValue

		// Dirty check — skip save when value did not change. Avoids spurious
		// toasts on accidental click-in / click-out.
		if (next === previous) {
			setIsEditing(false)
			return
		}

		// Optimistic
		setDisplayValue(next)
		setIsEditing(false)

		startTransition(async () => {
			const result = await onSave(next)
			if (!result.success) {
				// Rollback
				setDisplayValue(previous)
			}
		})
	}

	const cancel = () => {
		setIsEditing(false)
		setDraftValue(displayValue ?? "")
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Escape") {
			e.preventDefault()
			cancel()
		}
		if (!multiline && e.key === "Enter") {
			e.preventDefault()
			commit()
		}
	}

	if (isEditing) {
		const sharedProps = {
			ref: inputRef as React.RefObject<HTMLInputElement & HTMLTextAreaElement>,
			value: draftValue,
			onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
				setDraftValue(e.target.value),
			onBlur: commit,
			onKeyDown: handleKeyDown,
			autoFocus: true,
			"aria-label": label,
			className: "w-full",
		}

		return (
			<div data-testid={`inline-edit-text-${label}`} className={cn("w-full", className)}>
				{multiline ? (
					<Textarea
						{...(sharedProps as React.ComponentProps<typeof Textarea>)}
						rows={3}
					/>
				) : (
					<Input {...(sharedProps as React.ComponentProps<typeof Input>)} />
				)}
			</div>
		)
	}

	return (
		<div
			data-testid={`inline-edit-text-${label}`}
			className={cn(
				"group flex min-h-[1.5rem] cursor-pointer items-center gap-1.5",
				isPending && "pointer-events-none opacity-50",
				disabled && "cursor-default opacity-70",
				className
			)}
			onClick={!disabled ? enterEditMode : undefined}
			role={!disabled ? "button" : undefined}
			tabIndex={!disabled ? 0 : undefined}
			onKeyDown={(e) => {
				if (!disabled && (e.key === "Enter" || e.key === " ")) {
					e.preventDefault()
					enterEditMode()
				}
			}}
			aria-label={`Editar ${label}`}
			title={disabled ? `${label} (no editable)` : `Editar ${label}`}
		>
			<span
				className={cn(
					"flex-1 text-sm",
					!displayValue && "text-muted-foreground italic"
				)}
			>
				{displayValue ?? placeholder}
			</span>

			{isPending ? (
				<Loader2Icon className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
			) : !disabled ? (
				<PencilIcon className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
			) : null}
		</div>
	)
}
