import type { ZodIssue } from "zod"
import {
	receptionSchema,
	buildReceptionFormSteps,
	type ReceptionFormMode,
	type ReceptionFormData,
} from "../schemas/reception.schema"

/**
 * Validate reception form values against ALL step schemas, aggregate issues.
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
export function validateAllReceptionSteps(
	values: ReceptionFormData,
	mode: ReceptionFormMode = "create",
): ZodIssue[] {
	const allIssues: ZodIssue[] = []
	const steps = buildReceptionFormSteps(mode)

	for (const stepSchema of steps) {
		const result = stepSchema.safeParse(values)
		if (!result.success) {
			allIssues.push(...result.error.issues)
		}
	}

	// Also run the full base schema to catch cross-field refinements.
	// Deduplicate by path+message.
	const baseResult = receptionSchema.safeParse(values)
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
 * Step field ownership for reception form.
 * Step 1: events / general info
 * Step 2: passengers
 * Step 3: payments
 */
const RECEPTION_STEP_FIELDS: ReadonlyArray<ReadonlySet<string>> = [
	new Set(["agencyId", "date", "paymentStatus", "eventDetails", "comments"]),
	new Set(["passengers"]),
	new Set(["payments"]),
]

/**
 * Return the 0-based index of the FIRST step that has at least one Zod issue,
 * or -1 if there are none.
 */
export function firstFailingReceptionStepIndex(issues: ZodIssue[]): number {
	for (let i = 0; i < RECEPTION_STEP_FIELDS.length; i++) {
		const fields = RECEPTION_STEP_FIELDS[i]
		const hasIssue = issues.some((issue) => {
			const topField = Array.isArray(issue.path) ? String(issue.path[0] ?? "") : ""
			return fields.has(topField)
		})
		if (hasIssue) return i
	}
	return -1
}
