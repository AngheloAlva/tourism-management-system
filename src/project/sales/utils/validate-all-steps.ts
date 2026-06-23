import type { ZodIssue } from "zod"
import {
	saleRecordFormSchema,
	buildSaleRecordFormSteps,
	type SaleFormMode,
} from "../schemas/sale-record.schema"
import type { SaleRecordFormSchema } from "../schemas/sale-record.schema"

/**
 * Validate form values against ALL step schemas in sequence, aggregate issues.
 *
 * Also runs the full base schema so cross-field refinements (e.g. "SALE requires
 * at least one payment") are enforced even when only a subset of steps is
 * visited. The base schema's issues have paths like ["paymentArray"], which
 * are correctly mapped to step 4 by `firstFailingStepIndex`.
 *
 * Used exclusively in EDIT mode to ensure "Guardar cambios" enforces the same
 * invariants as the sequential create wizard (which validates step-by-step).
 *
 * The `mode` param controls step-2 past-date behaviour:
 * - "create" (default): past event dates are blocked.
 * - "edit": past event dates are NOT blocked (non-blocking UI warning instead).
 * Min-passenger and all other invariants are enforced in both modes.
 *
 * Returns an empty array when all steps are valid.
 */
export function validateAllSteps(
	values: SaleRecordFormSchema,
	mode: SaleFormMode = "create",
): ZodIssue[] {
	const allIssues: ZodIssue[] = []
	const steps = buildSaleRecordFormSteps(mode)

	// Run each step schema (catches per-step field/refinement errors)
	for (const stepSchema of steps) {
		const result = stepSchema.safeParse(values)
		if (!result.success) {
			allIssues.push(...result.error.issues)
		}
	}

	// Also run the full base schema to catch cross-field refinements that are
	// only present on saleRecordFormSchema itself (e.g. "SALE needs ≥1 payment").
	// Deduplicate by path+message to avoid surfacing the same error twice.
	const baseResult = saleRecordFormSchema.safeParse(values)
	if (!baseResult.success) {
		for (const issue of baseResult.error.issues) {
			const key = JSON.stringify(issue.path) + issue.message
			const duplicate = allIssues.some(
				(existing) => JSON.stringify(existing.path) + existing.message === key
			)
			if (!duplicate) {
				allIssues.push(issue)
			}
		}
	}

	return allIssues
}

/**
 * Given a list of aggregated Zod issues (from validateAllSteps), return the
 * 0-based index of the FIRST step that has at least one issue, or -1 if none.
 *
 * Step index mapping:
 *   0 → step 1 (General info: type, channel, agencyId, fileNumber, …)
 *   1 → step 2 (Events: eventBookings with passenger count + date checks)
 *   2 → step 3 (Passengers: passengerArray)
 *   3 → step 4 (Payments: paymentArray, discount)
 *
 * The top-level field name in each issue path is compared against the fields
 * owned by each step schema.
 */
const STEP_FIELDS: ReadonlyArray<ReadonlySet<string>> = [
	// Step 1
	new Set([
		"type",
		"channel",
		"comments",
		"agencyId",
		"fileNumber",
		"fileNumberPending",
		"isWholesale",
		"wholesaleAgencyId",
		"wholesaleMarkup",
		"paymentPending",
	]),
	// Step 2
	new Set(["eventBookings"]),
	// Step 3
	new Set(["passengerArray"]),
	// Step 4
	new Set(["paymentArray", "discount"]),
]

export function firstFailingStepIndex(issues: ZodIssue[]): number {
	for (let i = 0; i < STEP_FIELDS.length; i++) {
		const fields = STEP_FIELDS[i]
		const hasIssue = issues.some((issue) => {
			const topField = Array.isArray(issue.path) ? String(issue.path[0] ?? "") : ""
			return fields.has(topField)
		})
		if (hasIssue) return i
	}
	return -1
}
