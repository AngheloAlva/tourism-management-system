import type { ZodIssue } from "zod"
import {
	transferSchema,
	buildTransferSteps,
	buildTransferSchema,
	type TransferFormMode,
	type TransferFormData,
} from "../schemas/transfer.schema"

/**
 * Validate transfer form values against ALL step schemas, aggregate issues.
 *
 * Also runs the full base schema so cross-field refinements (e.g. "non-PENDING
 * status requires at least one payment") are enforced even when only a subset
 * of steps is visited.
 *
 * Used exclusively in EDIT mode so "Guardar Cambios" from any step enforces
 * the same invariants as the sequential create wizard.
 *
 * Returns an empty array when all steps are valid.
 */
export function validateAllTransferSteps(
	values: TransferFormData,
	mode: TransferFormMode = "create",
): ZodIssue[] {
	const allIssues: ZodIssue[] = []
	const steps = buildTransferSteps(mode)

	for (const stepSchema of steps) {
		const result = stepSchema.safeParse(values)
		if (!result.success) {
			allIssues.push(...result.error.issues)
		}
	}

	// Also run the mode-aware full schema to catch cross-field refinements.
	// Deduplicate by path+message.
	const fullSchema = buildTransferSchema(mode)
	const baseResult = fullSchema.safeParse(values)
	if (!baseResult.success) {
		for (const issue of baseResult.error.issues) {
			const key = JSON.stringify(issue.path) + issue.message
			const duplicate = allIssues.some(
				(existing) => JSON.stringify(existing.path) + existing.message === key,
			)
			if (!duplicate) {
				allIssues.push(issue)
			}
		}
	}

	return allIssues
}

/**
 * Step field ownership for transfer form.
 * Step 1: info / event selection
 * Step 2: payments
 */
const TRANSFER_STEP_FIELDS: ReadonlyArray<ReadonlySet<string>> = [
	new Set(["type", "agencyId", "date", "paymentStatus", "comments", "saleRecordId", "eventTransfers"]),
	new Set(["payments"]),
]

/**
 * Return the 0-based index of the FIRST step that has at least one Zod issue,
 * or -1 if there are none.
 */
export function firstFailingTransferStepIndex(issues: ZodIssue[]): number {
	for (let i = 0; i < TRANSFER_STEP_FIELDS.length; i++) {
		const fields = TRANSFER_STEP_FIELDS[i]
		const hasIssue = issues.some((issue) => {
			const topField = Array.isArray(issue.path) ? String(issue.path[0] ?? "") : ""
			return fields.has(topField)
		})
		if (hasIssue) return i
	}
	return -1
}
