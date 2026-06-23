"use no memo"

import { cn } from "@/lib/utils"
import * as React from "react"
import {
	useStore,
	createFormHook,
	revalidateLogic,
	createFormHookContexts,
} from "@tanstack/react-form"

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/shared/components/ui/input-group"
import { Button, type buttonVariants } from "@/shared/components/ui/button"
import { Spinner } from "@/shared/components/ui/spinner"
import {
	FieldGroup,
	FieldLabel,
	FieldTitle,
	FieldLegend,
	FieldSeparator,
	FieldDescription,
	Field as DefaultField,
	FieldSet as DefaultFieldSet,
	FieldError as DefaultFieldError,
} from "@/shared/components/ui/field"

import type { VariantProps } from "class-variance-authority"

const {
	fieldContext,
	formContext,
	useFieldContext: _useFieldContext,
	useFormContext,
} = createFormHookContexts()

const { useAppForm, withForm, withFieldGroup } = createFormHook({
	fieldContext,
	formContext,
	fieldComponents: {
		Field,
		FieldError,
		FieldSet,
		FieldDescription,
		FieldGroup,
		FieldLabel,
		FieldLegend,
		FieldSeparator,
		FieldTitle,
		InputGroup,
		InputGroupAddon,
		InputGroupInput,
	},
	formComponents: {
		SubmitButton,
		StepButton,
		FieldLegend,
		FieldDescription,
		FieldSeparator,
		Form,
	},
})

type FormItemContextValue = {
	id: string
}

const FormItemContext = React.createContext<FormItemContextValue>({} as FormItemContextValue)

function FieldSet({ className, children, ...props }: React.ComponentProps<"fieldset">) {
	const id = React.useId()

	return (
		<FormItemContext.Provider value={{ id }}>
			<DefaultFieldSet className={cn("grid content-start gap-1", className)} {...props}>
				{children}
			</DefaultFieldSet>
		</FormItemContext.Provider>
	)
}

const useFieldContext = () => {
	const { id } = React.useContext(FormItemContext)
	const { name, store, ...fieldContext } = _useFieldContext()

	const errors = useStore(store, (state) => state.meta.errors)
	if (!fieldContext) {
		throw new Error("useFieldContext should be used within <FormItem>")
	}

	return {
		id,
		name,
		formItemId: `${id}-form-item`,
		formDescriptionId: `${id}-form-item-description`,
		formMessageId: `${id}-form-item-message`,
		errors,
		store,
		...fieldContext,
	}
}

function Field({ children, ...props }: React.ComponentProps<"div">) {
	const { errors, formItemId, formDescriptionId, formMessageId, handleBlur, store } =
		useFieldContext()
	const isTouched = useStore(store, (state) => state.meta.isTouched)
	const hasVisibleErrors = !!errors.length && isTouched

	return (
		<DefaultField
			id={formItemId}
			className="gap-2"
			onBlur={handleBlur}
			data-invalid={hasVisibleErrors}
			aria-describedby={
				!hasVisibleErrors ? `${formDescriptionId}` : `${formDescriptionId} ${formMessageId}`
			}
			aria-invalid={hasVisibleErrors}
			{...props}
		>
			{children}
		</DefaultField>
	)
}

function FieldError({ className, ...props }: React.ComponentProps<"p">) {
	const { errors, formMessageId, store } = useFieldContext()
	const isTouched = useStore(store, (state) => state.meta.isTouched)
	const body = errors.length ? String(errors.at(0)?.message ?? "") : ""
	if (!body || !isTouched) return null
	return (
		<DefaultFieldError
			data-slot="form-message"
			id={formMessageId}
			className={cn("text-destructive text-sm", className)}
			{...props}
			errors={body ? [{ message: body }] : []}
		/>
	)
}

function Form({
	children,
	...props
}: Omit<React.ComponentPropsWithoutRef<"form">, "onSubmit" & "noValidate"> & {
	children?: React.ReactNode
}) {
	const form = useFormContext()
	const handleSubmit = React.useCallback(
		(e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault()
			e.stopPropagation()
			form.handleSubmit()
		},
		[form]
	)
	return (
		<form
			onSubmit={handleSubmit}
			className={cn("mx-auto flex w-full flex-col gap-2 p-2", props.className)}
			noValidate
			{...props}
		>
			{children}
		</form>
	)
}

function SubmitButton({
	label,
	className,
	size,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		label: string
	}) {
	const form = useFormContext()
	return (
		<form.Subscribe selector={(state) => state.isSubmitting}>
			{(isSubmitting) => (
				<Button className={className} size={size} type="submit" disabled={isSubmitting} {...props}>
					{isSubmitting && <Spinner />}
					{label}
				</Button>
			)}
		</form.Subscribe>
	)
}

function StepButton({
	label,
	handleMovement,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		label: React.ReactNode | string
		handleMovement: () => void
	}) {
	return (
		<Button size="sm" variant="ghost" type="button" onClick={handleMovement} {...props}>
			{label}
		</Button>
	)
}

export { revalidateLogic, useAppForm, useFieldContext, useFormContext, withFieldGroup, withForm }
