import { describe, expect, it, vi } from "vitest"
import {
	clearInjectedErrors,
	collectInjectedPaths,
} from "@/project/sales/utils/injected-errors"
import type { ZodIssue } from "zod"

// ─── Minimal form-like interface for testing ────────────────────────────────

type FieldMeta = {
	errorMap: Record<string, string | undefined>
	isTouched: boolean
}

function makeFormMock(initialMeta: Record<string, FieldMeta> = {}) {
	const state: Record<string, FieldMeta> = { ...initialMeta }
	const calls: Array<{ name: string; updater: (prev: FieldMeta) => FieldMeta }> = []

	return {
		setFieldMeta(name: string, updater: (prev: FieldMeta) => FieldMeta) {
			const prev = state[name] ?? { errorMap: {}, isTouched: false }
			calls.push({ name, updater })
			state[name] = updater(prev)
		},
		_state: state,
		_calls: calls,
	}
}

// ─── clearInjectedErrors ────────────────────────────────────────────────────

describe("clearInjectedErrors", () => {
	it("clears onDynamic for each path in the set", () => {
		const form = makeFormMock({
			paymentArray: { errorMap: { onDynamic: "Debe agregar al menos un pago" }, isTouched: true },
			"eventBookings.0.date": { errorMap: { onDynamic: "Fecha inválida" }, isTouched: true },
		})

		const paths = new Set(["paymentArray", "eventBookings.0.date"])
		clearInjectedErrors(form, paths)

		expect(form._state["paymentArray"]?.errorMap.onDynamic).toBeUndefined()
		expect(form._state["eventBookings.0.date"]?.errorMap.onDynamic).toBeUndefined()
	})

	it("does NOT touch fields not in the paths set", () => {
		const form = makeFormMock({
			paymentArray: { errorMap: { onDynamic: "error on paymentArray" }, isTouched: true },
			agencyId: { errorMap: { onDynamic: "error on agencyId" }, isTouched: true },
		})

		clearInjectedErrors(form, new Set(["paymentArray"]))

		// paymentArray cleared
		expect(form._state["paymentArray"]?.errorMap.onDynamic).toBeUndefined()
		// agencyId untouched
		expect(form._state["agencyId"]?.errorMap.onDynamic).toBe("error on agencyId")
	})

	it("does NOT clear other errorMap keys (e.g. onChange, onBlur) on affected fields", () => {
		const form = makeFormMock({
			paymentArray: {
				errorMap: {
					onDynamic: "stale injected error",
					onChange: "onChange error",
					onBlur: "onBlur error",
				},
				isTouched: true,
			},
		})

		clearInjectedErrors(form, new Set(["paymentArray"]))

		expect(form._state["paymentArray"]?.errorMap.onDynamic).toBeUndefined()
		expect(form._state["paymentArray"]?.errorMap.onChange).toBe("onChange error")
		expect(form._state["paymentArray"]?.errorMap.onBlur).toBe("onBlur error")
	})

	it("does nothing for an empty paths set", () => {
		const form = makeFormMock({
			paymentArray: { errorMap: { onDynamic: "error" }, isTouched: true },
		})

		clearInjectedErrors(form, new Set())

		expect(form._calls).toHaveLength(0)
		expect(form._state["paymentArray"]?.errorMap.onDynamic).toBe("error")
	})

	it("preserves non-errorMap meta fields (e.g. isTouched) on cleared fields", () => {
		const form = makeFormMock({
			paymentArray: { errorMap: { onDynamic: "error" }, isTouched: true },
		})

		clearInjectedErrors(form, new Set(["paymentArray"]))

		expect(form._state["paymentArray"]?.isTouched).toBe(true)
	})

	it("handles fields with no prior meta (undefined prev) without throwing", () => {
		// setFieldMeta updater may receive an empty/undefined prev if the field was
		// never touched — the helper must not crash
		const form = makeFormMock()

		expect(() => clearInjectedErrors(form, new Set(["paymentArray"]))).not.toThrow()
	})
})

// ─── collectInjectedPaths ───────────────────────────────────────────────────

describe("collectInjectedPaths", () => {
	function makeIssue(path: (string | number)[], message = "error"): ZodIssue {
		return {
			code: "custom",
			path,
			message,
		} as ZodIssue
	}

	it("returns a Set of dot-joined paths from issues", () => {
		const issues = [
			makeIssue(["paymentArray"]),
			makeIssue(["eventBookings", 0, "date"]),
		]
		const result = collectInjectedPaths(issues)
		expect(result).toEqual(new Set(["paymentArray", "eventBookings.0.date"]))
	})

	it("deduplicates paths when multiple issues share the same field path", () => {
		const issues = [
			makeIssue(["paymentArray"], "error 1"),
			makeIssue(["paymentArray"], "error 2"),
			makeIssue(["agencyId"]),
		]
		const result = collectInjectedPaths(issues)
		expect(result.size).toBe(2)
		expect(result.has("paymentArray")).toBe(true)
		expect(result.has("agencyId")).toBe(true)
	})

	it("skips issues with empty path", () => {
		const issues = [
			makeIssue([], "root error"),
			makeIssue(["paymentArray"]),
		]
		const result = collectInjectedPaths(issues)
		expect(result.size).toBe(1)
		expect(result.has("paymentArray")).toBe(true)
	})

	it("returns an empty Set when given no issues", () => {
		expect(collectInjectedPaths([])).toEqual(new Set())
	})
})
