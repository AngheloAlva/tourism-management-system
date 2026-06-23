import { describe, expect, it } from "vitest"
import { collectFormErrors } from "@/shared/utils/collect-form-errors"

describe("collectFormErrors", () => {
	it("returns empty array when fieldMeta is empty", () => {
		expect(collectFormErrors({})).toEqual([])
	})

	it("returns empty array when all meta entries are undefined", () => {
		const fieldMeta = { foo: undefined, bar: undefined }
		expect(collectFormErrors(fieldMeta)).toEqual([])
	})

	it("returns empty array when all error arrays are empty", () => {
		const fieldMeta = { foo: { errors: [] }, bar: { errors: [] } }
		expect(collectFormErrors(fieldMeta)).toEqual([])
	})

	it("collects plain string errors", () => {
		const fieldMeta = {
			foo: { errors: ["Error A"] },
		}
		expect(collectFormErrors(fieldMeta)).toEqual(["Error A"])
	})

	it("collects errors from multiple fields in first-seen order", () => {
		const fieldMeta = {
			alpha: { errors: ["First error"] },
			beta: { errors: ["Second error"] },
		}
		const result = collectFormErrors(fieldMeta)
		expect(result).toEqual(["First error", "Second error"])
	})

	it("normalizes object errors to their .message property", () => {
		const fieldMeta = {
			foo: { errors: [{ message: "Object error message" }] },
		}
		expect(collectFormErrors(fieldMeta)).toEqual(["Object error message"])
	})

	it("handles mixed string and object errors in the same field", () => {
		const fieldMeta = {
			foo: { errors: ["String error", { message: "Object error" }] },
		}
		expect(collectFormErrors(fieldMeta)).toEqual(["String error", "Object error"])
	})

	it("handles mixed string and object errors across multiple fields", () => {
		const fieldMeta = {
			alpha: { errors: ["String error"] },
			beta: { errors: [{ message: "Object error" }] },
		}
		expect(collectFormErrors(fieldMeta)).toEqual(["String error", "Object error"])
	})

	it("deduplicates identical error messages across fields", () => {
		const fieldMeta = {
			alpha: { errors: ["Duplicate error"] },
			beta: { errors: ["Duplicate error"] },
		}
		expect(collectFormErrors(fieldMeta)).toEqual(["Duplicate error"])
	})

	it("deduplicates identical errors within the same field", () => {
		const fieldMeta = {
			foo: { errors: ["Same error", "Same error"] },
		}
		expect(collectFormErrors(fieldMeta)).toEqual(["Same error"])
	})

	it("deduplicates string and object errors with the same message", () => {
		const fieldMeta = {
			alpha: { errors: ["Shared message"] },
			beta: { errors: [{ message: "Shared message" }] },
		}
		expect(collectFormErrors(fieldMeta)).toEqual(["Shared message"])
	})

	it("skips items with no message (empty string)", () => {
		const fieldMeta = {
			foo: { errors: ["", "Valid error"] },
		}
		expect(collectFormErrors(fieldMeta)).toEqual(["Valid error"])
	})

	it("skips object errors with empty .message", () => {
		const fieldMeta = {
			foo: { errors: [{ message: "" }, { message: "Real error" }] },
		}
		expect(collectFormErrors(fieldMeta)).toEqual(["Real error"])
	})

	it("skips object errors with no .message property", () => {
		const fieldMeta = {
			foo: { errors: [{ code: "too_small" }, { message: "Valid" }] },
		}
		expect(collectFormErrors(fieldMeta)).toEqual(["Valid"])
	})

	it("skips null and undefined items in the errors array", () => {
		const fieldMeta = {
			foo: { errors: [null, undefined, "Valid error"] as unknown[] },
		} as Parameters<typeof collectFormErrors>[0]
		expect(collectFormErrors(fieldMeta)).toEqual(["Valid error"])
	})

	it("skips items that are neither string nor object with message", () => {
		const fieldMeta = {
			foo: { errors: [42, true, "Real error"] as unknown[] },
		} as Parameters<typeof collectFormErrors>[0]
		expect(collectFormErrors(fieldMeta)).toEqual(["Real error"])
	})

	it("preserves first-seen order and deduplicates correctly in complex case", () => {
		const fieldMeta = {
			paymentArray: { errors: ["Debe agregar al menos un pago para una venta"] },
			eventBookings: { errors: ["Debe haber al menos 1 pasajero"] },
			paymentArray2: { errors: ["Debe agregar al menos un pago para una venta"] }, // duplicate
		}
		expect(collectFormErrors(fieldMeta)).toEqual([
			"Debe agregar al menos un pago para una venta",
			"Debe haber al menos 1 pasajero",
		])
	})
})
