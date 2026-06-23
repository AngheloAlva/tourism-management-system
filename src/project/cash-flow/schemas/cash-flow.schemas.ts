import { z } from "zod"

export const cashCountSchema = z.object({
	type: z.enum(["OPENING", "CLOSING"]),
	countedAmount: z
		.number({ message: "El monto es requerido" })
		.min(0, "El monto debe ser positivo"),
	notes: z.string().optional(),
})

export type CashCountFormSchema = z.infer<typeof cashCountSchema>

export const cashDepositSchema = z.object({
	amount: z.number({ message: "El monto es requerido" }).positive("El monto debe ser mayor a 0"),
	bankAccount: z.string().optional(),
	reference: z.string().optional(),
	notes: z.string().optional(),
})

export type CashDepositFormSchema = z.infer<typeof cashDepositSchema>

export const supplierPaymentSchema = z.object({
	amount: z.number({ message: "El monto es requerido" }).positive("El monto debe ser mayor a 0"),
	supplier: z
		.string({ message: "El proveedor es requerido" })
		.min(1, "Ingrese el nombre del proveedor"),
	concept: z.string({ message: "El concepto es requerido" }).min(1, "Ingrese el concepto del pago"),
	invoiceNumber: z.string().optional(),
	notes: z.string().optional(),
	providerId: z.string().optional(),
})

export type SupplierPaymentFormSchema = z.infer<typeof supplierPaymentSchema>

export const otherExpenseSchema = z.object({
	amount: z.number({ message: "El monto es requerido" }).positive("El monto debe ser mayor a 0"),
	description: z
		.string({ message: "La descripción es requerida" })
		.min(1, "Ingrese una descripción"),
	category: z.enum(["SUPPLIES", "TRANSPORTATION", "FOOD", "OTHER"], {
		message: "Seleccione una categoría",
	}),
	reference: z.string().optional(),
})

export type OtherExpenseFormSchema = z.infer<typeof otherExpenseSchema>

export const cashIncomeSchema = z.object({
	amount: z.number({ message: "El monto es requerido" }).positive("El monto debe ser mayor a 0"),
	description: z
		.string({ message: "La descripción es requerida" })
		.min(1, "Ingrese una descripción"),
	reference: z.string().optional(),
	paymentRecordId: z.string().optional(),
})

export type CashIncomeFormSchema = z.infer<typeof cashIncomeSchema>
