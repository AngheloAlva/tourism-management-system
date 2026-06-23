"use client"

import type { AnyFormApi } from "@tanstack/react-form"
import { useCallback, useMemo, useState } from "react"
import type { ZodObject } from "zod"

type HandleCancelOrBackOpts = {
	onBack?: VoidFunction
	onCancel?: VoidFunction
}

type StepState = {
	value: number
	count: number
	goToNextStep: () => void
	goToPrevStep: () => void
	goToStep: (target: number) => void
	isCompleted: boolean
}

/**
 * Pure helper: clamp `target` to the valid step range [1, stepCount].
 * - Non-finite (NaN, Infinity, -Infinity) values clamp to 1.
 * - Float values are truncated toward zero before clamping.
 */
export function clampStep(target: number, stepCount: number): number {
	if (!Number.isFinite(target)) return 1
	return Math.min(Math.max(Math.trunc(target), 1), stepCount)
}

export function useFormStepper(schemas: ZodObject[]) {
	const stepCount = schemas.length
	const [currentStep, setCurrentStep] = useState(1)

	const goToNextStep = useCallback(() => {
		setCurrentStep((prev) => Math.min(prev + 1, stepCount))
	}, [stepCount])

	const goToPrevStep = useCallback(() => {
		setCurrentStep((prev) => Math.max(prev - 1, 1))
	}, [])

	const goToStep = useCallback(
		(target: number) => {
			setCurrentStep(() => clampStep(target, stepCount))
		},
		[stepCount]
	)

	// Memoized so its identity is stable across renders. Consumers put `step` in
	// effect dependency arrays; recreating it every render made those effects run
	// on every render, which — combined with a setState inside — caused an infinite
	// render loop (React error #185 "Maximum update depth exceeded").
	const step: StepState = useMemo(
		() => ({
			value: currentStep,
			count: stepCount,
			goToNextStep,
			goToPrevStep,
			goToStep,
			isCompleted: currentStep === stepCount,
		}),
		[currentStep, stepCount, goToNextStep, goToPrevStep, goToStep]
	)

	const currentValidator = schemas[currentStep - 1]
	const isFirstStep = currentStep === 1

	const triggerFormGroup = async (form: AnyFormApi) => {
		const result = currentValidator.safeParse(form.state.values)
		if (!result.success) {
			await form.handleSubmit({ step: String(currentStep) })
			return result
		}

		return result
	}

	const handleNextStepOrSubmit = async (form: AnyFormApi) => {
		const result = await triggerFormGroup(form)
		if (!result.success) {
			return
		}

		if (currentStep < stepCount) {
			goToNextStep()
			return
		}

		if (currentStep === stepCount) {
			form.handleSubmit()
		}
	}

	const handleCancelOrBack = (opts?: HandleCancelOrBackOpts) => {
		if (isFirstStep || step.isCompleted) {
			opts?.onCancel?.()
			return
		}

		if (currentStep > 1) {
			opts?.onBack?.()
			goToPrevStep()
		}
	}

	const reset = useCallback(() => {
		setCurrentStep(1)
	}, [])

	return {
		step,
		currentStep,
		isFirstStep,
		currentValidator,
		triggerFormGroup,
		handleNextStepOrSubmit,
		handleCancelOrBack,
		reset,
	}
}
