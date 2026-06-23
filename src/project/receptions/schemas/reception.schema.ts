import { z } from "zod"

import { DIET_TYPE, SALE_MODE, PAYMENT_METHOD } from "@/project/sales/constants/enums"
import { TRANSFER_PAYMENT_STATUS } from "@/project/transfers/constants/enums"
import { todayInSantiago, isPastEventDate } from "@/shared/utils/calendar-day"

export type ReceptionFormMode = "create" | "edit"

export const eventDetailSchema = z.object({
	clientId: z.string().optional(),
	mode: z.enum(SALE_MODE),
	date: z.date({ message: "La fecha del evento es obligatoria" }),
	tourId: z.string().min(1, "El tour es obligatorio"),
	eventId: z.string().optional(),
	startTime: z.string().optional(),
	endTime: z.string().optional(),
	flyTime: z.string().optional(),
	flyDate: z.string().optional(),
	flyName: z.string().optional(),
	comments: z.string().optional(),
	priceEntries: z
		.array(
			z.object({
				priceCategoryId: z.string(),
				categoryName: z.string(),
				count: z.number().int().min(0),
				price: z.number().min(0),
				reception: z.number().min(0),
			})
		)
		.default([]),
	entrySnapshots: z
		.array(
			z.object({
				tourEntryId: z.string(),
				entryName: z.string(),
				variantName: z.string(),
				categoryName: z.string(),
				count: z.number().int().min(0),
				price: z.number().min(0),
			})
		)
		.default([]),
})

const passengerHotelSchema = z.object({
	clientId: z.string().optional(),
	hotelName: z.string().optional(),
	checkIn: z.coerce.date().optional(),
	checkOut: z.coerce.date().optional(),
	order: z.number().int().default(0),
})

export const passengerSchema = z
	.object({
		clientId: z.string().optional(),
		name: z.string().min(1, "El nombre es obligatorio"),
		rut: z.string().optional(),
		age: z.coerce.number().optional(),
		nacionality: z.string().optional(),
		diet_type: z.enum(DIET_TYPE).optional(),
		dietOther: z.string().optional(),
		allergies: z.array(z.string()).default([]),
		phone: z.string().optional(),
		email: z.string().email().optional().or(z.literal("")),
		hotels: z.array(passengerHotelSchema).default([]),
	})
	.superRefine((data, ctx) => {
		if (data.diet_type === "OTHER" && !data.dietOther?.trim()) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["dietOther"],
				message: "Debe especificar el tipo de alimentación",
			})
		}
	})

// Schema flexible para el paso 2 - solo valida que exista al menos un pasajero
// La validación estricta de campos ocurre en el submit final
export const passengerSchemaStep = z.object({
	clientId: z.string().optional(),
	name: z.string().optional(),
	rut: z.string().optional(),
	age: z.coerce.number().optional(),
	nacionality: z.string().optional(),
	diet_type: z.enum(DIET_TYPE).optional().or(z.literal("")),
	dietOther: z.string().optional(),
	allergies: z.array(z.string()).default([]),
	phone: z.string().optional(),
	email: z.string().optional(),
	hotels: z.array(passengerHotelSchema).default([]),
})

export const paymentSchema = z
	.object({
		clientId: z.string().optional(),
		refund: z.boolean(),
		method: z.enum(PAYMENT_METHOD, "El método de pago es obligatorio"),
		amount: z.string().min(1, "El monto es obligatorio"),
		date: z.date({ message: "La fecha del movimiento es obligatoria" }),
		documentNumber: z.string().optional(),
		comments: z.string().optional(),
	})
	.superRefine((data, ctx) => {
		if (data.method !== "CASH" && !data.documentNumber?.trim()) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["documentNumber"],
				message: "El número de documento es obligatorio para este método de pago",
			})
		}
	})

export const receptionSchema = z
	.object({
		agencyId: z.string().min(1, "Debe seleccionar una agencia"),
		date: z.date({ message: "La fecha es obligatoria" }),
		paymentStatus: z.enum(TRANSFER_PAYMENT_STATUS, {
			message: "El estado de pago es obligatorio",
		}),
		eventDetails: z.array(eventDetailSchema).min(1, "Debe agregar al menos un evento"),
		comments: z.string().optional().or(z.literal("")),
		passengers: z.array(passengerSchema).min(1, "Debe agregar al menos un pasajero"),
		payments: z.array(paymentSchema),
	})
	.superRefine((data, ctx) => {
		if (data.paymentStatus !== "PENDING" && data.payments.length === 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Debe agregar al menos un pago para este estado de pago",
				path: ["payments"],
			})
		}
	})

// Schema flexible para validación por pasos (permite avanzar con datos parciales)
const receptionStepSchema = z.object({
	agencyId: z.string().min(1, "Debe seleccionar una agencia"),
	date: z.date({ message: "La fecha es obligatoria" }).default(() => new Date()),
	paymentStatus: z.enum(TRANSFER_PAYMENT_STATUS, {
		message: "El estado de pago es obligatorio",
	}),
	eventDetails: z.array(eventDetailSchema).min(1, "Debe agregar al menos un evento"),
	comments: z.string().optional().or(z.literal("")),
	passengers: z.array(passengerSchemaStep).min(1, "Debe agregar al menos un pasajero"),
	payments: z.array(paymentSchema),
})

const step1BaseSchema = receptionStepSchema.pick({
	agencyId: true,
	date: true,
	paymentStatus: true,
	eventDetails: true,
	comments: true,
})

const step1Schema = step1BaseSchema.superRefine((data, ctx) => {
	for (let i = 0; i < data.eventDetails.length; i++) {
		const event = data.eventDetails[i]
		if (
			event.priceEntries.length > 0 &&
			event.priceEntries.every((pe) => pe.count === 0)
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Debe ingresar al menos 1 pasajero en alguna categoría de precio",
				path: [`eventDetails`, i, "priceEntries"],
			})
		}
	}
})

/**
 * Build the step-1 schema for a given mode.
 * - Passenger count validation ALWAYS blocks (both modes).
 * - Past-date on eventDetails[].date BLOCKS only in "create" mode.
 *   In "edit" no issue is emitted (UI shows non-blocking warning).
 */
function buildStep1ReceptionSchema(mode: ReceptionFormMode) {
	return step1BaseSchema.superRefine((data, ctx) => {
		const today = todayInSantiago()

		for (let i = 0; i < data.eventDetails.length; i++) {
			const event = data.eventDetails[i]

			if (
				event.priceEntries.length > 0 &&
				event.priceEntries.every((pe) => pe.count === 0)
			) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Debe ingresar al menos 1 pasajero en alguna categoría de precio",
					path: [`eventDetails`, i, "priceEntries"],
				})
			}

			// Past-date BLOCKS only on create. On edit: no issue emitted.
			if (mode === "create" && isPastEventDate(event.date, today)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "La fecha del evento debe ser hoy o posterior",
					path: ["eventDetails", i, "date"],
				})
			}
		}
	})
}

/**
 * Build the full 3-step schema array for a given mode.
 * Step 1 is mode-aware (past-date). Steps 2-3 are mode-agnostic.
 */
export function buildReceptionFormSteps(mode: ReceptionFormMode) {
	return [
		buildStep1ReceptionSchema(mode),
		receptionStepSchema.pick({
			passengers: true,
		}),
		receptionStepSchema.pick({
			payments: true,
		}),
	]
}

// Compatibility export — CREATE semantics (matches previous static array behavior).
export const receptionFormSteps = buildReceptionFormSteps("create")

export type ReceptionFormData = z.infer<typeof receptionSchema>
export type ReceptionGeneralInfoFormGroup = Pick<
	ReceptionFormData,
	"agencyId" | "date" | "paymentStatus" | "eventDetails" | "comments"
>
export type ReceptionPassengersFormGroup = Pick<ReceptionFormData, "passengers">
export type ReceptionPaymentsFormGroup = Pick<ReceptionFormData, "payments">
