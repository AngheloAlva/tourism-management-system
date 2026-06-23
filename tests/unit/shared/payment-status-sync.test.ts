import { describe, expect, it } from "vitest"
import { shouldClearPendingPayments } from "@/shared/utils/payment-status-sync"

describe("shouldClearPendingPayments", () => {
	// Regression guard for React error #185 ("Maximum update depth exceeded"):
	// the PENDING payment-status effect ran on every render, and an unconditional
	// form.setFieldValue("payments", []) re-rendered the form forever. Clearing
	// must be a no-op when there is nothing to clear.
	it("returns false when PENDING and payments is already empty (no redundant write → no loop)", () => {
		expect(shouldClearPendingPayments("PENDING", [])).toBe(false)
	})

	it("returns false when PENDING and payments is undefined", () => {
		expect(shouldClearPendingPayments("PENDING", undefined)).toBe(false)
	})

	it("returns false when PENDING and payments is null", () => {
		expect(shouldClearPendingPayments("PENDING", null)).toBe(false)
	})

	it("returns true when PENDING and there are payments to clear", () => {
		expect(shouldClearPendingPayments("PENDING", [{ amount: "100" }])).toBe(true)
	})

	it("returns false for non-PENDING statuses regardless of payments", () => {
		expect(shouldClearPendingPayments("FULLY_PAID", [{ amount: "100" }])).toBe(false)
		expect(shouldClearPendingPayments("ENTRANCE_ONLY", [])).toBe(false)
		expect(shouldClearPendingPayments("TOUR_ONLY", [{ amount: "1" }])).toBe(false)
	})
})
