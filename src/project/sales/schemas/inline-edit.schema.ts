import { z } from "zod"

// Shared base: every inline-edit action requires a non-empty saleRecordId
const SaleIdSchema = z.object({
	saleRecordId: z.string().min(1),
})

/**
 * Schema for updateSaleFileInfo action.
 *
 * Design note (ADR-10): `fileNumberPending` is NOT a DB column — "pending" is
 * encoded as `fileNumber === null`. The UI exposes a "Pendiente" switch that,
 * when ON, calls this action with `fileNumber: null`.
 *
 * - Empty string is coerced to null (UI may send "").
 * - Max 120 chars (safe default — no VarChar constraint in schema.prisma).
 */
export const updateSaleFileInfoSchema = SaleIdSchema.extend({
	fileNumber: z
		.string()
		.trim()
		.max(120)
		.nullable()
		.transform((val) => (val === "" ? null : val))
		.or(z.null()),
})

export type UpdateSaleFileInfoInput = z.infer<typeof updateSaleFileInfoSchema>

/**
 * Schema for updateSaleAgency action.
 *
 * - agencyId: the new agency ID to write to the resolved FK column; null = clear.
 * - expectedUpdatedAt: optimistic concurrency token (coerced from string/Date).
 */
export const updateSaleAgencySchema = SaleIdSchema.extend({
	agencyId: z.string().nullable(),
	expectedUpdatedAt: z.coerce.date(),
})

export type UpdateSaleAgencyInput = z.infer<typeof updateSaleAgencySchema>

/**
 * Schema for updateSaleComments action.
 *
 * - Empty string is coerced to null.
 * - Max 2000 chars (design decision; spec originally said 1000 but design says 2000).
 */
export const updateSaleCommentsSchema = SaleIdSchema.extend({
	comments: z
		.string()
		.trim()
		.max(2000)
		.transform((val) => (val === "" ? null : val))
		.nullable()
		.or(z.null()),
})

export type UpdateSaleCommentsInput = z.infer<typeof updateSaleCommentsSchema>

/**
 * Schema for updateSaleFlags action.
 *
 * - contacted: boolean (non-nullable in DB).
 */
export const updateSaleFlagsSchema = SaleIdSchema.extend({
	contacted: z.boolean(),
})

export type UpdateSaleFlagsInput = z.infer<typeof updateSaleFlagsSchema>
