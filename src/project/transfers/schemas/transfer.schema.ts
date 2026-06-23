import { z } from "zod"

import { TRANSFER_TYPE, TRANSFER_PAYMENT_STATUS } from "../constants/enums"
import { PAYMENT_METHOD } from "@/project/sales/constants/enums"
import { todayInSantiago, isPastEventDate } from "@/shared/utils/calendar-day"

export type TransferFormMode = "create" | "edit"

export const transferPaymentStatusEnum = z.enum(TRANSFER_PAYMENT_STATUS, {
	message: "El estado de pago es obligatorio",
})

export const transferTypeEnum = z.enum(TRANSFER_TYPE, {
	message: "El tipo de transferencia es obligatorio",
})

export const passengerPriceSchema = z.object({
	clientId: z.string().optional(),
	passengerId: z.string().min(1, "ID de pasajero obligatorio"),
	sourceSaleRecordId: z.string().min(1, "ID de voucher origen obligatorio"),
	sourceVoucher: z.number().optional(),
	isSelected: z.boolean().default(true),
	isAlreadyTransferred: z.boolean().default(false),
	passengerName: z.string(),
	ageCategory: z.string().min(1, "La categoría de edad es obligatoria"),
	tourPrice: z.number().min(0, "El precio del tour debe ser mayor o igual a 0"),
	entrancePrice: z.number().min(0, "El precio de entrada debe ser mayor o igual a 0"),
	totalPrice: z.number(),
})

export const eventTransferSchema = z.object({
	clientId: z.string().optional(),
	eventId: z.string().min(1, "ID del evento es obligatorio"),
	transferEvent: z.boolean(),
	passengerPrices: z.array(passengerPriceSchema).default([]),
})

export const paymentSchema = z
	.object({
		clientId: z.string().optional(),
		refund: z.boolean(),
		method: z.enum(PAYMENT_METHOD, { message: "El método de pago es obligatorio" }),
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

export const transferSchema = z
	.object({
		type: transferTypeEnum,
		agencyId: z.string().min(1, "Debe seleccionar una agencia"),
		date: z.date({ message: "La fecha es obligatoria" }),
		paymentStatus: transferPaymentStatusEnum,
		comments: z.string().optional(),
		saleRecordId: z.string().optional(),
		eventTransfers: z
			.array(eventTransferSchema)
			.min(1, "Debe seleccionar al menos un evento")
			.refine((events) => events.some((e) => e.transferEvent), {
				message: "Debe seleccionar al menos un evento para transferir",
			})
			.refine(
				(events) =>
					events.some(
						(event) =>
							event.transferEvent &&
							(event.passengerPrices || []).some((passenger) => passenger.isSelected)
					),
				{
					message: "Debe seleccionar al menos un pasajero para transferir",
				}
			)
			.refine(
				(events) =>
					events.every((event) =>
						(event.passengerPrices || []).every(
							(passenger) => !passenger.isSelected || !passenger.isAlreadyTransferred
						)
					),
				{
					message: "No se pueden transferir pasajeros que ya fueron traspasados",
				}
			),
		payments: z.array(paymentSchema).optional(),
	})
	.superRefine((data, ctx) => {
		if (data.paymentStatus !== "PENDING" && (!data.payments || data.payments.length === 0)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Debe agregar al menos un pago para este estado de pago",
				path: ["payments"],
			})
		}
	})

// Schemas por pasos (static, compat exports — CREATE semantics)
export const step1TransferSchema = z.object({
	type: transferTypeEnum,
	agencyId: z.string().min(1, "Debe seleccionar una agencia"),
	date: z.date({ message: "La fecha es obligatoria" }),
	paymentStatus: transferPaymentStatusEnum,
	comments: z.string().optional(),
	saleRecordId: z.string().min(1, "Debe seleccionar un voucher"),
	eventTransfers: z
		.array(eventTransferSchema)
		.min(1, "Debe seleccionar al menos un evento")
		.refine((events) => events.some((e) => e.transferEvent), {
			message: "Debe seleccionar al menos un evento para transferir",
		})
		.refine(
			(events) =>
				events.some(
					(event) =>
						event.transferEvent &&
						(event.passengerPrices || []).some((passenger) => passenger.isSelected)
				),
			{
				message: "Debe seleccionar al menos un pasajero para transferir",
			}
		)
		.refine(
			(events) =>
				events.every((event) =>
					(event.passengerPrices || []).every(
						(passenger) => !passenger.isSelected || !passenger.isAlreadyTransferred
					)
				),
			{
				message: "No se pueden transferir pasajeros que ya fueron traspasados",
			}
		),
})

export const step2TransferSchema = z.object({
	payments: z.array(paymentSchema).optional(),
})

// ─── Mode-aware factories ─────────────────────────────────────────────────────

/**
 * Build the step-1 schema for a given mode.
 * - Past-date BLOCKS in "create" mode only. In "edit" no issue is emitted.
 * - Uses todayInSantiago() for TZ-correct boundary.
 */
function buildStep1TransferSchema(mode: TransferFormMode) {
	return step1TransferSchema.superRefine((data, ctx) => {
		if (mode === "create" && isPastEventDate(data.date, todayInSantiago())) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "La fecha del evento debe ser hoy o posterior",
				path: ["date"],
			})
		}
	})
}

/**
 * Build the final transfer schema for a given mode.
 * Includes:
 * - payments required when paymentStatus !== "PENDING"
 * - past-date blocking in "create" mode only
 */
export function buildTransferSchema(mode: TransferFormMode) {
	return transferSchema.superRefine((data, ctx) => {
		if (mode === "create" && isPastEventDate(data.date, todayInSantiago())) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "La fecha del evento debe ser hoy o posterior",
				path: ["date"],
			})
		}
	})
}

/**
 * Build the full 2-step schema array for a given mode.
 * Step 1 is mode-aware (past-date). Step 2 is mode-agnostic.
 */
export function buildTransferSteps(mode: TransferFormMode) {
	return [buildStep1TransferSchema(mode), step2TransferSchema]
}

export type TransferFormData = z.infer<typeof transferSchema>
export type EventTransfer = z.infer<typeof eventTransferSchema>
export type PassengerPrice = z.infer<typeof passengerPriceSchema>
