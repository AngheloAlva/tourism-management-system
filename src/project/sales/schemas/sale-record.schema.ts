import { z } from "zod"

import {
	DIET_TYPE,
	SALE_MODE,
	SALE_TYPE,
	CHANNEL_TYPE,
	PAYMENT_METHOD,
	PAYMENT_CURRENCY,
} from "../constants/enums"
import { todayInSantiago, isPastEventDate } from "@/shared/utils/calendar-day"
import { toHHmm } from "../utils/normalize-time"
import { passengerOverflowCount } from "../utils/reconcile-passengers"
import { getComplimentaryCategoryOptions } from "../utils/complimentary-category-options"

export type SaleFormMode = "create" | "edit"

// ─── Schemas: separated tour pricing and entries ─────────────────────────

export const bookingPriceEntrySchema = z.object({
	priceCategoryId: z.string(),
	categoryName: z.string(),
	count: z.number().int().min(0),
	price: z.number().min(0),
	reception: z.number().min(0),
})

export const bookingEntrySnapshotSchema = z.object({
	tourEntryId: z.string(),
	entryName: z.string(),
	categoryName: z.string(),
	variantName: z.string(),
	count: z.number().int().min(0),
	price: z.number().min(0),
})

const hhmmRegex = /^([01]\d|2[0-3]):[0-5]\d$/

// Tour/event times are free `String?` columns (many migrated from Excel), so they
// arrive in inconsistent shapes — seconds, fractional seconds, single-digit
// hours, a 12h meridiem. Normalize to canonical `HH:mm` before validating so
// legacy data passes instead of raising a false "invalid format" error.
const timeField = z
	.string()
	.transform((v) => toHHmm(v))
	.refine((v) => v === "" || hhmmRegex.test(v), "Formato de hora inválido (HH:mm)")
	.optional()
	.or(z.literal(""))

export const eventBookingSchema = z.object({
	clientId: z.string().optional(),
	mode: z.enum(SALE_MODE, { message: "El modo de venta es obligatorio" }),
	date: z.date({ error: "La fecha del evento es obligatoria" }),
	tourId: z.string().min(1, "El tour es obligatorio"),
	eventId: z.string().optional(),
	startTime: timeField,
	endTime: timeField,

	flyTime: z.string().optional(),
	flyDate: z.date().optional(),
	flyName: z.string().optional(),

	specialRequest: z.string().optional(),
	comments: z.string().optional(),

	priceEntries: z.array(bookingPriceEntrySchema).default([]),
	entrySnapshots: z.array(bookingEntrySnapshotSchema).default([]),

	excludedPassengers: z
		.array(
			z.object({
				passengerIndex: z.number().int().min(0),
				excludeReason: z.string().optional(),
			})
		)
		.default([]),
})

export const passengerHotelSchema = z.object({
	clientId: z.string().optional(),
	hotelName: z.string().optional(),
	checkIn: z.coerce.date().optional(),
	checkOut: z.coerce.date().optional(),
	order: z.number().int().default(0),
})

export const passengerSchema = z.object({
	clientId: z.string().optional(),
	name: z.string().optional(),
	rut: z.string().optional(),
	age: z.number().optional(),
	nacionality: z.string().optional(),
	diet_type: z.enum(DIET_TYPE).optional(),
	dietOther: z.string().optional(),
	allergies: z.array(z.string()).default([]),
	entryTypeCode: z.string().optional(),
	phone: z.string().optional(),
	hotels: z.array(passengerHotelSchema).default([]),
	email: z.email().optional().or(z.literal("")),
	complimentary: z.boolean().default(false),
	complimentaryCategory: z.string().optional(),
})

export const paymentSchema = z
	.object({
		clientId: z.string().optional(),
		refund: z.boolean(),
		method: z.enum(PAYMENT_METHOD, { message: "El método de pago es obligatorio" }),
		currency: z.enum(PAYMENT_CURRENCY).default("CLP"),
		amount: z.number().positive("El monto debe ser mayor a 0"),
		exchange_rate: z.number().positive("El tipo de cambio debe ser mayor a 0").optional(),
		movement_date: z.date({
			error: "La fecha del movimiento es obligatoria",
		}),
		document_number: z.string().optional(),
		comments: z.string().optional(),
		paymentProof: z.string().optional(),
	})
	.refine((data) => !(data.document_number === "" && data.method !== "CASH"), {
		message: "El número de documento es obligatorio para este medio de pago",
		path: ["document_number"],
	})
	.superRefine((data, ctx) => {
		if (data.currency === "USD" && (!data.exchange_rate || data.exchange_rate <= 0)) {
			ctx.addIssue({
				code: "custom",
				message: "Debe indicar el tipo de cambio para pagos en USD",
				path: ["exchange_rate"],
			})
		}
	})

export const saleRecordFormSchema = z
	.object({
		type: z.enum(SALE_TYPE, { message: "El tipo de registro es obligatorio" }),
		channel: z.enum(CHANNEL_TYPE, {
			message: "El canal de venta es obligatorio",
		}),
		comments: z.string().optional(),
		agencyId: z.string().optional(),
		fileNumber: z.string().optional(),
		fileNumberPending: z.boolean(),
		codePrefix: z.string().optional(),
		codeLength: z.number().optional(),
		isWholesale: z.boolean(),
		wholesaleAgencyId: z.string().optional(),
		wholesaleMarkup: z.number().optional(),
		paymentPending: z.boolean(),
		eventBookings: z.array(eventBookingSchema),
		passengerArray: z.array(passengerSchema),
		paymentArray: z.array(paymentSchema).default([]),
		discount: z.number().optional(),
		// Campo para rastrear conversión de cotización a venta
		convertedFromQuoteId: z.string().optional(),
	})
	.superRefine((data, ctx) => {
		// No requerir pagos si es cotización o si es venta a mayorista con pago pendiente
		const skipPaymentValidation =
			data.type === "QUOTE" || (data.channel === "WHOLESALE" && data.paymentPending === true)

		if (data.type === "SALE" && data.paymentArray.length === 0 && !skipPaymentValidation) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Debe agregar al menos un pago para una venta",
				path: ["paymentArray"],
			})
		}

		// Passenger overflow check: more passengers listed than what the event
		// bookings charge for. Only checked when there are bookings (skip otherwise
		// to avoid false positives during form initialization).
		// NOTE: this refine lives ONLY on the base schema. Step schemas are built
		// via .pick(...) which strips base refines, so per-step create validation
		// will NOT trigger this prematurely.
		const overflow = passengerOverflowCount(data)
		if (overflow > 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["passengerArray"],
				message: `Hay ${overflow} pasajero(s) de más respecto a lo cobrado. Eliminá el/los sobrante(s) antes de guardar.`,
			})
		}

		// Hard-block: complimentary passenger without a category in a REGULAR-mode sale.
		// Delegates to shared helper so STEP_3_SCHEMA stays in sync (W-1 fix).
		applyCompCategoryRefine(data, ctx)
	})

// ─── Shared comp-category refine ─────────────────────────────────────────────
//
// Hard-block: a complimentary passenger MUST pick a category ONLY when the sale
// exposes MORE THAN ONE selectable category. Categories come from the
// REGULAR-mode bookings' priceEntries (PRIVATE bookings carry none).
//   - 0 options → PRIVATE / no named categories: the form shows "En modo privado
//     no requiere categoría" and never renders a select.
//   - 1 option  → a single category: it is the only possible one, so the form
//     hides the select and assumes it (the pricing core deducts the comp from
//     that sole category even with an empty complimentaryCategory).
// In both cases requiring a selection here would raise an unfixable invisible
// error. Mirror the UI gate exactly via getComplimentaryCategoryOptions so the
// schema and the form agree on when a category is required.
// Extracted so STEP_3_SCHEMA and saleRecordFormSchema stay in sync.

type CompRefineInput = {
	eventBookings: EventBookingSchema[]
	passengerArray: Array<{ complimentary: boolean; complimentaryCategory?: string }>
}

function applyCompCategoryRefine(
	data: CompRefineInput,
	ctx: import("zod").RefinementCtx
) {
	const categoryOptions = getComplimentaryCategoryOptions(data.eventBookings)
	if (categoryOptions.length <= 1) return
	data.passengerArray.forEach((passenger, i) => {
		if (passenger.complimentary && !passenger.complimentaryCategory?.trim()) {
			ctx.addIssue({
				code: "custom",
				message: "Seleccioná una categoría para el pasajero liberado",
				path: ["passengerArray", i, "complimentaryCategory"],
			})
		}
	})
}

// ─── Step schema constants (mode-agnostic) ────────────────────────────────────

const STEP_1_SCHEMA = saleRecordFormSchema
	.pick({
		type: true,
		channel: true,
		comments: true,
		agencyId: true,
		fileNumber: true,
		fileNumberPending: true,
		isWholesale: true,
		wholesaleAgencyId: true,
		wholesaleMarkup: true,
		paymentPending: true,
	})
	.superRefine((data, ctx) => {
		if (data.channel === "WHOLESALE") {
			if (!data.agencyId || data.agencyId.trim() === "") {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Debe seleccionar un mayorista",
					path: ["agencyId"],
				})
			}
			if (!data.fileNumberPending && (!data.fileNumber || data.fileNumber.trim() === "")) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Debe ingresar el número de file o marcarlo como pendiente",
					path: ["fileNumber"],
				})
			}
		}
		if (
			(data.channel === "ONLINE" || data.channel === "PHYSICAL") &&
			data.isWholesale &&
			(!data.wholesaleAgencyId || data.wholesaleAgencyId.trim() === "")
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Debe seleccionar una agencia mayorista",
				path: ["wholesaleAgencyId"],
			})
		}
	})

// STEP_3_SCHEMA picks both passengerArray and eventBookings so the comp-category
// hard-block refine (which reads both fields) can fire at step 3, not only at
// final submit. Exported for unit testing.
export const STEP_3_SCHEMA = saleRecordFormSchema
	.pick({
		passengerArray: true,
		eventBookings: true,
	})
	.superRefine(applyCompCategoryRefine)

const STEP_4_SCHEMA = saleRecordFormSchema.pick({
	paymentArray: true,
	discount: true,
})

// ─── Step-2 schema factory ────────────────────────────────────────────────────

/**
 * Build the step-2 schema for the given form mode.
 * - min-passenger ALWAYS blocks (both modes).
 * - past-date blocks ONLY in "create" mode; in "edit" it is silent (the UI
 *   surfaces a non-blocking amber warning via isPastEventDate).
 * Uses todayInSantiago() for the TZ-correct boundary — replaces the previous
 * buggy `new Date().setHours(0,0,0,0)` (machine-local TZ, wrong on UTC server).
 * Returns a ZodObject (pick().superRefine()) — NOT ZodEffects — so it remains
 * assignable to the ZodObject[] type required by useFormStepper.
 */
export function buildStep2Schema(mode: SaleFormMode) {
	return saleRecordFormSchema
		.pick({
			eventBookings: true,
		})
		.superRefine((data, ctx) => {
			const today = todayInSantiago()
			for (let i = 0; i < data.eventBookings.length; i++) {
				const booking = data.eventBookings[i]
				const totalPassengers = (booking.priceEntries || []).reduce(
					(sum, entry) => sum + (entry.count || 0),
					0
				)
				if (totalPassengers < 1) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "Debe haber al menos 1 pasajero",
						path: ["eventBookings", i, "priceEntries"],
					})
				}
				// Past-date BLOCKS only on create. On edit: no issue emitted.
				// The UI renders a non-blocking amber warning instead.
				if (mode === "create" && isPastEventDate(booking.date, today)) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "La fecha del evento debe ser hoy o posterior",
						path: ["eventBookings", i, "date"],
					})
				}
			}
		})
}

// ─── Step array factory ───────────────────────────────────────────────────────

/**
 * Build the full 4-step schema array for a given mode.
 * Steps 1, 3, 4 are mode-agnostic. Only step 2 varies.
 */
export function buildSaleRecordFormSteps(mode: SaleFormMode) {
	return [STEP_1_SCHEMA, buildStep2Schema(mode), STEP_3_SCHEMA, STEP_4_SCHEMA]
}

// Exported array — public stepper contract, always CREATE semantics.
// useFormStepper uses this for per-step gating in the create wizard.
// Edit submit uses buildSaleRecordFormSteps("edit") via validateAllSteps instead.
export const saleRecordFormSteps = buildSaleRecordFormSteps("create")

export type SaleRecordFormSchema = z.infer<typeof saleRecordFormSchema>
export type SaleRecord = SaleRecordFormSchema
export type EventBookingSchema = SaleRecord["eventBookings"][number]
export type BookingPriceEntryFormSchema = EventBookingSchema["priceEntries"][number]
export type BookingEntrySnapshotFormSchema = EventBookingSchema["entrySnapshots"][number]
export type PassengerDetail = SaleRecord["passengerArray"][number]
export type PaymentDetail = SaleRecord["paymentArray"][number]
export type PassengerHotelSchema = z.infer<typeof passengerHotelSchema>
