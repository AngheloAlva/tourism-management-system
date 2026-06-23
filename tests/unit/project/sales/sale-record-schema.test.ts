import { describe, expect, test } from "vitest"
import {
  paymentSchema,
  passengerSchema,
  eventBookingSchema,
  saleRecordFormSchema,
  STEP_3_SCHEMA,
} from "@/project/sales/schemas/sale-record.schema"

describe("eventBookingSchema time fields", () => {
  const base = {
    mode: "REGULAR" as const,
    date: new Date("2030-01-15"),
    tourId: "tour-1",
  }

  test("normalizes a migrated time with fractional seconds instead of erroring", () => {
    const result = eventBookingSchema.safeParse({
      ...base,
      startTime: "14:30:00.000",
      endTime: "18:00:00.000",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.startTime).toBe("14:30")
      expect(result.data.endTime).toBe("18:00")
    }
  })

  test("normalizes a 12-hour meridiem time to 24-hour", () => {
    const result = eventBookingSchema.safeParse({ ...base, startTime: "2:30 p.m." })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.startTime).toBe("14:30")
  })

  test("accepts an empty time string", () => {
    const result = eventBookingSchema.safeParse({ ...base, startTime: "" })
    expect(result.success).toBe(true)
  })

  test("accepts a canonical HH:mm time unchanged", () => {
    const result = eventBookingSchema.safeParse({ ...base, startTime: "09:00" })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.startTime).toBe("09:00")
  })
})

describe("paymentSchema", () => {
  test("accepts a valid CLP cash payment", () => {
    const result = paymentSchema.safeParse({
      refund: false,
      method: "CASH",
      currency: "CLP",
      amount: 50000,
      movement_date: new Date("2025-01-15"),
    })
    expect(result.success).toBe(true)
  })

  test("rejects a payment with zero amount", () => {
    const result = paymentSchema.safeParse({
      refund: false,
      method: "CASH",
      currency: "CLP",
      amount: 0,
      movement_date: new Date("2025-01-15"),
    })
    expect(result.success).toBe(false)
  })

  test("rejects a USD payment without exchange_rate", () => {
    const result = paymentSchema.safeParse({
      refund: false,
      method: "CASH",
      currency: "USD",
      amount: 100,
      movement_date: new Date("2025-01-15"),
    })
    expect(result.success).toBe(false)
  })

  test("rejects a non-cash payment with an empty document_number, anchored to the field", () => {
    const result = paymentSchema.safeParse({
      refund: false,
      method: "DEBIT_CARD",
      currency: "CLP",
      amount: 33000,
      movement_date: new Date("2026-06-01"),
      document_number: "",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const anchored = result.error.issues.some(
        (issue) => issue.path.join(".") === "document_number"
      )
      expect(anchored).toBe(true)
    }
  })

  test("accepts a non-cash payment when document_number is provided", () => {
    const result = paymentSchema.safeParse({
      refund: false,
      method: "DEBIT_CARD",
      currency: "CLP",
      amount: 33000,
      movement_date: new Date("2026-06-01"),
      document_number: "123456789",
    })
    expect(result.success).toBe(true)
  })

  test("accepts a cash payment with an empty document_number (exempt from the rule)", () => {
    const result = paymentSchema.safeParse({
      refund: false,
      method: "CASH",
      currency: "CLP",
      amount: 33000,
      movement_date: new Date("2026-06-01"),
      document_number: "",
    })
    expect(result.success).toBe(true)
  })
})

describe("passengerSchema", () => {
  test("accepts a minimal passenger with no required fields", () => {
    const result = passengerSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  test("rejects an invalid email address", () => {
    const result = passengerSchema.safeParse({
      email: "not-an-email",
    })
    expect(result.success).toBe(false)
  })

  test("accepts an empty string for email (optional empty)", () => {
    const result = passengerSchema.safeParse({
      email: "",
    })
    expect(result.success).toBe(true)
  })

  // T-03: complimentary fields
  test("complimentary defaults to false when omitted", () => {
    const result = passengerSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.complimentary).toBe(false)
    }
  })

  test("complimentaryCategory is optional (no error when absent)", () => {
    const result = passengerSchema.safeParse({ complimentary: true })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.complimentary).toBe(true)
      expect(result.data.complimentaryCategory).toBeUndefined()
    }
  })

  test("complimentaryCategory is accepted when present", () => {
    const result = passengerSchema.safeParse({
      complimentary: true,
      complimentaryCategory: "Adulto",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.complimentaryCategory).toBe("Adulto")
    }
  })
})

// T-03: sale-level superRefine hard-block for complimentary+REGULAR
describe("saleRecordFormSchema — complimentary superRefine", () => {
  // Minimal valid base for a sale with a REGULAR booking exposing MORE THAN ONE
  // category — the only case where a comp passenger must pick one.
  const baseRegularSale = {
    type: "SALE" as const,
    channel: "PHYSICAL" as const,
    isWholesale: false,
    fileNumberPending: false,
    paymentPending: false,
    eventBookings: [
      {
        mode: "REGULAR" as const,
        date: new Date("2030-01-15"),
        tourId: "tour-1",
        priceEntries: [
          { priceCategoryId: "cat-1", categoryName: "Adulto", count: 2, price: 50000, reception: 0 },
          { priceCategoryId: "cat-2", categoryName: "Niño", count: 1, price: 30000, reception: 0 },
        ],
        entrySnapshots: [],
        excludedPassengers: [],
      },
    ],
    passengerArray: [],
    paymentArray: [
      {
        refund: false,
        method: "CASH" as const,
        currency: "CLP" as const,
        amount: 50000,
        movement_date: new Date("2030-01-15"),
      },
    ],
  }

  // Single-category REGULAR booking: the category is assumed, never required.
  const baseSingleCategorySale = {
    ...baseRegularSale,
    eventBookings: [
      {
        mode: "REGULAR" as const,
        date: new Date("2030-01-15"),
        tourId: "tour-1",
        priceEntries: [
          { priceCategoryId: "cat-1", categoryName: "Adulto", count: 3, price: 38000, reception: 0 },
        ],
        entrySnapshots: [],
        excludedPassengers: [],
      },
    ],
  }

  const basePrivateSale = {
    ...baseRegularSale,
    eventBookings: [
      {
        mode: "PRIVATE" as const,
        date: new Date("2030-01-15"),
        tourId: "tour-1",
        priceEntries: [],
        entrySnapshots: [],
        excludedPassengers: [],
      },
    ],
  }

  test("hard-block fires when complimentary=true, >1 categories exist, complimentaryCategory absent", () => {
    const data = {
      ...baseRegularSale,
      passengerArray: [
        { complimentary: true, complimentaryCategory: undefined },
      ],
    }
    const result = saleRecordFormSchema.safeParse(data)
    expect(result.success).toBe(false)
    if (!result.success) {
      const compIssue = result.error.issues.find(
        (issue) =>
          issue.path.includes("complimentaryCategory") ||
          issue.path.join(".").includes("complimentaryCategory")
      )
      expect(compIssue).toBeDefined()
    }
  })

  test("hard-block fires when complimentary=true, >1 categories exist, complimentaryCategory is empty string", () => {
    const data = {
      ...baseRegularSale,
      passengerArray: [
        { complimentary: true, complimentaryCategory: "" },
      ],
    }
    const result = saleRecordFormSchema.safeParse(data)
    expect(result.success).toBe(false)
    if (!result.success) {
      const compIssue = result.error.issues.find(
        (issue) =>
          issue.path.includes("complimentaryCategory") ||
          issue.path.join(".").includes("complimentaryCategory")
      )
      expect(compIssue).toBeDefined()
    }
  })

  test("hard-block does NOT fire when complimentary=true in PRIVATE-only sale", () => {
    const data = {
      ...basePrivateSale,
      passengerArray: [
        { complimentary: true, complimentaryCategory: undefined },
      ],
    }
    const result = saleRecordFormSchema.safeParse(data)
    // For a PRIVATE-only sale the comp-category refine does NOT fire, so no complimentaryCategory issue should be present
    if (!result.success) {
      const compIssue = result.error.issues.find(
        (issue) =>
          issue.path.includes("complimentaryCategory") ||
          issue.path.join(".").includes("complimentaryCategory")
      )
      expect(compIssue).toBeUndefined()
    }
  })

  test("hard-block does NOT fire when complimentary=true with valid complimentaryCategory in REGULAR sale", () => {
    const data = {
      ...baseRegularSale,
      passengerArray: [
        { complimentary: true, complimentaryCategory: "Adulto" },
        { complimentary: false },
      ],
    }
    const result = saleRecordFormSchema.safeParse(data)
    if (!result.success) {
      const compIssue = result.error.issues.find(
        (issue) =>
          issue.path.includes("complimentaryCategory") ||
          issue.path.join(".").includes("complimentaryCategory")
      )
      expect(compIssue).toBeUndefined()
    }
  })

  // A single available category is assumed (the form hides the select), so a
  // complimentary passenger without a category must NOT be blocked. Regression
  // for the "Adulto is the only category" case the user hit.
  test("hard-block does NOT fire when only ONE category exists", () => {
    const data = {
      ...baseSingleCategorySale,
      passengerArray: [
        { complimentary: true, complimentaryCategory: undefined },
      ],
    }
    const result = saleRecordFormSchema.safeParse(data)
    if (!result.success) {
      const compIssue = result.error.issues.find(
        (issue) =>
          issue.path.includes("complimentaryCategory") ||
          issue.path.join(".").includes("complimentaryCategory")
      )
      expect(compIssue).toBeUndefined()
    }
  })

  // Regression: a REGULAR booking whose priceEntries expose no categoryName
  // (e.g. a transfer with a single generic entry) yields zero category options.
  // The passenger form hides the category select in that case, so the schema
  // must NOT require a category — otherwise the user hits an invisible,
  // unfixable error and can only proceed by turning Liberado off.
  test("hard-block does NOT fire when REGULAR booking has no named categories", () => {
    const data = {
      ...baseRegularSale,
      eventBookings: [
        {
          mode: "REGULAR" as const,
          date: new Date("2030-01-15"),
          tourId: "tour-1",
          priceEntries: [
            { priceCategoryId: "cat-1", categoryName: "", count: 3, price: 38000, reception: 0 },
          ],
          entrySnapshots: [],
          excludedPassengers: [],
        },
      ],
      passengerArray: [
        { complimentary: true, complimentaryCategory: undefined },
      ],
    }
    const result = saleRecordFormSchema.safeParse(data)
    if (!result.success) {
      const compIssue = result.error.issues.find(
        (issue) =>
          issue.path.includes("complimentaryCategory") ||
          issue.path.join(".").includes("complimentaryCategory")
      )
      expect(compIssue).toBeUndefined()
    }
  })
})

// W-1: STEP_3_SCHEMA must fire the comp-category hard-block at the passenger step.
// These tests establish RED before the fix is implemented.
describe("STEP_3_SCHEMA — complimentary-category hard-block fires at step 3", () => {
  // REGULAR booking exposing MORE THAN ONE category — the only case that forces
  // a comp passenger to pick one.
  const regularBooking = {
    mode: "REGULAR" as const,
    date: new Date("2030-01-15"),
    tourId: "tour-1",
    priceEntries: [
      { priceCategoryId: "cat-1", categoryName: "Adulto", count: 2, price: 50000, reception: 0 },
      { priceCategoryId: "cat-2", categoryName: "Niño", count: 1, price: 30000, reception: 0 },
    ],
    entrySnapshots: [],
    excludedPassengers: [],
  }

  // REGULAR booking with a single category — assumed, never required.
  const singleCategoryBooking = {
    ...regularBooking,
    priceEntries: [
      { priceCategoryId: "cat-1", categoryName: "Adulto", count: 3, price: 38000, reception: 0 },
    ],
  }

  const privateBooking = {
    mode: "PRIVATE" as const,
    date: new Date("2030-01-15"),
    tourId: "tour-1",
    priceEntries: [],
    entrySnapshots: [],
    excludedPassengers: [],
  }

  // (a) FAILS for REGULAR with >1 categories + complimentary + no category
  test("(a) FAILS: REGULAR booking (>1 categories) + complimentary=true + no category", () => {
    const result = STEP_3_SCHEMA.safeParse({
      eventBookings: [regularBooking],
      passengerArray: [{ complimentary: true, complimentaryCategory: undefined, allergies: [], hotels: [] }],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const compIssue = result.error.issues.find(
        (issue) =>
          issue.path.includes("complimentaryCategory") ||
          issue.path.join(".").includes("complimentaryCategory")
      )
      expect(compIssue).toBeDefined()
    }
  })

  // (b) PASSES for PRIVATE-only + complimentary + no category
  test("(b) PASSES: PRIVATE-only booking + complimentary=true + no category", () => {
    const result = STEP_3_SCHEMA.safeParse({
      eventBookings: [privateBooking],
      passengerArray: [{ complimentary: true, complimentaryCategory: undefined, allergies: [], hotels: [] }],
    })
    expect(result.success).toBe(true)
  })

  // (c) PASSES for REGULAR + complimentary + valid category
  test("(c) PASSES: REGULAR booking + complimentary=true + valid category", () => {
    const result = STEP_3_SCHEMA.safeParse({
      eventBookings: [regularBooking],
      passengerArray: [{ complimentary: true, complimentaryCategory: "Adulto", allergies: [], hotels: [] }],
    })
    expect(result.success).toBe(true)
  })

  // (d) PASSES for non-complimentary passenger
  test("(d) PASSES: REGULAR booking + complimentary=false", () => {
    const result = STEP_3_SCHEMA.safeParse({
      eventBookings: [regularBooking],
      passengerArray: [{ complimentary: false, allergies: [], hotels: [] }],
    })
    expect(result.success).toBe(true)
  })

  // (e) PASSES for REGULAR booking with no named categories — mirrors the form,
  // which hides the category select when there are zero options. Regression for
  // the invisible "Corregí los errores" block on transfers/tours without
  // category names.
  test("(e) PASSES: REGULAR booking with no named categories + complimentary=true", () => {
    const regularNoCategories = {
      ...regularBooking,
      priceEntries: [
        { priceCategoryId: "cat-1", categoryName: "", count: 3, price: 38000, reception: 0 },
      ],
    }
    const result = STEP_3_SCHEMA.safeParse({
      eventBookings: [regularNoCategories],
      passengerArray: [{ complimentary: true, complimentaryCategory: undefined, allergies: [], hotels: [] }],
    })
    expect(result.success).toBe(true)
  })

  // (f) PASSES for REGULAR booking with a single category — the category is
  // assumed, so a comp passenger without one is valid. Matches the form hiding
  // the selector. Regression for the "Adulto is the only category" case.
  test("(f) PASSES: REGULAR booking with ONE category + complimentary=true + no category", () => {
    const result = STEP_3_SCHEMA.safeParse({
      eventBookings: [singleCategoryBooking],
      passengerArray: [{ complimentary: true, complimentaryCategory: undefined, allergies: [], hotels: [] }],
    })
    expect(result.success).toBe(true)
  })
})
