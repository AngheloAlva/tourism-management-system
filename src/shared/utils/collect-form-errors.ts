/**
 * Normalizes a single error item from TanStack Form's fieldMeta.errors array.
 * Items may be plain strings (injected via errorMap.onDynamic) or
 * Zod-validator error objects ({ message?: string }).
 * Returns the normalized string or null if the item should be skipped.
 */
function normalizeErrorItem(item: unknown): string | null {
	if (typeof item === "string") {
		return item.length > 0 ? item : null
	}
	if (item !== null && typeof item === "object" && "message" in item) {
		const msg = (item as { message?: unknown }).message
		if (typeof msg === "string" && msg.length > 0) {
			return msg
		}
	}
	return null
}

/**
 * Collects all unique, non-empty error messages from TanStack Form's fieldMeta.
 * Returns them in first-seen order.
 *
 * Handles both string errors (errorMap.onDynamic injections) and
 * object-shaped errors ({ message: string }) produced by Zod validators.
 */
export function collectFormErrors(
	fieldMeta: Partial<Record<string, { errors?: unknown[] } | undefined>>
): string[] {
	const seen = new Set<string>()
	const result: string[] = []

	for (const meta of Object.values(fieldMeta)) {
		if (!meta?.errors?.length) continue
		for (const item of meta.errors) {
			const msg = normalizeErrorItem(item)
			if (msg !== null && !seen.has(msg)) {
				seen.add(msg)
				result.push(msg)
			}
		}
	}

	return result
}
