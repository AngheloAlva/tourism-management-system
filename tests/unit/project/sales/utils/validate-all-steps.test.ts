import { describe, expect, test } from "vitest"
import { validateAllSteps } from "@/project/sales/utils/validate-all-steps"
import type { SaleRecordFormSchema } from "@/project/sales/schemas/sale-record.schema"
import { todayInSantiago } from "@/shared/utils/calendar-day"

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Anchor the fixtures to the SAME "today" the validation uses (todayInSantiago),
// then offset by ±1 day in UTC-component space. Deriving today/yesterday/tomorrow
// from the runner's UTC date instead would break whenever UTC and America/Santiago
// land on different calendar days — e.g. CI running after UTC midnight, which is
// still the previous evening in Chile — making UTC-"yesterday" equal Chile-"today".
const today = todayInSantiago()
const tomorrow = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1))
const yesterday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1))

function makeValidValues(overrides: Partial<SaleRecordFormSchema> = {}): SaleRecordFormSchema {
	return {
		type: "QUOTE",
		channel: "PHYSICAL",
		comments: "",
		agencyId: "",
		fileNumber: "",
		fileNumberPending: false,
		isWholesale: false,
		wholesaleAgencyId: "",
		wholesaleMarkup: 30,
		paymentPending: false,
		codePrefix: "",
		codeLength: 0,
		discount: 0,
		convertedFromQuoteId: undefined,
		eventBookings: [
			{
				mode: "REGULAR",
				date: tomorrow,
				tourId: "tour-1",
				startTime: "",
				endTime: "",
				specialRequest: "",
				comments: "",
				priceEntries: [
					{
						priceCategoryId: "cat-1",
						categoryName: "Adulto",
						count: 1,
						price: 20000,
						reception: 0,
					},
				],
				entrySnapshots: [],
				excludedPassengers: [],
			},
		],
		passengerArray: [
			{
				name: "Ana García",
				allergies: [],
				hotels: [],
			},
		],
		paymentArray: [],
		...overrides,
	} as SaleRecordFormSchema
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("validateAllSteps", () => {
	test("returns no issues for a fully valid QUOTE form", () => {
		const issues = validateAllSteps(makeValidValues())
		expect(issues).toHaveLength(0)
	})

	test("returns issue on eventBookings when 0 passengers (step-2 refinement)", () => {
		const values = makeValidValues({
			eventBookings: [
				{
					mode: "REGULAR",
					date: tomorrow,
					tourId: "tour-1",
					startTime: "",
					endTime: "",
					specialRequest: "",
					comments: "",
					// All counts are 0 — total passengers < 1
					priceEntries: [
						{
							priceCategoryId: "cat-1",
							categoryName: "Adulto",
							count: 0,
							price: 20000,
							reception: 0,
						},
					],
					entrySnapshots: [],
					excludedPassengers: [],
				},
			],
		})
		const issues = validateAllSteps(values)
		expect(issues.length).toBeGreaterThan(0)
		// The path must include "eventBookings" so the error binds to the right field
		const hasEventBookingIssue = issues.some((i) =>
			Array.isArray(i.path) && i.path[0] === "eventBookings"
		)
		expect(hasEventBookingIssue).toBe(true)
	})

	test("create mode: returns issue on eventBookings when date is in the past (step-2 refinement)", () => {
		const values = makeValidValues({
			eventBookings: [
				{
					mode: "REGULAR",
					date: yesterday,
					tourId: "tour-1",
					startTime: "",
					endTime: "",
					specialRequest: "",
					comments: "",
					priceEntries: [
						{
							priceCategoryId: "cat-1",
							categoryName: "Adulto",
							count: 1,
							price: 20000,
							reception: 0,
						},
					],
					entrySnapshots: [],
					excludedPassengers: [],
				},
			],
		})
		// Must pass "create" explicitly — edit mode would NOT block past dates
		const issues = validateAllSteps(values, "create")
		expect(issues.length).toBeGreaterThan(0)
		const hasDateIssue = issues.some(
			(i) => Array.isArray(i.path) && i.path[0] === "eventBookings" && i.path[2] === "date"
		)
		expect(hasDateIssue).toBe(true)
	})

	test("edit mode: past date + ≥1 passengers → NO past-date issue", () => {
		const values = makeValidValues({
			eventBookings: [
				{
					mode: "REGULAR",
					date: yesterday,
					tourId: "tour-1",
					startTime: "",
					endTime: "",
					specialRequest: "",
					comments: "",
					priceEntries: [
						{
							priceCategoryId: "cat-1",
							categoryName: "Adulto",
							count: 1,
							price: 20000,
							reception: 0,
						},
					],
					entrySnapshots: [],
					excludedPassengers: [],
				},
			],
		})
		const issues = validateAllSteps(values, "edit")
		const hasDateIssue = issues.some(
			(i) => Array.isArray(i.path) && i.path[0] === "eventBookings" && i.path[2] === "date"
		)
		expect(hasDateIssue).toBe(false)
	})

	test("edit mode: past date + 0 passengers → min-passenger issue present, no date issue", () => {
		const values = makeValidValues({
			eventBookings: [
				{
					mode: "REGULAR",
					date: yesterday,
					tourId: "tour-1",
					startTime: "",
					endTime: "",
					specialRequest: "",
					comments: "",
					priceEntries: [
						{
							priceCategoryId: "cat-1",
							categoryName: "Adulto",
							count: 0,
							price: 20000,
							reception: 0,
						},
					],
					entrySnapshots: [],
					excludedPassengers: [],
				},
			],
		})
		const issues = validateAllSteps(values, "edit")
		const hasMinPaxIssue = issues.some(
			(i) =>
				Array.isArray(i.path) &&
				i.path[0] === "eventBookings" &&
				i.path[2] === "priceEntries"
		)
		const hasDateIssue = issues.some(
			(i) => Array.isArray(i.path) && i.path[0] === "eventBookings" && i.path[2] === "date"
		)
		expect(hasMinPaxIssue).toBe(true)
		expect(hasDateIssue).toBe(false)
	})

	test("edit mode: future date + ≥1 passengers → no issues", () => {
		const values = makeValidValues({
			eventBookings: [
				{
					mode: "REGULAR",
					date: tomorrow,
					tourId: "tour-1",
					startTime: "",
					endTime: "",
					specialRequest: "",
					comments: "",
					priceEntries: [
						{
							priceCategoryId: "cat-1",
							categoryName: "Adulto",
							count: 1,
							price: 20000,
							reception: 0,
						},
					],
					entrySnapshots: [],
					excludedPassengers: [],
				},
			],
		})
		const issues = validateAllSteps(values, "edit")
		expect(issues).toHaveLength(0)
	})

	test("returns issue on agencyId when channel=WHOLESALE and agencyId is empty (step-1 refinement)", () => {
		const values = makeValidValues({ channel: "WHOLESALE", agencyId: "", fileNumber: "F-001" })
		const issues = validateAllSteps(values)
		const hasAgencyIssue = issues.some((i) => Array.isArray(i.path) && i.path[0] === "agencyId")
		expect(hasAgencyIssue).toBe(true)
	})

	test("returns issue on paymentArray when type=SALE and payments are empty (base refinement)", () => {
		const values = makeValidValues({ type: "SALE", paymentArray: [] })
		const issues = validateAllSteps(values)
		const hasPaymentIssue = issues.some(
			(i) => Array.isArray(i.path) && i.path[0] === "paymentArray"
		)
		expect(hasPaymentIssue).toBe(true)
	})

	// ─── Regression: wholesale+immediate zero-payment bug (record #8949) ────────

	test("SALE + WHOLESALE + 0 payments + paymentPending:false → exactly one paymentArray issue", () => {
		// This is the state that previously bricked the edit form: a WHOLESALE sale
		// hydrated from wholesalePaymentTerm:IMMEDIATE has paymentPending:false and
		// no payments. validateAllSteps must return the paymentArray error so the
		// form can redirect the user to fix it.
		const values = makeValidValues({
			type: "SALE",
			channel: "WHOLESALE",
			isWholesale: true,
			paymentPending: false,
			paymentArray: [],
		})
		const issues = validateAllSteps(values, "edit")
		const paymentIssues = issues.filter(
			(i) => Array.isArray(i.path) && i.path[0] === "paymentArray"
		)
		expect(paymentIssues.length).toBeGreaterThan(0)
	})

	test("SALE + WHOLESALE + 0 payments + paymentPending:true → zero paymentArray issues", () => {
		// After the user turns ON the Pago Pendiente toggle the underlying condition
		// becomes valid — validateAllSteps must return 0 issues so clearInjectedErrors
		// + a fresh handleSubmit can proceed to save.
		const values = makeValidValues({
			type: "SALE",
			channel: "WHOLESALE",
			isWholesale: true,
			paymentPending: true,
			paymentArray: [],
		})
		const issues = validateAllSteps(values, "edit")
		const paymentIssues = issues.filter(
			(i) => Array.isArray(i.path) && i.path[0] === "paymentArray"
		)
		expect(paymentIssues).toHaveLength(0)
	})

	test("aggregates issues from multiple steps simultaneously", () => {
		// Step 1: WHOLESALE with empty agencyId; Step 2: 0 passengers + past date
		const values = makeValidValues({
			channel: "WHOLESALE",
			agencyId: "",
			fileNumber: "F-001",
			eventBookings: [
				{
					mode: "REGULAR",
					date: yesterday,
					tourId: "tour-1",
					startTime: "",
					endTime: "",
					specialRequest: "",
					comments: "",
					priceEntries: [
						{
							priceCategoryId: "cat-1",
							categoryName: "Adulto",
							count: 0,
							price: 20000,
							reception: 0,
						},
					],
					entrySnapshots: [],
					excludedPassengers: [],
				},
			],
		})
		const issues = validateAllSteps(values)
		// Should have at least one issue from step 1 AND at least one from step 2
		const step1Issues = issues.filter(
			(i) => Array.isArray(i.path) && i.path[0] === "agencyId"
		)
		const step2Issues = issues.filter(
			(i) => Array.isArray(i.path) && i.path[0] === "eventBookings"
		)
		expect(step1Issues.length).toBeGreaterThan(0)
		expect(step2Issues.length).toBeGreaterThan(0)
	})
})
