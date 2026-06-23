import { describe, expect, it } from "vitest"
import {
	updateSaleFileInfoSchema,
	updateSaleAgencySchema,
	updateSaleCommentsSchema,
	updateSaleFlagsSchema,
} from "@/project/sales/schemas/inline-edit.schema"

// REQ-10-S1: missing saleRecordId fails for all schemas
describe("SaleIdSchema — missing saleRecordId", () => {
	it("updateSaleFileInfoSchema rejects missing saleRecordId", () => {
		const result = updateSaleFileInfoSchema.safeParse({ fileNumber: null })
		expect(result.success).toBe(false)
	})

	it("updateSaleAgencySchema rejects missing saleRecordId", () => {
		const result = updateSaleAgencySchema.safeParse({ agencyId: null, expectedUpdatedAt: new Date() })
		expect(result.success).toBe(false)
	})

	it("updateSaleCommentsSchema rejects missing saleRecordId", () => {
		const result = updateSaleCommentsSchema.safeParse({ comments: null })
		expect(result.success).toBe(false)
	})

	it("updateSaleFlagsSchema rejects missing saleRecordId", () => {
		const result = updateSaleFlagsSchema.safeParse({ contacted: true })
		expect(result.success).toBe(false)
	})
})

// REQ-10-S1: saleRecordId must be non-empty
describe("SaleIdSchema — empty saleRecordId", () => {
	it("updateSaleFileInfoSchema rejects empty saleRecordId", () => {
		const result = updateSaleFileInfoSchema.safeParse({ saleRecordId: "", fileNumber: null })
		expect(result.success).toBe(false)
	})
})

// REQ-10-S2: fileNumber empty string → null transform
describe("updateSaleFileInfoSchema", () => {
	it("transforms empty string fileNumber to null (REQ-10-S2)", () => {
		const result = updateSaleFileInfoSchema.safeParse({
			saleRecordId: "clxxxxxxxxxxxxxxxxxxxxxx",
			fileNumber: "",
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.fileNumber).toBeNull()
		}
	})

	it("accepts null fileNumber", () => {
		const result = updateSaleFileInfoSchema.safeParse({
			saleRecordId: "clxxxxxxxxxxxxxxxxxxxxxx",
			fileNumber: null,
		})
		expect(result.success).toBe(true)
	})

	it("accepts valid fileNumber string", () => {
		const result = updateSaleFileInfoSchema.safeParse({
			saleRecordId: "clxxxxxxxxxxxxxxxxxxxxxx",
			fileNumber: "FN-2026-001",
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.fileNumber).toBe("FN-2026-001")
		}
	})

	it("trims whitespace from fileNumber", () => {
		const result = updateSaleFileInfoSchema.safeParse({
			saleRecordId: "clxxxxxxxxxxxxxxxxxxxxxx",
			fileNumber: "  FN-2026-001  ",
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.fileNumber).toBe("FN-2026-001")
		}
	})

	it("rejects fileNumber longer than 120 characters (REQ-2-S5)", () => {
		const result = updateSaleFileInfoSchema.safeParse({
			saleRecordId: "clxxxxxxxxxxxxxxxxxxxxxx",
			fileNumber: "x".repeat(121),
		})
		expect(result.success).toBe(false)
	})

	it("rejects missing saleRecordId even with valid fileNumber", () => {
		const result = updateSaleFileInfoSchema.safeParse({ fileNumber: "FN-001" })
		expect(result.success).toBe(false)
	})
})

// updateSaleAgencySchema
describe("updateSaleAgencySchema", () => {
	it("accepts null agencyId (clear agency)", () => {
		const result = updateSaleAgencySchema.safeParse({
			saleRecordId: "clxxxxxxxxxxxxxxxxxxxxxx",
			agencyId: null,
			expectedUpdatedAt: new Date(),
		})
		expect(result.success).toBe(true)
	})

	it("accepts valid agencyId string", () => {
		const result = updateSaleAgencySchema.safeParse({
			saleRecordId: "clxxxxxxxxxxxxxxxxxxxxxx",
			agencyId: "clyyyyyyyyyyyyyyyyyyyyyy",
			expectedUpdatedAt: new Date(),
		})
		expect(result.success).toBe(true)
	})

	it("coerces string date for expectedUpdatedAt", () => {
		const result = updateSaleAgencySchema.safeParse({
			saleRecordId: "clxxxxxxxxxxxxxxxxxxxxxx",
			agencyId: null,
			expectedUpdatedAt: "2026-05-26T00:00:00.000Z",
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.expectedUpdatedAt).toBeInstanceOf(Date)
		}
	})

	it("rejects missing expectedUpdatedAt", () => {
		const result = updateSaleAgencySchema.safeParse({
			saleRecordId: "clxxxxxxxxxxxxxxxxxxxxxx",
			agencyId: null,
		})
		expect(result.success).toBe(false)
	})
})

// REQ-10-S3: comments empty string → null transform
describe("updateSaleCommentsSchema", () => {
	it("transforms empty string comments to null (REQ-10-S3)", () => {
		const result = updateSaleCommentsSchema.safeParse({
			saleRecordId: "clxxxxxxxxxxxxxxxxxxxxxx",
			comments: "",
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.comments).toBeNull()
		}
	})

	it("accepts null comments", () => {
		const result = updateSaleCommentsSchema.safeParse({
			saleRecordId: "clxxxxxxxxxxxxxxxxxxxxxx",
			comments: null,
		})
		expect(result.success).toBe(true)
	})

	it("accepts valid comment text", () => {
		const result = updateSaleCommentsSchema.safeParse({
			saleRecordId: "clxxxxxxxxxxxxxxxxxxxxxx",
			comments: "Follow up needed",
		})
		expect(result.success).toBe(true)
	})

	it("rejects comments longer than 2000 characters (REQ-4-S3)", () => {
		const result = updateSaleCommentsSchema.safeParse({
			saleRecordId: "clxxxxxxxxxxxxxxxxxxxxxx",
			comments: "x".repeat(2001),
		})
		expect(result.success).toBe(false)
	})
})

// updateSaleFlagsSchema
describe("updateSaleFlagsSchema", () => {
	it("accepts contacted = true", () => {
		const result = updateSaleFlagsSchema.safeParse({
			saleRecordId: "clxxxxxxxxxxxxxxxxxxxxxx",
			contacted: true,
		})
		expect(result.success).toBe(true)
	})

	it("accepts contacted = false", () => {
		const result = updateSaleFlagsSchema.safeParse({
			saleRecordId: "clxxxxxxxxxxxxxxxxxxxxxx",
			contacted: false,
		})
		expect(result.success).toBe(true)
	})

	it("rejects non-boolean contacted (REQ-5-S4)", () => {
		const result = updateSaleFlagsSchema.safeParse({
			saleRecordId: "clxxxxxxxxxxxxxxxxxxxxxx",
			contacted: "yes",
		})
		expect(result.success).toBe(false)
	})

	it("rejects missing contacted", () => {
		const result = updateSaleFlagsSchema.safeParse({
			saleRecordId: "clxxxxxxxxxxxxxxxxxxxxxx",
		})
		expect(result.success).toBe(false)
	})
})
