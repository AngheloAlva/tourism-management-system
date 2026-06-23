import { describe, expect, it } from "vitest"
import { clampStep } from "@/shared/hooks/use-stepper"

describe("clampStep", () => {
	it("clamps 0 to 1 (below lower bound)", () => {
		expect(clampStep(0, 4)).toBe(1)
	})

	it("clamps negative numbers to 1", () => {
		expect(clampStep(-5, 4)).toBe(1)
	})

	it("clamps values above stepCount to stepCount", () => {
		expect(clampStep(99, 4)).toBe(4)
	})

	it("returns valid mid-range values as-is", () => {
		expect(clampStep(3, 4)).toBe(3)
	})

	it("returns lower boundary (1) unchanged", () => {
		expect(clampStep(1, 4)).toBe(1)
	})

	it("returns upper boundary (stepCount) unchanged", () => {
		expect(clampStep(4, 4)).toBe(4)
	})

	it("truncates float values (2.9 → 2)", () => {
		expect(clampStep(2.9, 4)).toBe(2)
	})

	it("clamps NaN (non-finite) to 1", () => {
		expect(clampStep(NaN, 4)).toBe(1)
	})
})
