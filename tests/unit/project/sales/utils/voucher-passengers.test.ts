import { describe, expect, test } from "vitest"
import { filterVoucherPassengers } from "@/project/sales/utils/voucher-passengers"

const pax = (over: { name?: string | null; document?: string | null } = {}) => ({
	name: null,
	document: null,
	...over,
})

describe("filterVoucherPassengers", () => {
	test("'all' returns every passenger untouched", () => {
		const list = [pax({ name: "Ana" }), pax(), pax({ document: "12.345.678-9" })]
		expect(filterVoucherPassengers(list, "all")).toEqual(list)
	})

	test("'first' keeps only the first passenger (the encargado)", () => {
		const list = [pax({ name: "Ana" }), pax({ name: "Beto" })]
		expect(filterVoucherPassengers(list, "first")).toEqual([list[0]])
	})

	test("'first' on an empty list returns an empty list", () => {
		expect(filterVoucherPassengers([], "first")).toEqual([])
	})

	test("'with-data' drops passengers with no name and no document", () => {
		const ana = pax({ name: "Ana" })
		const doc = pax({ document: "12.345.678-9" })
		const empty = pax()
		expect(filterVoucherPassengers([ana, empty, doc], "with-data")).toEqual([ana, doc])
	})

	test("'with-data' treats whitespace-only fields as no data", () => {
		const blank = pax({ name: "   ", document: "  " })
		expect(filterVoucherPassengers([blank], "with-data")).toEqual([])
	})
})
