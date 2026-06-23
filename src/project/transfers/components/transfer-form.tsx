"use client"

import { Loader2, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useStore } from "@tanstack/react-form"
import { toast } from "sonner"

import { useCreateTransfer, useEventsForTransfer, useUpdateTransfer } from "../hooks/use-transfers"
import { useAppForm } from "@/shared/components/ui/tanstack-form"
import { useFormStepper } from "@/shared/hooks/use-stepper"
import { createClientId } from "@/shared/lib/create-client-id"
import { cn } from "@/lib/utils"
import {
	buildTransferSteps,
	buildTransferSchema,
	step2TransferSchema,
	type TransferFormData,
} from "../schemas/transfer.schema"
import { validateAllTransferSteps, firstFailingTransferStepIndex } from "../utils/validate-all-steps"
import { deriveReconcileKey } from "../utils/reconcile-key"

import { TransferEventsFormGroup } from "./transfer-events-form-group"
import { TransferInfoFormGroup } from "./transfer-info-form-group"
import { TransferSummaryCard } from "./transfer-summary-card"
import { TransferPaymentsFormGroup } from "./transfer-payments-form-group"
import { ErrorSummary } from "@/shared/components/ui/error-summary"
import { Button } from "@/shared/components/ui/button"
import { Textarea } from "@/shared/components/ui/textarea"
import { Label } from "@/shared/components/ui/label"
import {
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	CardDescription,
} from "@/shared/components/ui/card"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/shared/components/ui/dialog"

import { getPricesByAge } from "@/shared/utils/entry-type-pricing"
import { shouldClearPendingPayments } from "@/shared/utils/payment-status-sync"
import type { SaleRecordWithDetails } from "@/project/sales/actions/sale-record.actions"

interface TransferFormProps {
	onSuccess?: () => void
	initialData?: TransferFormData
	mode?: "create" | "edit"
	transferId?: string
	/** Voucher number for the approval dialog label (optional, cosmetic) */
	transferVoucher?: number
}

const TRANSFER_FORM_DRAFT_KEY = "transfer-form-draft-v1"
const DRAFT_EXPIRY_MS = 60 * 60 * 1000 // 1 hour

export function TransferForm({ onSuccess, initialData, mode = "create", transferId, transferVoucher }: TransferFormProps) {
	const isEditMode = mode === "edit"
	const createTransfer = useCreateTransfer()
	const updateTransfer = useUpdateTransfer()
	const { data: eventsData, isLoading: isLoadingEvents } = useEventsForTransfer(
		isEditMode ? transferId : undefined
	)

	// Approval reason dialog state (wiring B: re-call updateTransfer with reason)
	const [approvalDialogOpen, setApprovalDialogOpen] = useState(false)
	const [pendingApprovalPayload, setPendingApprovalPayload] = useState<TransferFormData | null>(null)
	const [approvalReason, setApprovalReason] = useState("")
	const [approvalReasonError, setApprovalReasonError] = useState("")
	const [isSubmittingWithReason, setIsSubmittingWithReason] = useState(false)

	// Estado para selección de evento y modo de traspaso
	// En modo edición se inicializa desde initialData
	const [selectedEventId, setSelectedEventId] = useState<string>(
		() => initialData?.eventTransfers?.[0]?.eventId ?? ""
	)
	const [transferFullEvent, setTransferFullEvent] = useState<boolean>(() => {
		if (!isEditMode || !initialData) return true
		// Infer from initialData: if passengers come from multiple vouchers, it was a full-event transfer
		const sourceSaleIds = new Set(
			initialData.eventTransfers?.flatMap((et) =>
				et.passengerPrices.map((p) => p.sourceSaleRecordId)
			) ?? []
		)
		return sourceSaleIds.size > 1
	})
	const [selectedVoucherId, setSelectedVoucherId] = useState<string>(
		() => initialData?.saleRecordId ?? ""
	)
	const [showPendingDialog, setShowPendingDialog] = useState(false)
	const draftHydratedRef = useRef(false)
	const isHydratingDraftRef = useRef(false)
	// editInitializedRef gates the reconciliation effect in edit mode only.
	// In create mode this ref stays false permanently — the effect always runs on
	// every reconcileKey change, which is the desired CREATE behaviour.
	const editInitializedRef = useRef(false)

	const events = eventsData || []
	const selectedEvent = useMemo(
		() => events.find((e) => e.id === selectedEventId) || null,
		[events, selectedEventId]
	)

	// Construir objeto similar a SaleRecordWithDetails para compatibilidad visual
	const selectedSale = useMemo((): SaleRecordWithDetails | null => {
		if (!selectedEvent) return null

		const salesToInclude = transferFullEvent
			? selectedEvent.saleRecords.filter((saleRecord) => saleRecord.availablePassengerCount > 0)
			: selectedEvent.saleRecords.filter((s) => s.id === selectedVoucherId)

		if (salesToInclude.length === 0) return null

		const allPassengers = salesToInclude.flatMap((sale) => sale.passengers)

		return {
			id: transferFullEvent ? selectedEvent.id : selectedVoucherId,
			voucher: salesToInclude[0].voucher,
			type: "SALE",
			eventBookings: [
				{
					id: selectedEvent.id,
					passengerCount: allPassengers.length,
					event: {
						id: selectedEvent.id,
						date: selectedEvent.date,
						mode: selectedEvent.mode,
						startTime: selectedEvent.startTime,
						endTime: null,
						tour: selectedEvent.tour,
					},
				},
			],
			passengers: allPassengers.map((p) => ({
				id: p.id,
				name: p.name,
				age: p.age,
				document: null,
				nationality: null,
				diet: null,
				dietOther: null,
				phone: null,
				hotel: null,
				email: null,
			})),
		} as unknown as SaleRecordWithDetails
	}, [selectedEvent, transferFullEvent, selectedVoucherId])

	const transferSteps = buildTransferSteps(mode)
	const { currentStep, isFirstStep, currentValidator, reset, step } = useFormStepper(transferSteps)

	const clearDraft = useCallback(() => {
		if (typeof window === "undefined") return
		window.localStorage.removeItem(TRANSFER_FORM_DRAFT_KEY)
	}, [])

	const saveDraft = useCallback(
		(values: TransferFormData) => {
			if (typeof window === "undefined") return

			const payload = {
				_savedAt: Date.now(),
				values: {
					...values,
					date: values.date instanceof Date ? values.date.toISOString() : values.date,
					payments: (values.payments || []).map((payment) => ({
						...payment,
						date: payment.date instanceof Date ? payment.date.toISOString() : payment.date,
					})),
				},
				ui: {
					selectedEventId,
					selectedVoucherId,
					transferFullEvent,
				},
			}

			window.localStorage.setItem(TRANSFER_FORM_DRAFT_KEY, JSON.stringify(payload))
		},
		[selectedEventId, selectedVoucherId, transferFullEvent]
	)

	const form = useAppForm({
		defaultValues: initialData ?? ({
			type: "OUTGOING" as const,
			saleRecordId: "",
			date: new Date(),
			agencyId: "",
			paymentStatus: "PENDING" as const,
			comments: "",
			eventTransfers: [],
			payments: [],
		} as TransferFormData),
		validators: {
			onDynamic: currentValidator as any,
		},
		onSubmit: async ({ value }) => {
			try {
				if (isEditMode && transferId) {
					// Full-form validation for edit mode: "Guardar Cambios" can be triggered
					// from any step, so we must enforce ALL step invariants here.
					const issues = validateAllTransferSteps(value, "edit")
					if (issues.length > 0) {
						const byField = new Map<string, string>()
						for (const issue of issues) {
							const fieldPath = issue.path.join(".")
							if (fieldPath && !byField.has(fieldPath)) {
								byField.set(fieldPath, issue.message)
							}
						}
						for (const [fieldPath, message] of byField.entries()) {
							form.setFieldMeta(fieldPath as any, (prev) => ({
								...(prev ?? {}),
								errorMap: {
									...(prev?.errorMap ?? {}),
									onDynamic: message,
								},
							}))
						}
						const failingIdx = firstFailingTransferStepIndex(issues)
						if (failingIdx >= 0) {
							step.goToStep(failingIdx + 1)
						}
						toast.error("Corrige los errores antes de guardar")
						return
					}

					const result = await updateTransfer.mutateAsync({ id: transferId, data: value })
					if (!result.success) return // hook already toasted error

					// Large change — server needs a reason before creating the request
					if ("approvalRequired" in result && result.approvalRequired && "needsReason" in result && result.needsReason) {
						setPendingApprovalPayload(value)
						setApprovalReason("")
						setApprovalReasonError("")
						setApprovalDialogOpen(true)
						return
					}

					// Approval request already created — notify and stay
					if ("approvalRequired" in result && result.approvalRequired) {
						toast.success("Solicitud enviada a autorización.")
						return
					}

					// Direct success (small change or admin)
					if (onSuccess) onSuccess()
					return
				}

				const validated = buildTransferSchema(mode).safeParse(value)
				if (!validated.success) {
					toast.error("Revisa los campos obligatorios antes de continuar")
					return
				}

				if (transferFullEvent && selectedEvent && selectedEvent.saleRecords.length > 1) {
					const transfersByVoucher = selectedEvent.saleRecords
						.map((saleRecord) => {
							const filteredEventTransfers = (value.eventTransfers || [])
								.map((eventTransfer) => {
									const passengerPrices = (eventTransfer.passengerPrices || []).filter(
										(passenger) =>
											passenger.isSelected &&
											!passenger.isAlreadyTransferred &&
											passenger.sourceSaleRecordId === saleRecord.id
									)

									return {
										...eventTransfer,
										passengerPrices,
									}
								})
								.filter((eventTransfer) => eventTransfer.passengerPrices.length > 0)

							return {
								saleRecord,
								transferData: {
									...value,
									saleRecordId: saleRecord.id,
									eventTransfers: filteredEventTransfers,
								},
							}
						})
						.filter((item) => item.transferData.eventTransfers.length > 0)

					if (transfersByVoucher.length === 0) {
						toast.error("Debe seleccionar al menos un pasajero para transferir")
						return
					}

					let allSuccess = true
					for (const transferItem of transfersByVoucher) {
						const result = await createTransfer.mutateAsync(transferItem.transferData)
						if (!result.success) {
							allSuccess = false
							toast.error(`Error en voucher V-${transferItem.saleRecord.voucher}: ${result.error}`)
						}
					}

					if (allSuccess) {
						clearDraft()
						toast.success(`${transfersByVoucher.length} traspasos creados exitosamente`)
						resetFormState()
						if (onSuccess) onSuccess()
					}
				} else {
					const result = await createTransfer.mutateAsync(value)
					if (result.success) {
						clearDraft()
						toast.success("Traspaso creado exitosamente")
						resetFormState()
						if (onSuccess) onSuccess()
					} else {
						toast.error(result.error || "Error al crear el traspaso")
					}
				}
			} catch (error) {
				console.error("Error creating transfer:", error)
				toast.error("Error inesperado al crear el traspaso")
			}
		},
	})

	const resetFormState = () => {
		clearDraft()
		form.reset()
		reset()
		setSelectedEventId("")
		setSelectedVoucherId("")
		setTransferFullEvent(true)
	}

	useEffect(() => {
		if (isEditMode || typeof window === "undefined" || draftHydratedRef.current) return

		draftHydratedRef.current = true
		const rawDraft = window.localStorage.getItem(TRANSFER_FORM_DRAFT_KEY)
		if (!rawDraft) return

		try {
			isHydratingDraftRef.current = true
			const draft = JSON.parse(rawDraft) as {
				_savedAt?: number
				values?: Partial<TransferFormData>
				ui?: {
					selectedEventId?: string
					selectedVoucherId?: string
					transferFullEvent?: boolean
				}
			}

			if (draft._savedAt && Date.now() - draft._savedAt > DRAFT_EXPIRY_MS) {
				window.localStorage.removeItem(TRANSFER_FORM_DRAFT_KEY)
				return
			}

			if (draft.ui?.selectedEventId) setSelectedEventId(draft.ui.selectedEventId)
			if (typeof draft.ui?.transferFullEvent === "boolean") {
				setTransferFullEvent(draft.ui.transferFullEvent)
			}
			if (draft.ui?.selectedVoucherId) setSelectedVoucherId(draft.ui.selectedVoucherId)

			if (draft.values) {
				form.setFieldValue("type", draft.values.type ?? "OUTGOING")
				form.setFieldValue("saleRecordId", draft.values.saleRecordId ?? "")
				form.setFieldValue("date", draft.values.date ? new Date(draft.values.date) : new Date())
				form.setFieldValue("agencyId", draft.values.agencyId ?? "")
				form.setFieldValue("paymentStatus", draft.values.paymentStatus ?? "PENDING")
				form.setFieldValue("comments", draft.values.comments ?? "")
				form.setFieldValue("eventTransfers", draft.values.eventTransfers ?? [])
				form.setFieldValue(
					"payments",
					(draft.values.payments || []).map((payment) => ({
						...payment,
						clientId: payment.clientId || createClientId(),
						date: payment.date ? new Date(payment.date) : new Date(),
					}))
				)
			}
		} catch {
			window.localStorage.removeItem(TRANSFER_FORM_DRAFT_KEY)
		} finally {
			window.setTimeout(() => {
				isHydratingDraftRef.current = false
			}, 0)
		}
	}, [form])

	const formValues = useStore(form.store, (state) => state.values)
	const makePayment = formValues.paymentStatus !== "PENDING"
	const selectedVoucherTransferCount = useMemo(() => {
		if (!transferFullEvent || !selectedEvent) return 1

		const selectedVoucherIds = new Set(
			(formValues.eventTransfers || [])
				.filter((eventTransfer) => eventTransfer.transferEvent)
				.flatMap((eventTransfer) => eventTransfer.passengerPrices || [])
				.filter((passenger) => passenger.isSelected && !passenger.isAlreadyTransferred)
				.map((passenger) => passenger.sourceSaleRecordId)
		)

		return selectedVoucherIds.size
	}, [formValues.eventTransfers, selectedEvent, transferFullEvent])

	// Cuando cambia el evento seleccionado.
	// In edit mode: skip the FIRST fire (initialData already has correct values).
	// After the first fire, allow user-triggered event changes to recompute.
	useEffect(() => {
		if (isEditMode && !editInitializedRef.current) {
			// Mark hydrated — next fires (user changes event) will fall through
			editInitializedRef.current = true
			return
		}

		if (!selectedEvent) {
			form.setFieldValue("eventTransfers", [])
			form.setFieldValue("saleRecordId", "")
			return
		}

		const firstAvailableVoucher = selectedEvent.saleRecords.find(
			(saleRecord) => saleRecord.availablePassengerCount > 0
		)

		// Auto-seleccionar primer voucher si hay solo uno
		if (selectedEvent.saleRecords.length === 1) {
			setSelectedVoucherId(firstAvailableVoucher?.id || "")
			setTransferFullEvent(true)
		} else if (!transferFullEvent) {
			setSelectedVoucherId(firstAvailableVoucher?.id || "")
		} else {
			setSelectedVoucherId((currentVoucherId) => {
				if (!currentVoucherId) return firstAvailableVoucher?.id || ""
				const currentVoucher = selectedEvent.saleRecords.find(
					(sale) => sale.id === currentVoucherId
				)
				return currentVoucher?.availablePassengerCount
					? currentVoucherId
					: firstAvailableVoucher?.id || ""
			})
		}
	}, [selectedEvent, form, transferFullEvent, isEditMode])

	// Actualizar saleRecordId cuando cambia el voucher seleccionado
	useEffect(() => {
		if (transferFullEvent && selectedEvent) {
			const firstAvailableVoucher = selectedEvent.saleRecords.find(
				(saleRecord) => saleRecord.availablePassengerCount > 0
			)
			form.setFieldValue("saleRecordId", firstAvailableVoucher?.id || "")
		} else if (selectedVoucherId) {
			form.setFieldValue("saleRecordId", selectedVoucherId)
		} else {
			form.setFieldValue("saleRecordId", "")
		}
	}, [transferFullEvent, selectedEvent, selectedVoucherId, form])

	// Limpiar pagos si estado es PENDING
	useEffect(() => {
		if (formValues.paymentStatus === "PENDING") {
			// Guard prevents an infinite render loop (React #185): only write when
			// there is something to clear. See shouldClearPendingPayments.
			if (shouldClearPendingPayments(formValues.paymentStatus, formValues.payments)) {
				form.setFieldValue("payments", [])
			}
			// Bug 1: step 2 (payments) disappears when PENDING — navigate back to step 1.
			// Guard with isHydratingDraftRef so draft hydration doesn't force a step reset
			// before the user has had a chance to interact.
			if (currentStep === 2 && !isHydratingDraftRef.current) {
				step.goToStep(1)
			}
		}
	}, [formValues.paymentStatus, form, currentStep, step])

	// Anti-loop (React #185): derive a STABLE PRIMITIVE from eventTransfers that changes
	// iff the event/passenger SELECTION changes — NOT when the array is rewritten with
	// identical content. Mirrors sales-quote-form.tsx targetPassengerCount pattern.
	// React Compiler is ON — no manual useMemo/useCallback for this selector.
	// transferFullEvent and selectedVoucherId are included so that in CREATE mode,
	// switching the voucher mode or specific voucher without changing the event
	// still triggers reconciliation (FIX: CREATE regression).
	const reconcileKey = useStore(form.store, (s) =>
		deriveReconcileKey(s.values.eventTransfers ?? [], selectedEventId, transferFullEvent, selectedVoucherId)
	)

	// Passenger reconciliation effect.
	// CREATE mode: runs on every selectedSale/event/voucher/transferFullEvent/voucherId
	// change (original behaviour, all encoded via reconcileKey).
	// EDIT mode: runs when the user changes the event or voucher mode AFTER the initial
	// hydration guard (editInitializedRef=true). Rebuilds the passenger list from the
	// new event's sale records. Does NOT fire on scalar-only changes (agencyId, date,
	// comments) or on passengerPrices array rewrites with identical selection — those
	// leave reconcileKey unchanged → no loop.
	// Note (riesgo #5): in edit mode, once editInitializedRef is true, a reconcileKey
	// change re-derives passengers from server data (selectedEvent.saleRecords), which
	// INTENTIONALLY overwrites whatever the user had — the user explicitly changed the
	// event, so rebuilding from source is correct behaviour.
	useEffect(() => {
		if (isHydratingDraftRef.current) return

		if (isEditMode) {
			// Only recompute when event actually changed (reconcileKey dependency).
			// If the event hasn't loaded yet or is the same as initialData, skip.
			if (!selectedEvent) return
			// editInitializedRef is set true after first mount hydration.
			// Until then the form is hydrating from initialData — don't overwrite.
			if (!editInitializedRef.current) return
		}

		if (!selectedEvent) return
		if (!selectedSale) {
			form.setFieldValue("eventTransfers", [])
			return
		}

		const tour = selectedEvent.tour

		const sourceSales = transferFullEvent
			? selectedEvent.saleRecords.filter((saleRecord) => saleRecord.availablePassengerCount > 0)
			: selectedEvent.saleRecords.filter((saleRecord) => saleRecord.id === selectedVoucherId)

		if (sourceSales.length === 0) {
			form.setFieldValue("eventTransfers", [])
			return
		}

		const passengerPrices = sourceSales.flatMap((saleRecord) =>
			saleRecord.passengers.map((passenger) => {
				const priceCategories = tour.priceCategories || []
				const matched = getPricesByAge(priceCategories, passenger.age)
				const tourPrice = matched?.transferPrice ?? 0
				const ageCategory = matched?.name || "Adulto"
				// Pre-fill the per-passenger entrance fee from the matched price category.
				// The field stays editable in the form; when > 0 the "Precio Entrada" input
				// becomes visible (hasEntranceFee gate in transfer-events-form-group).
				const entrancePrice = matched?.entranceTotal ?? 0

				return {
					clientId: createClientId(),
					passengerId: passenger.id,
					sourceSaleRecordId: saleRecord.id,
					sourceVoucher: saleRecord.voucher,
					isSelected: !passenger.alreadyTransferred,
					isAlreadyTransferred: passenger.alreadyTransferred,
					passengerName: passenger.name || "Sin nombre",
					ageCategory,
					tourPrice,
					entrancePrice,
					totalPrice: tourPrice + entrancePrice,
				}
			})
		)

		const eventTransfers = [
			{
				clientId: createClientId(),
				eventId: selectedEvent.id,
				transferEvent: true,
				passengerPrices,
			},
		]

		form.setFieldValue("eventTransfers", eventTransfers as any)
		// Intentionally narrow dep array: reconcileKey is a stable primitive that
		// encodes selectedEventId + transferFullEvent + selectedVoucherId + pax selection.
		// Adding selectedEvent/selectedSale/form/transferFullEvent/selectedVoucherId
		// directly would cause an infinite loop (React #185) because this effect writes
		// to the form which recomputes those values. The narrowed array is correct.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [reconcileKey, isEditMode])

	const steps = [
		{ number: 1, title: "Información", description: "Datos del traspaso" },
		{ number: 2, title: "Pagos", description: "Registro de pagos" },
	]

	const handleNext = async () => {
		const validationResult = currentValidator.safeParse(form.state.values)

		if (!validationResult.success) {
			await form.validate("change")
			return
		}

		if (!isEditMode) saveDraft(form.state.values)

		if (!makePayment && currentStep === 1) {
			const paymentStatus = form.state.values.paymentStatus
			if (paymentStatus === "PENDING") {
				setShowPendingDialog(true)
				return
			}
			await form.handleSubmit()
			return
		}

		if (currentStep === step.count) {
			await form.handleSubmit()
			return
		}

		// Al avanzar al paso de pagos, asegurar que haya al menos un pago
		if (currentStep === 1 && makePayment) {
			const currentPayments = form.state.values.payments || []
			if (currentPayments.length === 0) {
				form.setFieldValue("payments", [
					{
						clientId: createClientId(),
						amount: "",
						refund: false,
						comments: "",
						method: "CASH" as const,
						date: new Date(),
						documentNumber: "",
					},
				])
			}
		}

		step.goToNextStep()
	}

	const handleEventChange = (eventId: string) => {
		setSelectedEventId(eventId)
	}

	const handleTransferModeChange = (fullEvent: boolean) => {
		setTransferFullEvent(fullEvent)
		if (!fullEvent && selectedEvent && selectedEvent.saleRecords.length > 0) {
			const firstAvailableVoucher = selectedEvent.saleRecords.find(
				(saleRecord) => saleRecord.availablePassengerCount > 0
			)
			setSelectedVoucherId(firstAvailableVoucher?.id || "")
		}
	}

	const handleVoucherChange = (voucherId: string) => {
		setSelectedVoucherId(voucherId)
	}

	return (
		<div className="flex flex-col gap-10 lg:flex-row lg:items-start">
			<div className="flex-1 space-y-6">
				{/* Stepper Header */}
				<div className="flex items-center justify-between gap-2 lg:px-4">
					{steps.map((s, index) => {
						if (s.number === 2 && !makePayment) return null

						return (
							<div
								key={s.number}
								className={cn(
									"flex flex-1 items-center",
									index === steps.length - 1 ? "w-fit flex-0" : "",
									s.number === 1 && !makePayment ? "w-fit flex-0" : ""
								)}
							>
								{/* Bug 2 / Feature: in edit mode circles are interactive navigation buttons.
								    In create mode disabled={true} keeps them inert — visual unchanged.
								    type="button" is MANDATORY inside a form or it defaults to submit.
								    Transfer edit mode freezes passengers from initialData, so no
								    passenger reconciliation is needed when navigating. */}
								<button
									type="button"
									disabled={!isEditMode}
									onClick={() => step.goToStep(s.number)}
									aria-current={currentStep === s.number ? "step" : undefined}
									className={cn(
										"flex w-fit flex-col items-center",
										isEditMode && "cursor-pointer"
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
												currentStep === s.number ? "text-primary" : "text-muted-foreground"
											}`}
										>
											{s.title}
										</p>
									</div>
								</button>
								{index < steps.length - (makePayment ? 1 : 2) && (
									<div
										className={`h-0.5 flex-1 transition-colors ${currentStep > s.number ? "bg-primary" : "bg-border"}`}
									/>
								)}
							</div>
						)
					})}
				</div>

				<form.AppForm>
					<form.Form className="space-y-6">
						{currentStep === 1 && (
							<div className="space-y-6">
								<TransferInfoFormGroup
									form={form}
									fields={
										{
											saleRecordId: "saleRecordId",
											date: "date",
											agencyId: "agencyId",
											paymentStatus: "paymentStatus",
											comments: "comments",
										} as any
									}
									isLoadingEvents={isLoadingEvents}
									events={events}
									selectedEvent={selectedEvent}
									transferFullEvent={transferFullEvent}
									onEventChange={handleEventChange}
									onTransferModeChange={handleTransferModeChange}
									onVoucherChange={handleVoucherChange}
									selectedVoucherId={selectedVoucherId}
								/>

								<TransferEventsFormGroup
									form={form}
									fields={{ eventTransfers: "eventTransfers" } as any}
									selectedSale={selectedSale}
									selectedVoucher={selectedVoucherId || selectedEventId}
								/>

								<form.Subscribe
									selector={(state) => ({
										fieldMeta: state.fieldMeta,
										submissionAttempts: state.submissionAttempts,
									})}
								>
									{(formState) => <ErrorSummary formState={formState} />}
								</form.Subscribe>
							</div>
						)}

						{currentStep === 2 && makePayment && (
							<Card>
								<CardHeader className="gap-0">
									<CardTitle>Registro de Pagos</CardTitle>
									<CardDescription>Ingrese los detalles de los pagos realizados</CardDescription>
								</CardHeader>
								<CardContent className="pt-6">
									<TransferPaymentsFormGroup
										form={form}
										fields={{ payments: "payments", comments: "comments" } as any}
									/>
								</CardContent>
							</Card>
						)}

						{/* Feature: in edit mode "Guardar Cambios" is always visible on every step.
						    Additionally show "Continuar" when not on the last step.
						    Create mode keeps the original per-step submit / next logic. */}
						<div className="flex justify-between pt-4">
							{/* "Anterior" only in create mode — edit uses step-circle navigation */}
							{!isEditMode && (
								<Button
									type="button"
									variant="outline"
									onClick={step.goToPrevStep}
									disabled={isFirstStep}
								>
									<ChevronLeft className="h-4 w-4" />
									Anterior
								</Button>
							)}

							{isEditMode ? (
								<div className="flex w-full items-center justify-end gap-3">
									{/* "Guardar Cambios" — always visible in edit, triggers full validation */}
									<Button
										type="button"
										disabled={updateTransfer.isPending}
										data-testid="transfers-button-form-submit"
										onClick={async () => {
											await form.handleSubmit()
										}}
										className="bg-primary text-white hover:bg-orange-600"
									>
										{updateTransfer.isPending ? (
											<>
												<Loader2 className="h-4 w-4 animate-spin" />
												Guardando...
											</>
										) : (
											<>
												<CheckCircle2 className="h-4 w-4" />
												Guardar Cambios
											</>
										)}
									</Button>
									{/* "Continuar" only when there is a next step */}
									{makePayment && currentStep < step.count && (
										<Button
											type="button"
											variant="outline"
											onClick={() => step.goToNextStep()}
										>
											Continuar
											<ChevronRight className="ml-2 h-4 w-4" />
										</Button>
									)}
								</div>
							) : (
								<div className="flex w-full items-center justify-end gap-3">
									{(!makePayment && currentStep === 1) || (makePayment && currentStep === 2) ? (
										<Button
											type="button"
											disabled={createTransfer.isPending || !selectedEvent}
											data-testid="transfers-button-form-submit"
											onClick={async () => {
												// Validar paso actual antes de submit
												const currentSchema = transferSteps[currentStep - 1]
												const result = currentSchema.safeParse(form.state.values)
												if (!result.success) {
													await form.validate("change")
													return
												}

												saveDraft(form.state.values)

												const paymentStatus = form.state.values.paymentStatus
												if (paymentStatus === "PENDING") {
													setShowPendingDialog(true)
													return
												}

												await form.handleSubmit()
											}}
											className="bg-primary text-white hover:bg-orange-600"
										>
											{createTransfer.isPending ? (
												<>
													<Loader2 className="h-4 w-4 animate-spin" />
													Guardando...
												</>
											) : (
												<>
													<CheckCircle2 className="h-4 w-4" />
													{transferFullEvent &&
													selectedEvent &&
													selectedEvent.saleRecords.length > 1
														? `Crear ${selectedVoucherTransferCount} Traspasos`
														: "Crear Traspaso"}
												</>
											)}
										</Button>
									) : (
										<Button
											type="button"
											onClick={handleNext}
											disabled={!selectedEvent}
											className="bg-primary text-white hover:bg-orange-600"
										>
											Siguiente
											<ChevronRight className="ml-2 h-4 w-4" />
										</Button>
									)}
								</div>
							)}
						</div>
					</form.Form>

				<AlertDialog open={showPendingDialog} onOpenChange={setShowPendingDialog}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Confirmar traspaso pendiente de pago</AlertDialogTitle>
							<AlertDialogDescription>
								Este traspaso quedará registrado sin pago asociado. ¿Deseas continuar?
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel onClick={() => setShowPendingDialog(false)}>
								Cancelar
							</AlertDialogCancel>
							<AlertDialogAction
								onClick={async () => {
									setShowPendingDialog(false)
									await form.handleSubmit()
								}}
							>
								Confirmar
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
				</form.AppForm>
			</div>

			<div className="hidden lg:block">
				<form.Subscribe selector={(state) => state.values}>
					{(values) => <TransferSummaryCard formData={values} selectedSale={selectedSale} />}
				</form.Subscribe>
			</div>

			{/* Approval reason dialog — wiring B: re-calls updateTransfer with reason
			    instead of going through requestApproval directly. Keeps a single server
			    entry point and avoids double ApprovalRequest creation. */}
			{isEditMode && transferId && pendingApprovalPayload && (
				<Dialog
					open={approvalDialogOpen}
					onOpenChange={(open) => {
						setApprovalDialogOpen(open)
						if (!open) {
							setPendingApprovalPayload(null)
							setApprovalReason("")
							setApprovalReasonError("")
						}
					}}
				>
					<DialogContent className="sm:max-w-md">
						<DialogHeader>
							<DialogTitle>Solicitar autorización</DialogTitle>
							<DialogDescription>
								Este cambio requiere aprobación de un administrador. Ingresá el motivo.
								{transferVoucher ? ` Traspaso #T-${transferVoucher}.` : ""}
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-4 py-2">
							<div className="space-y-2">
								<Label htmlFor="transfer-approval-reason">
									Motivo <span className="text-destructive">*</span>
								</Label>
								<Textarea
									id="transfer-approval-reason"
									placeholder="Explicá brevemente por qué necesitás realizar este cambio..."
									rows={4}
									value={approvalReason}
									onChange={(e) => {
										setApprovalReason(e.target.value)
										if (approvalReasonError) setApprovalReasonError("")
									}}
									disabled={isSubmittingWithReason}
								/>
								{approvalReasonError && (
									<p className="text-destructive text-sm">{approvalReasonError}</p>
								)}
							</div>
						</div>

						<DialogFooter className="flex gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									setApprovalDialogOpen(false)
									setPendingApprovalPayload(null)
									setApprovalReason("")
									setApprovalReasonError("")
								}}
								disabled={isSubmittingWithReason}
							>
								Cancelar
							</Button>
							<Button
								type="button"
								disabled={isSubmittingWithReason}
								onClick={async () => {
									if (!approvalReason.trim()) {
										setApprovalReasonError("El motivo es requerido")
										return
									}
									if (approvalReason.length > 1000) {
										setApprovalReasonError("El motivo no puede exceder los 1000 caracteres")
										return
									}
									setIsSubmittingWithReason(true)
									try {
										const result = await updateTransfer.mutateAsync({
											id: transferId,
											data: pendingApprovalPayload,
											reason: approvalReason.trim(),
										})
										if (!result.success) {
											// hook already toasted error
											return
										}
										if ("approvalRequired" in result && result.approvalRequired) {
											toast.success("Solicitud enviada a autorización.")
											setApprovalDialogOpen(false)
											setPendingApprovalPayload(null)
											setApprovalReason("")
											setApprovalReasonError("")
											return
										}
										// Shouldn't reach here (with reason it always goes through approval)
										// but handle gracefully
										toast.success("Traspaso actualizado correctamente.")
										setApprovalDialogOpen(false)
										setPendingApprovalPayload(null)
										if (onSuccess) onSuccess()
									} catch {
										toast.error("Error al enviar la solicitud de autorización")
									} finally {
										setIsSubmittingWithReason(false)
									}
								}}
							>
								{isSubmittingWithReason ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										Enviando...
									</>
								) : (
									"Solicitar autorización"
								)}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			)}
		</div>
	)
}
