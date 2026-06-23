import { z } from "zod"

import { SALE_TYPE, CHANNEL_TYPE } from "../constants/enums"

// VOUCHER_STATUS is a Prisma enum not exported from the TS constants file.
// Hardcoded as a const tuple to keep the schema self-contained.
const VOUCHER_STATUS = ["TO_BE_DONE", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const

/**
 * Resilient filter schema for sale record list queries.
 *
 * Design goals:
 * - Every field is optional; an empty object parses to {}.
 * - Enum fields use .catch(undefined) so an invalid value (e.g. tampered POST)
 *   silently falls back to undefined instead of failing the whole parse.
 * - search is capped at 200 chars to prevent absurdly large `contains` queries.
 *   An oversized value also degrades to undefined via .catch(undefined).
 * - Date fields use z.coerce.date() to accept both Date objects and ISO strings.
 * - String fields are trimmed; empty strings become undefined.
 */
export const saleRecordFiltersSchema = z.object({
	type: z
		.enum(SALE_TYPE)
		.optional()
		.catch(undefined),

	channel: z
		.enum(CHANNEL_TYPE)
		.optional()
		.catch(undefined),

	sellerId: z
		.string()
		.trim()
		.optional()
		.transform((v) => (v === "" ? undefined : v))
		.catch(undefined),

	wholesaleAgencyId: z
		.string()
		.trim()
		.optional()
		.transform((v) => (v === "" ? undefined : v))
		.catch(undefined),

	startDate: z
		.coerce.date()
		.optional()
		.catch(undefined),

	endDate: z
		.coerce.date()
		.optional()
		.catch(undefined),

	clientEmail: z
		.string()
		.trim()
		.optional()
		.transform((v) => (v === "" ? undefined : v))
		.catch(undefined),

	status: z
		.enum(VOUCHER_STATUS)
		.optional()
		.catch(undefined),

	search: z
		.string()
		.trim()
		.max(200)
		.optional()
		.transform((v) => (v === "" ? undefined : v))
		.catch(undefined),
})
	// .partial() forces every key optional in the inferred type. Without it, the
	// .transform() on string fields (sellerId, clientEmail, search, ...) wraps the
	// .optional() in a ZodPipe and makes those KEYS required, breaking callers like
	// useState<SaleRecordFilters>({ type: mode }).
	.partial()

export type SaleRecordFilters = z.infer<typeof saleRecordFiltersSchema>
