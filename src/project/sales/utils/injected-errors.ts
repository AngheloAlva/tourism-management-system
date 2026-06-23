import type { ZodIssue } from "zod"

/**
 * Minimal interface required by clearInjectedErrors.
 *
 * Accepting this narrow interface (rather than the full TanStack Form type)
 * makes the helper trivially unit-testable with a plain mock object and
 * avoids importing React/TanStack Form in a pure utility module.
 *
 * The errorMap values are typed as `unknown` to stay compatible with
 * TanStack Form's `ValidationErrorMap` (which uses `unknown` for onServer
 * and other non-string slots). The helper only writes `undefined` for
 * `onDynamic` — it never reads or asserts other errorMap values.
 */
export interface FormWithSetFieldMeta {
	setFieldMeta(
		name: string,
		updater: (prev: FieldMetaLike) => FieldMetaLike,
	): void
}

export interface FieldMetaLike {
	errorMap?: Record<string, unknown>
	[key: string]: unknown
}

/**
 * Clear the `onDynamic` error from each field path previously injected by a
 * failed edit-mode save (the `onSubmit` byField loop in sales-quote-form).
 *
 * Only `errorMap.onDynamic` is cleared — all other errorMap keys (onChange,
 * onBlur, etc.) and all other meta fields (isTouched, …) are left untouched.
 *
 * Call this BEFORE `form.handleSubmit()` on the next save attempt so that
 * `validateAllSteps` is the single source of truth and stale errors cannot
 * permanently block the form.
 */
export function clearInjectedErrors(
	form: FormWithSetFieldMeta,
	paths: ReadonlySet<string>,
): void {
	for (const path of paths) {
		form.setFieldMeta(path, (prev) => ({
			...(prev ?? {}),
			errorMap: {
				...(prev?.errorMap ?? {}),
				onDynamic: undefined,
			},
		}))
	}
}

/**
 * Build a Set of dot-joined field paths from a list of Zod issues.
 *
 * Used by `onSubmit` to record which paths it injected, so they can be
 * cleared before the next submit attempt. Issues with empty paths are
 * silently skipped (they have no field anchor). Duplicate paths are
 * deduplicated automatically by the Set.
 */
export function collectInjectedPaths(issues: ZodIssue[]): Set<string> {
	const paths = new Set<string>()
	for (const issue of issues) {
		if (Array.isArray(issue.path) && issue.path.length > 0) {
			paths.add(issue.path.join("."))
		}
	}
	return paths
}
