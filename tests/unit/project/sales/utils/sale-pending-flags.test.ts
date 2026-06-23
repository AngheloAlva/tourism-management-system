import { describe, expect, test } from "vitest"
import {
	deriveFileNumberPending,
	derivePaymentPending,
} from "@/project/sales/utils/sale-form-mappers"

describe("deriveFileNumberPending", () => {
	test("is true for a WHOLESALE sale with no file number (null)", () => {
		expect(deriveFileNumberPending({ channel: "WHOLESALE", fileNumber: null })).toBe(true)
	})

	test("is true for a WHOLESALE sale with an empty file number", () => {
		expect(deriveFileNumberPending({ channel: "WHOLESALE", fileNumber: "" })).toBe(true)
	})

	test("is true for a WHOLESALE sale with a whitespace-only file number", () => {
		// mirrors the step-1 schema validation which trims before checking emptiness
		expect(deriveFileNumberPending({ channel: "WHOLESALE", fileNumber: "   " })).toBe(true)
	})

	test("is false for a WHOLESALE sale that already has a file number", () => {
		expect(deriveFileNumberPending({ channel: "WHOLESALE", fileNumber: "F-123" })).toBe(false)
	})

	test("is false for a non-WHOLESALE sale even without a file number", () => {
		expect(deriveFileNumberPending({ channel: "ONLINE", fileNumber: null })).toBe(false)
		expect(deriveFileNumberPending({ channel: "PHYSICAL", fileNumber: null })).toBe(false)
	})
})

describe("derivePaymentPending", () => {
	test("is true for a WHOLESALE sale whose payment term is POSTPAID", () => {
		expect(derivePaymentPending({ channel: "WHOLESALE", wholesalePaymentTerm: "POSTPAID" })).toBe(
			true
		)
	})

	test("is false for a WHOLESALE sale whose payment term is IMMEDIATE", () => {
		expect(
			derivePaymentPending({ channel: "WHOLESALE", wholesalePaymentTerm: "IMMEDIATE" })
		).toBe(false)
	})

	test("is false for a non-WHOLESALE sale even if the term is POSTPAID (inconsistent data)", () => {
		expect(derivePaymentPending({ channel: "ONLINE", wholesalePaymentTerm: "POSTPAID" })).toBe(
			false
		)
	})
})
