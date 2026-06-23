import { describe, expect, it } from "vitest"
import { saleRecordFiltersSchema } from "@/project/sales/schemas/sale-record-filters.schema"

// ─── Valid full object ────────────────────────────────────────────────────────

describe("saleRecordFiltersSchema — valid full object", () => {
	it("accepts a fully-populated valid filter object and returns the same shape", () => {
		const now = new Date()
		const input = {
			type: "SALE" as const,
			channel: "ONLINE" as const,
			sellerId: "seller-123",
			wholesaleAgencyId: "agency-456",
			startDate: now,
			endDate: now,
			clientEmail: "test@example.com",
			status: "TO_BE_DONE" as const,
			search: "hello world",
		}

		const result = saleRecordFiltersSchema.safeParse(input)

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.type).toBe("SALE")
			expect(result.data.channel).toBe("ONLINE")
			expect(result.data.sellerId).toBe("seller-123")
			expect(result.data.wholesaleAgencyId).toBe("agency-456")
			expect(result.data.clientEmail).toBe("test@example.com")
			expect(result.data.status).toBe("TO_BE_DONE")
			expect(result.data.search).toBe("hello world")
			expect(result.data.startDate).toBeInstanceOf(Date)
			expect(result.data.endDate).toBeInstanceOf(Date)
		}
	})
})

// ─── Empty object ─────────────────────────────────────────────────────────────

describe("saleRecordFiltersSchema — empty object", () => {
	it("parses {} to all-undefined (all fields optional)", () => {
		const result = saleRecordFiltersSchema.safeParse({})

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.type).toBeUndefined()
			expect(result.data.channel).toBeUndefined()
			expect(result.data.sellerId).toBeUndefined()
			expect(result.data.wholesaleAgencyId).toBeUndefined()
			expect(result.data.startDate).toBeUndefined()
			expect(result.data.endDate).toBeUndefined()
			expect(result.data.clientEmail).toBeUndefined()
			expect(result.data.status).toBeUndefined()
			expect(result.data.search).toBeUndefined()
		}
	})
})

// ─── search field ─────────────────────────────────────────────────────────────

describe("saleRecordFiltersSchema — search field", () => {
	it("preserves a numeric string over int4 max as a plain string (no 500 risk at schema level)", () => {
		// The int4 guard lives in buildSaleRecordWhere, NOT the schema.
		// The schema keeps search as a string and trims it.
		const result = saleRecordFiltersSchema.safeParse({ search: "99999999999" })

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.search).toBe("99999999999")
		}
	})

	it("drops search to undefined when the string exceeds 200 characters (resilient parse — no throw)", () => {
		const longSearch = "x".repeat(201)
		const result = saleRecordFiltersSchema.safeParse({ search: longSearch })

		// The object parse must NOT fail — .catch(undefined) absorbs the field error
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.search).toBeUndefined()
		}
	})

	it("converts empty-string search to undefined", () => {
		const result = saleRecordFiltersSchema.safeParse({ search: "" })

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.search).toBeUndefined()
		}
	})

	it("trims whitespace from search", () => {
		const result = saleRecordFiltersSchema.safeParse({ search: "  san pedro  " })

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.search).toBe("san pedro")
		}
	})

	it("converts whitespace-only search to undefined after trimming", () => {
		const result = saleRecordFiltersSchema.safeParse({ search: "   " })

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.search).toBeUndefined()
		}
	})
})

// ─── Enum resilience ──────────────────────────────────────────────────────────

describe("saleRecordFiltersSchema — invalid enum values degrade gracefully", () => {
	it("drops invalid channel to undefined; rest of object is preserved", () => {
		const result = saleRecordFiltersSchema.safeParse({
			channel: "HACK",
			search: "valid",
		})

		// Must NOT throw — resilient parse
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.channel).toBeUndefined()
			expect(result.data.search).toBe("valid")
		}
	})

	it("drops invalid type to undefined; rest of object is preserved", () => {
		const result = saleRecordFiltersSchema.safeParse({
			type: "INVALID_TYPE",
			sellerId: "seller-abc",
		})

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.type).toBeUndefined()
			expect(result.data.sellerId).toBe("seller-abc")
		}
	})

	it("drops invalid status to undefined; rest of object is preserved", () => {
		const result = saleRecordFiltersSchema.safeParse({
			status: "DELETED",
			search: "tour atacama",
		})

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.status).toBeUndefined()
			expect(result.data.search).toBe("tour atacama")
		}
	})
})

// ─── date coercion ────────────────────────────────────────────────────────────

describe("saleRecordFiltersSchema — date coercion", () => {
	it("coerces an ISO string startDate to Date", () => {
		const result = saleRecordFiltersSchema.safeParse({
			startDate: "2026-01-15T00:00:00.000Z",
		})

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.startDate).toBeInstanceOf(Date)
		}
	})

	it("coerces an ISO string endDate to Date", () => {
		const result = saleRecordFiltersSchema.safeParse({
			endDate: "2026-12-31T23:59:59.999Z",
		})

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.endDate).toBeInstanceOf(Date)
		}
	})
})

// ─── string trimming ──────────────────────────────────────────────────────────

describe("saleRecordFiltersSchema — string trimming", () => {
	it("trims whitespace from sellerId", () => {
		const result = saleRecordFiltersSchema.safeParse({ sellerId: "  seller-id  " })

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.sellerId).toBe("seller-id")
		}
	})

	it("trims whitespace from clientEmail", () => {
		const result = saleRecordFiltersSchema.safeParse({ clientEmail: "  user@example.com  " })

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.clientEmail).toBe("user@example.com")
		}
	})
})

// ─── wholesaleAgencyId field ──────────────────────────────────────────────────

describe("saleRecordFiltersSchema — wholesaleAgencyId field", () => {
	it("preserves a valid agency id string", () => {
		const result = saleRecordFiltersSchema.safeParse({ wholesaleAgencyId: "agency-abc-123" })

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.wholesaleAgencyId).toBe("agency-abc-123")
		}
	})

	it("trims whitespace from wholesaleAgencyId", () => {
		const result = saleRecordFiltersSchema.safeParse({ wholesaleAgencyId: "  agency-xyz  " })

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.wholesaleAgencyId).toBe("agency-xyz")
		}
	})

	it("converts empty-string wholesaleAgencyId to undefined", () => {
		const result = saleRecordFiltersSchema.safeParse({ wholesaleAgencyId: "" })

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.wholesaleAgencyId).toBeUndefined()
		}
	})

	it("degrades non-string wholesaleAgencyId to undefined via .catch(undefined)", () => {
		const result = saleRecordFiltersSchema.safeParse({ wholesaleAgencyId: 12345 })

		// Must NOT throw — resilient parse, invalid type falls back to undefined
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.wholesaleAgencyId).toBeUndefined()
		}
	})

	it("is undefined when omitted (optional field)", () => {
		const result = saleRecordFiltersSchema.safeParse({ sellerId: "seller-1" })

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.wholesaleAgencyId).toBeUndefined()
		}
	})
})
