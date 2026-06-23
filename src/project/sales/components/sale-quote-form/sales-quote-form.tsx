"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { AnyFormApi } from "@tanstack/react-form"
import { useStore } from "@tanstack/react-form"
import { useAppForm } from "@/shared/components/ui/tanstack-form"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useFormStepper } from "@/shared/hooks/use-stepper"
import { motion, AnimatePresence } from "motion/react"
import { revalidateLogic } from "@tanstack/react-form"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { buildSaleRecordFormSteps, type SaleRecordFormSchema } from "../../schemas/sale-record.schema"
import { useCreateSaleRecord, useUpdateSaleRecord } from "../../hooks/use-sale-records"
import { calculateSaleTotals } from "../../utils/sale-calculations"
import { validateAllSteps, firstFailingStepIndex } from "../../utils/validate-all-steps"
import { clearInjectedErrors, collectInjectedPaths } from "../../utils/injected-errors"
import {
	reconcilePassengerList,
	passengerOverflowCount,
	computeTargetPassengerCount,
} from "../../utils/reconcile-passengers"
import { useActiveTours } from "@/project/tours/hooks/use-tours"
import { useAllAgencies } from "@/project/agency/hooks/use-agencies"
import { useNextVoucherNumber } from "../../hooks/use-next-voucher"
import { useSaleFormStore } from "../../stores/sale-form.store"
import { SaleSummaryCard } from "../sale-summary-card"
import { createClientId } from "@/shared/lib/create-client-id"
import { cn } from "@/lib/utils"

import { GeneralInfoFormGroup } from "./general-info-form-group"
import { PassengersFormGroup } from "./passengers-form-group"
import { PaymentFormGroup } from "./payment-form-group"
import { EventsFormGroup } from "./events-form-group"
import { Card } from "@/shared/components/ui/card"
import { ErrorSummary } from "@/shared/components/ui/error-summary"
import { RequestApprovalDialog } from "@/project/approvals/components/request/request-approval-dialog"
import { APPROVAL_ACTION } from "@/generated/prisma/enums"

const steps = [
	{ number: 1, title: "Información General" },
	{ number: 2, title: "Detalle de Evento/Tour" },
	{ number: 3, title: "Detalle de Pasajeros" },
	{ number: 4, title: "Registro de Pago" },
]

const SALE_FORM_DRAFT_KEY = "sale-quote-form-draft-v1"
const DRAFT_EXPIRY_MS = 60 * 60 * 1000 // 1 hour

interface SalesQuoteFormProps {
	initialData?: Partial<SaleRecordFormSchema>
}

export default function SalesQuoteForm({ initialData }: SalesQuoteFormProps): React.ReactElement {
	const createSale = useCreateSaleRecord()
	const updateSale = useUpdateSaleRecord()

	const { agencyName, wholesaleAgencyName, resetForm, editMode, editingRecordId, editingVoucher } =
		useSaleFormStore()

	// In edit mode the real voucher already exists; in create mode we project the
	// number the new sale/quote would most likely get (best-effort estimate).
	const { data: projectedVoucher } = useNextVoucherNumber(!editMode)
	const summaryVoucher = editMode ? (editingVoucher ?? undefined) : projectedVoucher

	const { currentValidator, step, currentStep, isFirstStep, reset } =
		useFormStepper(buildSaleRecordFormSteps(editMode ? "edit" : "create"))
	const { data: activeTours } = useActiveTours()
	const { data: agencies = [] } = useAllAgencies()
	const draftHydratedRef = useRef(false)
	// Tracks the set of field paths injected by the last failed edit-mode save.
	// Cleared and repopulated on each save attempt. Used to wipe stale onDynamic
	// errors before handleSubmit so the form can never be permanently blocked.
	const injectedPathsRef = useRef<Set<string>>(new Set())

	const router = useRouter()

	// Approval reason dialog state (for invoiced-sale edit gate)
	const [approvalDialogOpen, setApprovalDialogOpen] = useState(false)
	const [pendingApprovalPayload, setPendingApprovalPayload] = useState<SaleRecordFormSchema | null>(null)

	const getSelectedAgencyPricing = (values: Partial<SaleRecordFormSchema>) => {
		const selectedAgencyId =
			values.channel === "WHOLESALE"
				? values.agencyId || ""
				: values.isWholesale
					? values.wholesaleAgencyId || ""
					: ""

		return agencies.find((agency) => agency.id === selectedAgencyId)?.tourPricing || []
	}

	const clearDraft = useCallback(() => {
		if (typeof window === "undefined") return
		window.localStorage.removeItem(SALE_FORM_DRAFT_KEY)
	}, [])

	const saveDraft = useCallback(
		(values: SaleRecordFormSchema) => {
			if (typeof window === "undefined" || editMode) return

			const payload = {
				_savedAt: Date.now(),
				...values,
				eventBookings: values.eventBookings.map((event) => ({
					...event,
					date: event.date instanceof Date ? event.date.toISOString() : event.date,
					flyDate: event.flyDate instanceof Date ? event.flyDate.toISOString() : event.flyDate,
				})),
				passengerArray: values.passengerArray.map((passenger) => ({
					...passenger,
					hotels: (passenger.hotels || []).map((h) => ({
						...h,
						checkIn: h.checkIn instanceof Date ? h.checkIn.toISOString() : h.checkIn,
						checkOut: h.checkOut instanceof Date ? h.checkOut.toISOString() : h.checkOut,
					})),
				})),
				paymentArray: values.paymentArray.map((payment) => ({
					...payment,
					movement_date:
						payment.movement_date instanceof Date
							? payment.movement_date.toISOString()
							: payment.movement_date,
				})),
			}

			window.localStorage.setItem(SALE_FORM_DRAFT_KEY, JSON.stringify(payload))
		},
		[editMode]
	)

	const syncPassengerArrayFromEntries = useCallback((values: SaleRecordFormSchema) => {
		const eventBookings = values.eventBookings || []
		if (eventBookings.length === 0) return

		const targetCount = computeTargetPassengerCount(eventBookings)
		const currentPassengers = values.passengerArray || []

		if (targetCount === currentPassengers.length) return

		return targetCount
	}, [])

	/**
	 * Reconcile the passenger array length to match the event booking counts.
	 * Extracted from handleNext so it can be called in edit mode (field-effect
	 * subscription and submit-time fallback) without coupling navigation to data logic.
	 * Create mode continues to call this from inside handleNext — zero behavioral change.
	 */
	const reconcilePassengerArray = useCallback(
		(form: AnyFormApi, values: SaleRecordFormSchema) => {
			const targetCount = syncPassengerArrayFromEntries(values)
			if (targetCount === undefined) return

			const currentPassengers = values.passengerArray || []
			const makeEmpty = () => ({
				clientId: createClientId(),
				name: "",
				rut: "",
				age: 0,
				nacionality: "1",
				diet_type: "NORMAL" as const,
				allergies: [] as string[],
				phone: "",
				hotels: [{ clientId: createClientId(), hotelName: "", order: 0 }],
				email: "",
				complimentary: false,
				complimentaryCategory: "",
			})

			const next = reconcilePassengerList(currentPassengers, targetCount, makeEmpty)

			// Avoid pointless writes: only update when length or reference changed
			// (prevents the React #185 loop — see useStore comment below).
			if (next !== currentPassengers || next.length !== currentPassengers.length) {
				form.setFieldValue("passengerArray", next as any)
			}
		},
		[syncPassengerArrayFromEntries]
	)

	const salesQuoteForm = useAppForm({
		defaultValues: {
			type: "SALE",
			channel: "PHYSICAL",
			comments: "",
			agencyId: "",
			fileNumber: "",
			isWholesale: false,
			wholesaleAgencyId: "",
			wholesaleMarkup: 30,
			fileNumberPending: false,
			paymentPending: false,
			codePrefix: "",
			codeLength: 0,
			eventBookings: [
				{
					clientId: createClientId(),
					mode: "REGULAR",
					date: new Date(),
					tourId: "",
					comments: "",
					startTime: "",
					endTime: "",
					flyTime: "",
					flyDate: new Date(),
					flyName: "",
					priceEntries: [],
					entrySnapshots: [],
				},
			],
			passengerArray: [
				{
					clientId: createClientId(),
					name: "",
					rut: "",
					age: 0,
					nacionality: "1",
					diet_type: "NORMAL",
					allergies: [],
					phone: "",
					hotels: [{ clientId: createClientId(), hotelName: "", order: 0 }],
					email: "",
				},
			],
			paymentArray: [
				{
					clientId: createClientId(),
					refund: false,
					method: "CASH",
					currency: "CLP",
					exchange_rate: undefined,
					amount: 0,
					movement_date: new Date(),
					document_number: "",
					comments: "",
				},
			],
			discount: 0,
			...initialData,
		} as SaleRecordFormSchema,
		validationLogic: revalidateLogic(),
		validators: {
			onDynamic: currentValidator as any,
		},
		// Safety net: in create mode there is no validateAllSteps fallback, so a
		// failed step validator aborts handleSubmit without ever reaching onSubmit.
		// Without this, a field error that has no visible anchor (e.g. an object-
		// level refine) leaves the user with a dead "Crear Venta" button and no
		// feedback. Surface a toast so the failure is never silent.
		onSubmitInvalid: () => {
			toast.error("Corrige los errores marcados antes de continuar")
		},
		onSubmit: async ({ value }) => {
			// T-04: Mandatory submit-time reconcile fallback for edit mode.
			// Free navigation via step circles bypasses handleNext, so the passenger
			// array may lag the current event booking counts. Reconcile before building
			// submissionData to guarantee the persisted record is always consistent.
			if (editMode) {
				reconcilePassengerArray(salesQuoteForm, value)
				// Re-read values after potential reconcile mutation
				value = salesQuoteForm.state.values

				// Full-form validation for edit mode.
				// The form's onDynamic validator is scoped to the current step only
				// (sequential wizard gate). In edit mode the user can "Guardar cambios"
				// from any step, so we must enforce ALL step invariants here.
				const issues = validateAllSteps(value, "edit")
				if (issues.length > 0) {
					// Map Zod issues to TanStack Form field errors so they render in-place.
					// Group by field path: only store the first message per field (cleaner UX).
					const byField = new Map<string, string>()
					for (const issue of issues) {
						const fieldPath = issue.path.join(".")
						if (fieldPath && !byField.has(fieldPath)) {
							byField.set(fieldPath, issue.message)
						}
					}
					for (const [fieldPath, message] of byField.entries()) {
						salesQuoteForm.setFieldMeta(fieldPath as any, (prev) => ({
							...(prev ?? {}),
							isTouched: true,
							errorMap: {
								...(prev?.errorMap ?? {}),
								onDynamic: message,
							},
						}))
					}

					// Record which paths were injected so the next save attempt can
					// clear them before handleSubmit (stale-error prevention).
					injectedPathsRef.current = collectInjectedPaths(issues)

					// Navigate to the first failing step so the user sees the errors.
					const failingIdx = firstFailingStepIndex(issues)
					if (failingIdx >= 0) {
						step.goToStep(failingIdx + 1)
					}

					// Surface a toast so the user knows why save was blocked.
					toast.error("Corrige los errores antes de guardar")
					return
				}
			}

			// Overflow guard (both create AND edit modes): block save when
			// passengerArray has more entries than what the event bookings charge for.
			// In edit mode the Zod superRefine on saleRecordFormSchema also catches
			// this via validateAllSteps, but that code path already returned above.
			// This guard catches the create-mode case and acts as a safety net.
			const overflow = passengerOverflowCount(value)
			if (overflow > 0) {
				const msg = `Hay ${overflow} pasajero(s) de más respecto a lo cobrado. Eliminá el/los sobrante(s) antes de guardar.`
				salesQuoteForm.setFieldMeta("passengerArray" as any, (prev) => ({
					...(prev ?? {}),
					isTouched: true,
					errorMap: {
						...(prev?.errorMap ?? {}),
						onDynamic: msg,
					},
				}))
				step.goToStep(3)
				toast.error(msg)
				return
			}

			const selectedAgencyPricing = getSelectedAgencyPricing(value)
			const { diferencia, paymentTolerance, isDifferenceWithinTolerance } = calculateSaleTotals(
				value,
				activeTours || [],
				selectedAgencyPricing
			)

			// Determinar si se debe omitir la validación de pagos
			const skipPaymentValidation =
				value.type === "QUOTE" || (value.channel === "WHOLESALE" && value.paymentPending === true)

			if (!skipPaymentValidation && !isDifferenceWithinTolerance) {
				toast.error(
					`El total de pagos no coincide con el total de la venta. Diferencia: $${Math.abs(
						diferencia
					).toLocaleString("es-CL")} (tolerancia: $${paymentTolerance.toLocaleString("es-CL")})`
				)
				return
			}

			const submissionData = { ...value }
			// Limpiar pagos si es cotización o si es venta a mayorista con pago pendiente
			if (skipPaymentValidation) {
				submissionData.paymentArray = []
			}

			let result
			if (editMode && editingRecordId) {
				result = await updateSale.mutateAsync({
					id: editingRecordId,
					data: submissionData,
				})
			} else {
				result = await createSale.mutateAsync(submissionData)
			}

			if (result.success) {
				// Invoiced-sale approval gate: server needs a reason before creating the request
				if ("approvalRequired" in result && result.approvalRequired && "needsReason" in result && result.needsReason) {
					setPendingApprovalPayload(submissionData)
					setApprovalDialogOpen(true)
					return
				}

				// Approval request already created — notify and stay on page
				if ("approvalRequired" in result && result.approvalRequired) {
					toast.success("Solicitud enviada. Te avisamos cuando sea aprobada.")
					return
				}

				clearDraft()
				if (editMode) {
					if (result.data?.type === "SALE") {
						router.push(`/dashboard/navegacion-ventas`)
					} else {
						router.push(`/dashboard/navegacion-cotizaciones`)
					}
				} else {
					salesQuoteForm.reset()
					reset()
					resetForm()
				}
			}
		},
	})

	useEffect(() => {
		if (typeof window === "undefined" || initialData || editMode || draftHydratedRef.current) {
			return
		}

		draftHydratedRef.current = true
		const rawDraft = window.localStorage.getItem(SALE_FORM_DRAFT_KEY)
		if (!rawDraft) return

		try {
			const draft = JSON.parse(rawDraft) as Partial<SaleRecordFormSchema> & { _savedAt?: number }
			if (!draft || typeof draft !== "object") return

			if (draft._savedAt && Date.now() - draft._savedAt > DRAFT_EXPIRY_MS) {
				window.localStorage.removeItem(SALE_FORM_DRAFT_KEY)
				return
			}

			const { _savedAt: _, ...draftData } = draft

			const parsedEventBookings = draftData.eventBookings?.map((event) => ({
				...event,
				clientId: event.clientId || createClientId(),
				date: event.date ? new Date(event.date) : new Date(),
				flyDate: event.flyDate ? new Date(event.flyDate) : undefined,
			}))
			const parsedPassengerArray = draftData.passengerArray?.map((passenger) => ({
				...passenger,
				clientId: passenger.clientId || createClientId(),
				hotels: ((passenger as any).hotels || []).map((h: any) => ({
					...h,
					clientId: h.clientId || createClientId(),
					checkIn: h.checkIn ? new Date(h.checkIn) : undefined,
					checkOut: h.checkOut ? new Date(h.checkOut) : undefined,
				})),
			}))
			const parsedPaymentArray = draftData.paymentArray?.map((payment) => ({
				...payment,
				clientId: payment.clientId || createClientId(),
				movement_date: payment.movement_date ? new Date(payment.movement_date) : new Date(),
			}))

			salesQuoteForm.setFieldValue("type", draftData.type ?? "SALE")
			salesQuoteForm.setFieldValue("channel", draftData.channel ?? "PHYSICAL")
			salesQuoteForm.setFieldValue("comments", draftData.comments ?? "")
			salesQuoteForm.setFieldValue("agencyId", draftData.agencyId ?? "")
			salesQuoteForm.setFieldValue("fileNumber", draftData.fileNumber ?? "")
			salesQuoteForm.setFieldValue("isWholesale", draftData.isWholesale ?? false)
			salesQuoteForm.setFieldValue("wholesaleAgencyId", draftData.wholesaleAgencyId ?? "")
			salesQuoteForm.setFieldValue("wholesaleMarkup", draftData.wholesaleMarkup ?? 30)
			salesQuoteForm.setFieldValue("fileNumberPending", draftData.fileNumberPending ?? false)
			salesQuoteForm.setFieldValue("paymentPending", draftData.paymentPending ?? false)
			salesQuoteForm.setFieldValue("codePrefix", draftData.codePrefix ?? "")
			salesQuoteForm.setFieldValue("codeLength", draftData.codeLength ?? 0)
			salesQuoteForm.setFieldValue("discount", draftData.discount ?? 0)
			salesQuoteForm.setFieldValue("eventBookings", parsedEventBookings ?? [])
			salesQuoteForm.setFieldValue("passengerArray", parsedPassengerArray ?? [])
			salesQuoteForm.setFieldValue("paymentArray", parsedPaymentArray ?? [])
		} catch {
			window.localStorage.removeItem(SALE_FORM_DRAFT_KEY)
		}
	}, [initialData, editMode, salesQuoteForm])

	const groups: Record<number, React.ReactNode> = {
		1: (
			<GeneralInfoFormGroup
				form={salesQuoteForm}
				fields={
					{
						type: "type",
						channel: "channel",
						comments: "comments",
						agencyId: "agencyId",
						fileNumber: "fileNumber",
						codePrefix: "codePrefix",
						codeLength: "codeLength",
						isWholesale: "isWholesale",
						wholesaleAgencyId: "wholesaleAgencyId",
						fileNumberPending: "fileNumberPending",
						paymentPending: "paymentPending",
					} as any
				}
			/>
		),
		2: <EventsFormGroup form={salesQuoteForm} fields={{ eventBookings: "eventBookings" } as any} />,
		3: (
			<PassengersFormGroup
				form={salesQuoteForm}
				fields={{ passengerArray: "passengerArray" } as any}
			/>
		),
		4: (
			<PaymentFormGroup
				form={salesQuoteForm}
				fields={{ paymentArray: "paymentArray", discount: "discount" } as any}
			/>
		),
	}

	const handleNext = async () => {
		const currentValues = salesQuoteForm.state.values
		const validationResult = currentValidator.safeParse(currentValues)

		if (!validationResult.success) {
			await salesQuoteForm.handleSubmit({ step: String(currentStep) })
			return
		}

		saveDraft(currentValues)

		if (currentStep === 2) {
			reconcilePassengerArray(salesQuoteForm, currentValues)
		}

		const shouldSkipPaymentStep =
			(currentValues.type === "QUOTE" ||
				(currentValues.channel === "WHOLESALE" && currentValues.paymentPending === true)) &&
			currentStep === 3

		if (shouldSkipPaymentStep || step.isCompleted) {
			salesQuoteForm.handleSubmit()
			return
		}

		step.goToNextStep()
	}

	// Edit-mode "Continuar": free navigation to the next step (no per-step
	// validation gate — mirrors the step-circle behavior). Reconcile the
	// passenger array when advancing into the passengers step (step 3) so it
	// reflects the latest event counts even if the reactive effect hasn't fired.
	const handleEditNext = () => {
		if (currentStep + 1 === 3) {
			reconcilePassengerArray(salesQuoteForm, salesQuoteForm.state.values)
		}
		step.goToNextStep()
	}

	// T-04: Edit-mode reactive reconcile. When the user changes event booking
	// quantities in edit mode, the passenger array is reconciled as a side effect
	// (not during render).
	//
	// FIX (React #185 infinite-loop): TanStack Form is IMMUTABLE — every
	// setFieldValue (even for "passengerArray") replaces the entire values object,
	// so selecting s.values.eventBookings yields a NEW array reference on every
	// form mutation. useStore uses reference equality → the old selector triggered
	// on every passengerArray write → reconcile called setFieldValue("passengerArray")
	// → new values → new eventBookings reference → LOOP.
	//
	// Solution: derive a STABLE PRIMITIVE (number) that represents the exact value
	// reconcilePassengerArray cares about — the computed target passenger count.
	// This uses the SAME computeTargetPassengerCount as syncPassengerArrayFromEntries
	// (sum of priceEntries[].count + excludedPassengers.length, max across bookings).
	// After reconcilePassengerArray runs and mutates passengerArray, eventBookings
	// is NOT changed, so this number stays identical → useStore reports no change
	// → the effect does NOT re-fire → no loop. The primitive is derived solely from
	// eventBookings, completely independent of passengerArray.
	const targetPassengerCount = useStore(salesQuoteForm.store, (s) =>
		computeTargetPassengerCount(s.values.eventBookings || [])
	)
	useEffect(() => {
		if (!editMode) return
		reconcilePassengerArray(salesQuoteForm, salesQuoteForm.state.values)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [targetPassengerCount, editMode])

	return (
		<div>
			<salesQuoteForm.AppForm>
				<salesQuoteForm.Form>
					<div className="flex flex-col gap-8 pt-3 lg:flex-row lg:items-start">
						<div className="flex flex-1 flex-col gap-8">
							<div className="flex w-full items-center justify-between gap-2 lg:px-4">
								{steps.map((stepDef, index) => {
									const isQuote = salesQuoteForm.getFieldValue("type") === "QUOTE"
									const isWholesalePaymentPending =
										salesQuoteForm.getFieldValue("channel") === "WHOLESALE" &&
										salesQuoteForm.getFieldValue("paymentPending") === true
									const shouldSkipStep4 = isQuote || isWholesalePaymentPending
									if (shouldSkipStep4 && stepDef.number === 4) return null

									return (
										<div
											key={stepDef.number}
											className={cn(
												"flex flex-1 items-center",
												index === steps.length - (shouldSkipStep4 ? 2 : 1) ? "w-fit flex-0" : ""
											)}
										>
											{/* T-05: In edit mode circles are interactive navigation buttons.
											    In create mode disabled={true} makes them inert — DOM/visual unchanged.
											    type="button" is MANDATORY: this element is inside <salesQuoteForm.Form>
											    and a default-type button would submit the form. */}
											<button
												type="button"
												disabled={!editMode}
												onClick={() => {
													// T-04: When navigating to the passengers step (step 3)
													// in edit mode, reconcile immediately so the passenger
													// array is guaranteed to reflect the latest event counts
													// even if the reactive effect hasn't fired yet.
													if (editMode && stepDef.number === 3) {
														reconcilePassengerArray(salesQuoteForm, salesQuoteForm.state.values)
													}
													step.goToStep(stepDef.number)
												}}
												aria-current={
													currentStep === stepDef.number ? "step" : undefined
												}
												data-testid={`sales-step-circle-${stepDef.number}`}
												className={cn(
													"flex w-fit flex-col items-center",
													editMode && "cursor-pointer"
												)}
											>
												<div
													className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold transition-colors ${
														currentStep === stepDef.number
															? "border-primary bg-primary text-white"
															: currentStep > stepDef.number
																? "border-primary bg-primary/10 text-primary"
																: "border-border bg-background text-muted-foreground"
													}`}
												>
													{stepDef.number}
												</div>

												<div className="mt-2 hidden text-center lg:block">
													<p
														className={`text-sm font-medium text-nowrap ${
															currentStep === stepDef.number ? "text-primary" : "text-muted-foreground"
														}`}
													>
														{stepDef.title}
													</p>
												</div>
											</button>

											{index < steps.length - 1 && (
												<div
													className={`h-0.5 flex-1 transition-colors ${currentStep > stepDef.number ? "bg-primary" : "bg-border"}`}
												/>
											)}
										</div>
									)
								})}
							</div>

							<salesQuoteForm.Subscribe
								selector={(state) => ({
									fieldMeta: state.fieldMeta,
									submissionAttempts: state.submissionAttempts,
								})}
							>
								{(formState) => <ErrorSummary formState={formState} />}
							</salesQuoteForm.Subscribe>

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
								{/* In edit mode show "Guardar cambios" plus a "Continuar" button on
								    every non-last step (free navigation, no per-step validation gate).
								    The user can also navigate via step circles. Create mode is unchanged. */}
								{editMode ? (
									<div className="flex w-full items-center justify-end gap-3">
										<salesQuoteForm.SubmitButton
											label="Guardar cambios"
											type="button"
											onClick={() => {
												// Clear any stale onDynamic errors injected by the previous
												// failed save BEFORE handleSubmit runs. Without this, a stale
												// error (e.g. paymentArray from a prior IMMEDIATE-wholesale
												// save) would fire onSubmitInvalid and permanently block the
												// form even after the user corrects the underlying condition.
												// The TanStack Form setFieldMeta signature is highly generic;
												// cast to the narrow testable interface at the call site.
												clearInjectedErrors(salesQuoteForm as any, injectedPathsRef.current)
												injectedPathsRef.current = new Set()
												salesQuoteForm.handleSubmit()
											}}
											className="bg-primary text-white hover:bg-orange-600"
											data-testid="sales-button-form-submit"
										/>
										{(() => {
											const isQuote = salesQuoteForm.getFieldValue("type") === "QUOTE"
											const isWholesalePaymentPending =
												salesQuoteForm.getFieldValue("channel") === "WHOLESALE" &&
												salesQuoteForm.getFieldValue("paymentPending") === true
											const isLastVisibleStep =
												step.isCompleted ||
												((isQuote || isWholesalePaymentPending) && currentStep === 3)

											// No "Continuar" on the last step — there is no next step.
											if (isLastVisibleStep) return null

											return (
												<salesQuoteForm.StepButton
													variant={"outline"}
													label={
														<>
															Continuar <ChevronRightIcon />
														</>
													}
													handleMovement={handleEditNext}
													data-testid="sales-button-step-next"
												/>
											)
										})()}
									</div>
								) : (
									<>
										<salesQuoteForm.StepButton
											variant={"outline"}
											label={
												<>
													<ChevronLeftIcon /> Anterior
												</>
											}
											disabled={isFirstStep}
											handleMovement={step.goToPrevStep}
										/>
										{(() => {
											const isQuote = salesQuoteForm.getFieldValue("type") === "QUOTE"
											const isWholesalePaymentPending =
												salesQuoteForm.getFieldValue("channel") === "WHOLESALE" &&
												salesQuoteForm.getFieldValue("paymentPending") === true
											const shouldSubmitOnStep3 =
												(isQuote || isWholesalePaymentPending) && currentStep === 3

											if (step.isCompleted || shouldSubmitOnStep3) {
												return (
													<div className="flex w-full items-center justify-end gap-3">
														<salesQuoteForm.SubmitButton
															label={
																isQuote ? "Crear Cotización" : "Crear Venta"
															}
															type="button"
															onClick={() => {
																if (shouldSubmitOnStep3) {
																	salesQuoteForm.handleSubmit()
																	return
																}

																handleNext()
															}}
															className="bg-primary text-white hover:bg-orange-600"
															data-testid="sales-button-form-submit"
														/>
													</div>
												)
											}

											return (
												<div className="flex w-full items-center justify-end gap-3">
													<salesQuoteForm.StepButton
														variant={"default"}
														className="bg-primary text-white hover:bg-orange-600"
														label={
															<>
																Siguiente <ChevronRightIcon />
															</>
														}
														handleMovement={handleNext}
														data-testid="sales-button-step-next"
													/>
												</div>
											)
										})()}
									</>
								)}
							</div>
						</div>

						<div className="hidden lg:block">
							<salesQuoteForm.Subscribe
								selector={(state) => ({
									values: state.values,
								})}
							>
								{({ values }) => (
									<SaleSummaryCard
										formData={values}
										agencyName={agencyName}
										wholesaleAgencyName={wholesaleAgencyName}
										availableTours={activeTours || []}
										selectedAgencyTourPricing={getSelectedAgencyPricing(values)}
										voucherNumber={summaryVoucher}
										isProjectedVoucher={!editMode}
									/>
								)}
							</salesQuoteForm.Subscribe>
						</div>
					</div>
				</salesQuoteForm.Form>
			</salesQuoteForm.AppForm>

			{/* Approval reason dialog — shown when non-admin edits an invoiced sale */}
			{editMode && editingRecordId && pendingApprovalPayload && (
				<RequestApprovalDialog
					open={approvalDialogOpen}
					onOpenChange={(open) => {
						setApprovalDialogOpen(open)
						if (!open) setPendingApprovalPayload(null)
					}}
					action={APPROVAL_ACTION.UPDATE_INVOICED_SALE}
					targetType="sale-record"
					targetId={editingRecordId}
					targetLabel="Venta facturada"
					payload={pendingApprovalPayload}
					isAdmin={false}
					onSuccess={() => {
						setApprovalDialogOpen(false)
						setPendingApprovalPayload(null)
						toast.success("Solicitud enviada. Te avisamos cuando sea aprobada.")
					}}
				/>
			)}
		</div>
	)
}
