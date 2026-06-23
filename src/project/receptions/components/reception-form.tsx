"use client"

import { useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"

import { type ReceptionFormData, buildReceptionFormSteps } from "../schemas/reception.schema"
import { validateAllReceptionSteps, firstFailingReceptionStepIndex } from "../utils/validate-all-steps"
import { useReceptionFormStore } from "../stores/reception-form.store"
import { useAppForm } from "@/shared/components/ui/tanstack-form"
import { useCreateReception, useUpdateReception } from "../hooks/use-receptions"
import { useFormStepper } from "@/shared/hooks/use-stepper"
import { createClientId } from "@/shared/lib/create-client-id"
import { shouldClearPendingPayments } from "@/shared/utils/payment-status-sync"
import { cn } from "@/lib/utils"

import { ErrorSummary } from "@/shared/components/ui/error-summary"
import { ReceptionSummaryCard } from "./reception-summary-card"
import { ReceptionPassengersFormGroup } from "./reception-passengers-form-group"
import { ReceptionPaymentsFormGroup } from "./reception-payments-form-group"
import { ReceptionEventFormGroup } from "./reception-event-form-group"
import { Card } from "@/shared/components/ui/card"
import { useActiveTours } from "@/project/tours/hooks/use-tours"

const steps = [
	{ number: 1, title: "Eventos", description: "Selecciona la agencia y los tours" },
	{ number: 2, title: "Detalle de Pasajeros", description: "Información de los pasajeros" },
	{ number: 3, title: "Registro de Pago", description: "Pagos asociados al traslado" },
]

const RECEPTION_FORM_DRAFT_KEY = "reception-form-draft-v2"
const DRAFT_EXPIRY_MS = 60 * 60 * 1000 // 1 hour

function migrateDraftV1toV2() {
	try {
		const oldKey = "reception-form-draft-v1"
		const oldDraft = localStorage.getItem(oldKey)
		if (!oldDraft) return null

		const old = JSON.parse(oldDraft)
		// Migrate passenger fields
		if (old.passengers) {
			old.passengers = old.passengers.map((p: any) => ({
				...p,
				rut: p.document ?? p.rut ?? "",
				nacionality: p.nationality ?? p.nacionality ?? "",
				diet_type: p.diet ?? p.diet_type ?? undefined,
				hotels: p.hotel ? [{ hotelName: p.hotel, order: 0 }] : (p.hotels ?? []),
				allergies: p.allergies ?? [],
				dietOther: p.dietOther ?? "",
				age: p.age ? Number(p.age) : undefined,
			}))
			// Clean old field names
			old.passengers.forEach((p: any) => {
				delete p.document
				delete p.nationality
				delete p.diet
				delete p.hotel
			})
		}

		localStorage.setItem("reception-form-draft-v2", JSON.stringify(old))
		localStorage.removeItem(oldKey)
		return old
	} catch (e) {
		console.warn("Failed to migrate reception draft v1→v2:", e)
		return null
	}
}

interface ReceptionFormProps {
	onSuccess?: () => void
	initialData?: ReceptionFormData
	mode?: "create" | "edit"
	receptionId?: string
}

export function ReceptionForm({ onSuccess, initialData, mode = "create", receptionId }: ReceptionFormProps) {
	const createReception = useCreateReception()
	const updateReception = useUpdateReception()
	const router = useRouter()
	const { data: availableTours } = useActiveTours()
	const draftHydratedRef = useRef(false)

	const { resetForm } = useReceptionFormStore()

	const formSteps = buildReceptionFormSteps(mode)
	const { currentValidator, step, currentStep, isFirstStep, reset: resetStepper } = useFormStepper(formSteps)

	const emptyDefaultValues: ReceptionFormData = {
		agencyId: "",
		date: new Date(),
		paymentStatus: "PENDING",
		eventDetails: [
			{
				clientId: createClientId(),
				tourId: "",
				comments: "",
				mode: "REGULAR",
				date: new Date(),
				priceEntries: [],
				entrySnapshots: [],
			},
		],
		passengers: [
			{
				clientId: createClientId(),
				name: "",
				email: "",
				phone: "",
				age: undefined,
				rut: "",
				nacionality: "",
				diet_type: undefined,
				hotels: [],
				allergies: [],
				dietOther: "",
			},
		],
		payments: [],
		comments: "",
	}

	const receptionForm = useAppForm({
		defaultValues: (mode === "edit" && initialData ? initialData : emptyDefaultValues) as ReceptionFormData,
		validators: {
			onDynamic: currentValidator as any,
		},
		onSubmit: async ({ value }) => {
			try {
				if (mode === "edit" && receptionId) {
					// Full-form validation for edit mode: "Guardar Cambios" can be triggered
					// from any step, so we must enforce ALL step invariants here.
					const issues = validateAllReceptionSteps(value, "edit")
					if (issues.length > 0) {
						const byField = new Map<string, string>()
						for (const issue of issues) {
							const fieldPath = issue.path.join(".")
							if (fieldPath && !byField.has(fieldPath)) {
								byField.set(fieldPath, issue.message)
							}
						}
						for (const [fieldPath, message] of byField.entries()) {
							receptionForm.setFieldMeta(fieldPath as any, (prev) => ({
								...(prev ?? {}),
								errorMap: {
									...(prev?.errorMap ?? {}),
									onDynamic: message,
								},
							}))
						}
						const failingIdx = firstFailingReceptionStepIndex(issues)
						if (failingIdx >= 0) {
							step.goToStep(failingIdx + 1)
						}
						toast.error("Corrige los errores antes de guardar")
						return
					}

					const result = await updateReception.mutateAsync({ id: receptionId, data: value })
					if (result.success) {
						router.push("/dashboard/navegacion-recepciones")
					}
				} else {
					const receptionResult = await createReception.mutateAsync(value)
					if (receptionResult.success) {
						clearDraft()
						receptionForm.reset()
						resetForm()
						resetStepper()

						if (onSuccess) {
							onSuccess()
						}
					}
				}
			} catch (error) {
				console.error("Error saving reception:", error)
				toast.error(error instanceof Error ? error.message : "Error inesperado — intentá de nuevo")
			}
		},
	})

	const clearDraft = useCallback(() => {
		if (typeof window === "undefined") return
		window.localStorage.removeItem(RECEPTION_FORM_DRAFT_KEY)
	}, [])

	const saveDraft = useCallback((values: ReceptionFormData) => {
		if (typeof window === "undefined") return

		const payload = {
			_savedAt: Date.now(),
			...values,
			date: values.date instanceof Date ? values.date.toISOString() : values.date,
			eventDetails: values.eventDetails.map((event) => ({
				...event,
				clientId: event.clientId || createClientId(),
				date: event.date instanceof Date ? event.date.toISOString() : event.date,
				priceEntries: event.priceEntries ?? [],
				entrySnapshots: event.entrySnapshots ?? [],
			})),
			passengers: values.passengers.map((passenger) => ({
				...passenger,
				clientId: passenger.clientId || createClientId(),
			})),
			payments: values.payments.map((payment) => ({
				...payment,
				clientId: payment.clientId || createClientId(),
				date: payment.date instanceof Date ? payment.date.toISOString() : payment.date,
			})),
		}

		window.localStorage.setItem(RECEPTION_FORM_DRAFT_KEY, JSON.stringify(payload))
	}, [])

	useEffect(() => {
		if (typeof window === "undefined" || draftHydratedRef.current || mode === "edit") return

		draftHydratedRef.current = true
		// Run migration from v1 → v2 before reading v2 key
		const migrated = migrateDraftV1toV2()
		const rawDraft = migrated
			? JSON.stringify(migrated)
			: window.localStorage.getItem(RECEPTION_FORM_DRAFT_KEY)
		if (!rawDraft) return

		try {
			const draft = JSON.parse(rawDraft) as Partial<ReceptionFormData> & { _savedAt?: number }
			if (!draft || typeof draft !== "object") return

			if (draft._savedAt && Date.now() - draft._savedAt > DRAFT_EXPIRY_MS) {
				window.localStorage.removeItem(RECEPTION_FORM_DRAFT_KEY)
				return
			}

			const { _savedAt: _, ...draftData } = draft

			receptionForm.setFieldValue("agencyId", draftData.agencyId ?? "")
			receptionForm.setFieldValue("date", draftData.date ? new Date(draftData.date) : new Date())
			receptionForm.setFieldValue("paymentStatus", draftData.paymentStatus ?? "PENDING")
			receptionForm.setFieldValue("comments", draftData.comments ?? "")
			receptionForm.setFieldValue(
				"eventDetails",
				(draftData.eventDetails || []).map((event) => ({
					...event,
					clientId: event.clientId || createClientId(),
					date: event.date ? new Date(event.date) : new Date(),
					priceEntries: event.priceEntries ?? [],
					entrySnapshots: event.entrySnapshots ?? [],
				}))
			)
			receptionForm.setFieldValue(
				"passengers",
				(draftData.passengers || []).map((passenger) => ({
					...passenger,
					clientId: passenger.clientId || createClientId(),
				}))
			)
			receptionForm.setFieldValue(
				"payments",
				(draftData.payments || []).map((payment) => ({
					...payment,
					clientId: payment.clientId || createClientId(),
					date: payment.date ? new Date(payment.date) : new Date(),
				}))
			)
		} catch {
			window.localStorage.removeItem(RECEPTION_FORM_DRAFT_KEY)
		}
	}, [receptionForm])

	const groups: Record<number, React.ReactNode> = {
		1: (
			<ReceptionEventFormGroup
				form={receptionForm}
				fields={
					{
						date: "date",
						paymentStatus: "paymentStatus",
						eventDetails: "eventDetails",
						agencyId: "agencyId",
						comments: "comments",
					} as any
				}
			/>
		),
		2: (
			<ReceptionPassengersFormGroup
				form={receptionForm}
				fields={{ passengers: "passengers" } as any}
			/>
		),
		3: (
			<ReceptionPaymentsFormGroup
				form={receptionForm}
				fields={{ payments: "payments", comments: "comments" } as any}
			/>
		),
	}

	const syncPassengerArray = useCallback(() => {
		const values = receptionForm.state.values
		const eventDetails = values.eventDetails || []
		let totalPax = 0
		for (const event of eventDetails) {
			for (const entry of event?.priceEntries ?? []) {
				totalPax += entry?.count ?? 0
			}
		}

		const currentPassengers = values.passengers || []
		if (totalPax > 0 && totalPax > currentPassengers.length) {
			const needed = totalPax - currentPassengers.length
			const newSlots = Array.from({ length: needed }, () => ({
				clientId: createClientId(),
				name: "",
				email: "",
				phone: "",
				age: undefined as number | undefined,
				rut: "",
				nacionality: "",
				diet_type: undefined as (typeof values.passengers)[0]["diet_type"],
				hotels: [] as (typeof values.passengers)[0]["hotels"],
				allergies: [] as string[],
				dietOther: "",
			}))
			receptionForm.setFieldValue("passengers", [...currentPassengers, ...newSlots])
		} else if (totalPax > 0 && totalPax < currentPassengers.length) {
			receptionForm.setFieldValue("passengers", currentPassengers.slice(0, totalPax))
		}
		return totalPax
	}, [receptionForm])

	const handleNext = async (skipPaymentStep: boolean) => {
		const currentSchema = formSteps[currentStep - 1]
		const result = currentSchema.safeParse(receptionForm.state.values)

		if (!result.success) {
			// Solo validar campos para mostrar errores, NO hacer submit
			await receptionForm.validate("change")
			return
		}

		if (mode !== "edit") {
			saveDraft(receptionForm.state.values)
		}

		// Paso 1 → Sincronizar pasajeros y avanzar al paso 2
		if (currentStep === 1) {
			syncPassengerArray()
			step.goToNextStep()
			return
		}

		// Paso 2 con skip → Submit directo (no hay paso 3)
		if (currentStep === 2 && skipPaymentStep) {
			await receptionForm.handleSubmit()
			return
		}

		// Paso 2 sin skip → Va al paso 3
		if (currentStep === 2 && !skipPaymentStep) {
			step.goToNextStep()
			return
		}

		// Paso 3 → Submit
		if (currentStep === 3) {
			await receptionForm.handleSubmit()
			return
		}
	}

	const handlePrevious = () => {
		step.goToPrevStep()
	}

	useEffect(() => {
		if (receptionForm.state.values.paymentStatus === "PENDING") {
			// Guard prevents an infinite render loop (React #185): only write when
			// there is something to clear. See shouldClearPendingPayments.
			if (
				shouldClearPendingPayments(
					receptionForm.state.values.paymentStatus,
					receptionForm.state.values.payments
				)
			) {
				receptionForm.setFieldValue("payments", [])
			}
			// Bug 1: step 3 (payments) disappears when PENDING — navigate back to step 2
			// so currentStep does not point at a ghost step. Only trigger after mount
			// (draft hydration sets paymentStatus before steps are meaningful).
			if (currentStep === 3) {
				step.goToStep(2)
			}
		}
	}, [receptionForm.state.values.paymentStatus, receptionForm, currentStep, step])

	return (
		<div>
			<receptionForm.AppForm>
				<receptionForm.Form>
					<div className="flex flex-col gap-8 pt-3 lg:flex-row lg:items-start">
						<receptionForm.Subscribe selector={(state) => state.values.paymentStatus}>
							{(paymentStatus) => {
								// Solo saltamos el paso de pagos si paymentStatus es PENDING
								const skipPaymentStep = paymentStatus === "PENDING"
								const visibleSteps = skipPaymentStep ? steps.filter((s) => s.number !== 3) : steps

								// Es último paso si: paso 3, O paso 2 con PENDING
								const isLastStep = currentStep === 3 || (currentStep === 2 && skipPaymentStep)

								return (
									<div className="flex flex-1 flex-col gap-8">
										<div className="flex w-full items-center justify-between gap-2 lg:px-4">
											{visibleSteps.map((s, index) => (
												<div
													key={s.number}
													className={cn(
														"flex flex-1 items-center",
														index === visibleSteps.length - 1 ? "w-fit flex-0" : ""
													)}
												>
													{/* Bug 2 / Feature: in edit mode circles are interactive navigation
													    buttons. In create mode disabled={true} keeps them inert.
													    type="button" is MANDATORY inside a form — default type would submit. */}
													<button
														type="button"
														disabled={mode !== "edit"}
														onClick={() => {
															// Before going to passengers (step 2), sync the array
															// so it reflects the latest event counts — mirrors the
															// reconcile call in handleNext.
															if (mode === "edit" && s.number === 2) {
																syncPassengerArray()
															}
															step.goToStep(s.number)
														}}
														aria-current={currentStep === s.number ? "step" : undefined}
														className={cn(
															"flex w-fit flex-col items-center",
															mode === "edit" && "cursor-pointer"
														)}
													>
														<div
															className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold transition-colors ${
																currentStep === s.number
																	? "border-primary bg-primary text-white"
																	: currentStep > s.number
																		? "border-primary bg-primary/10 text-primary"
																		: "border-border bg-background text-muted-foreground"
															}`}
														>
															{s.number}
														</div>

														<div className="mt-2 hidden text-center lg:block">
															<p
																className={`text-sm font-medium text-nowrap ${
																	currentStep === s.number
																		? "text-primary"
																		: "text-muted-foreground"
																}`}
															>
																{s.title}
															</p>
														</div>
													</button>

													{index < visibleSteps.length - 1 && (
														<div
															className={`h-0.5 flex-1 transition-colors ${currentStep > s.number ? "bg-primary" : "bg-border"}`}
														/>
													)}
												</div>
											))}
										</div>

										<receptionForm.Subscribe
											selector={(state) => ({
												fieldMeta: state.fieldMeta,
												submissionAttempts: state.submissionAttempts,
											})}
										>
											{(formState) => <ErrorSummary formState={formState} />}
										</receptionForm.Subscribe>

										<Card>
											<AnimatePresence mode="popLayout">
												<motion.div
													key={currentStep}
													exit={{ opacity: 0, x: -15 }}
													animate={{ opacity: 1, x: 0 }}
													initial={{ opacity: 0, x: 15 }}
													transition={{ duration: 0.4, type: "spring" }}
												>
													{groups[currentStep]}
												</motion.div>
											</AnimatePresence>
										</Card>

										<div className="flex w-full items-center justify-between gap-3">
											{/* In edit mode: no "Anterior" — free nav via step circles.
											    In create mode: show "Anterior" as usual. */}
											{mode !== "edit" && (
												<receptionForm.StepButton
													variant={"outline"}
													label={
														<>
															<ChevronLeftIcon /> Anterior
														</>
													}
													disabled={isFirstStep}
													handleMovement={handlePrevious}
												/>
											)}

											{/* Feature: in edit mode "Guardar Cambios" is always visible.
											    Additionally show "Continuar" when not on last step so the
											    user can navigate forward. Create mode is unchanged. */}
											{mode === "edit" ? (
												<div className="flex w-full items-center justify-end gap-3">
													<receptionForm.SubmitButton
														label="Guardar Cambios"
														className="bg-primary text-white hover:bg-orange-600"
														data-testid="receptions-button-form-submit"
													/>
													{!isLastStep && (
														<receptionForm.StepButton
															variant={"outline"}
															label={
																<>
																	Continuar <ChevronRightIcon />
																</>
															}
															handleMovement={() => handleNext(skipPaymentStep)}
														/>
													)}
												</div>
											) : isLastStep ? (
												<div className="flex w-full items-center justify-end gap-3">
													<receptionForm.SubmitButton
														label="Crear Recepción"
														type="button"
														onClick={() => handleNext(skipPaymentStep)}
														className="bg-primary text-white hover:bg-orange-600"
														data-testid="receptions-button-form-submit"
													/>
												</div>
											) : (
												<div className="flex w-full items-center justify-end gap-3">
													<receptionForm.StepButton
														variant={"default"}
														className="bg-primary text-white hover:bg-orange-600"
														label={
															<>
																Siguiente <ChevronRightIcon />
															</>
														}
														handleMovement={() => handleNext(skipPaymentStep)}
													/>
												</div>
											)}
										</div>
									</div>
								)
							}}
						</receptionForm.Subscribe>

						<div className="hidden lg:block">
							<receptionForm.Subscribe
								selector={(state) => ({
									values: state.values,
								})}
							>
								{({ values }) => (
									<ReceptionSummaryCard formData={values} availableTours={availableTours} />
								)}
							</receptionForm.Subscribe>
						</div>
					</div>
				</receptionForm.Form>
			</receptionForm.AppForm>
		</div>
	)
}
