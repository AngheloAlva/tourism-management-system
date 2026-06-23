import { describe, expect, test } from "vitest"
import {
  calculateTourPrice,
  calculateSaleTotals,
  countComplimentary,
} from "@/project/sales/utils/sale-calculations"
import type { EventBookingSchema, SaleRecord } from "@/project/sales/schemas/sale-record.schema"
import type { ActiveTour } from "@/project/tours/hooks/use-tours"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeTour = (overrides: Partial<ActiveTour> = {}): ActiveTour =>
  ({
    id: "tour-1",
    name: "Test Tour",
    privatePricing: null,
    ...overrides,
  }) as unknown as ActiveTour

const makeRegularBooking = (
  priceEntries: EventBookingSchema["priceEntries"],
  entrySnapshots: EventBookingSchema["entrySnapshots"] = []
): EventBookingSchema =>
  ({
    mode: "REGULAR",
    tourId: "tour-1",
    date: new Date("2030-01-15"),
    priceEntries,
    entrySnapshots,
    excludedPassengers: [],
  }) as unknown as EventBookingSchema

const makePrivateBooking = (
  entrySnapshots: EventBookingSchema["entrySnapshots"] = []
): EventBookingSchema =>
  ({
    mode: "PRIVATE",
    tourId: "tour-1",
    date: new Date("2030-01-15"),
    priceEntries: [],
    entrySnapshots,
    excludedPassengers: [],
  }) as unknown as EventBookingSchema

const makePassenger = (
  complimentary = false,
  complimentaryCategory?: string
): SaleRecord["passengerArray"][number] => ({
  complimentary,
  complimentaryCategory,
  allergies: [],
  hotels: [],
  diet_type: "NORMAL",
})

// ─── T-04: REGULAR deduction — single comp matching category ─────────────────

describe("T-04: REGULAR mode — single comp matching category", () => {
  const priceEntries = [
    { priceCategoryId: "cat-1", categoryName: "Adulto", count: 2, price: 50000, reception: 0 },
    { priceCategoryId: "cat-2", categoryName: "Niño", count: 1, price: 25000, reception: 0 },
  ]
  const entrySnapshots = [{ tourEntryId: "e-1", entryName: "Parque", categoryName: "General", variantName: "", count: 1, price: 10000 }]
  const tour = makeTour()
  const booking = makeRegularBooking(priceEntries, entrySnapshots)
  const passengers = [
    makePassenger(false),
    makePassenger(true, "Adulto"),
    makePassenger(false),
  ]

  test("REQ-04 Scenario A: baseTotal drops by exactly the unit price of the matched category", () => {
    const result = calculateTourPrice(booking, [tour], passengers)
    // Adulto: 2×50000=100000, Niño: 1×25000=25000 → raw=125000; deduct 1 Adulto comp=50000 → base=75000
    expect(result.baseTotal).toBe(75000)
  })

  test("REQ-09 Scenario M: entranceTotal unchanged by comp deduction", () => {
    const result = calculateTourPrice(booking, [tour], passengers)
    expect(result.entranceTotal).toBe(10000)
    expect(result.total).toBe(85000)
  })
})

// ─── T-05: REGULAR clamp — comps exceed category count ───────────────────────

describe("T-05: REGULAR mode — per-category clamp", () => {
  const tour = makeTour()

  test("REQ-05 Scenario E: deduction capped at category subtotal when comps exceed count", () => {
    const booking = makeRegularBooking([
      { priceCategoryId: "cat-1", categoryName: "Adulto", count: 2, price: 50000, reception: 0 },
    ])
    const passengers = [
      makePassenger(true, "Adulto"),
      makePassenger(true, "Adulto"),
      makePassenger(true, "Adulto"), // 3 comps but only count=2
    ]
    const result = calculateTourPrice(booking, [tour], passengers)
    // raw deduction = 3×50000 = 150000, capped at 2×50000 = 100000 → base = 0
    expect(result.baseTotal).toBe(0)
  })

  test("REQ-05 Scenario F: baseTotal never goes negative (floor at 0)", () => {
    const booking = makeRegularBooking(
      [{ priceCategoryId: "cat-1", categoryName: "Adulto", count: 2, price: 50000, reception: 0 }],
      [{ tourEntryId: "e-1", entryName: "Parque", categoryName: "General", variantName: "", count: 1, price: 15000 }]
    )
    const passengers = [
      makePassenger(true, "Adulto"),
      makePassenger(true, "Adulto"),
    ]
    const result = calculateTourPrice(booking, [tour], passengers)
    expect(result.baseTotal).toBe(0)
    expect(result.entranceTotal).toBe(15000)
    expect(result.total).toBe(15000)
  })
})

// ─── T-06: REGULAR orphaned category ─────────────────────────────────────────

describe("T-06: REGULAR mode — orphaned complimentaryCategory", () => {
  const tour = makeTour()

  test("REQ-04 Scenario B: zero deduction when comp category not found in priceEntries", () => {
    const booking = makeRegularBooking([
      { priceCategoryId: "cat-1", categoryName: "Adulto", count: 2, price: 50000, reception: 0 },
    ])
    const passengers = [makePassenger(true, "Niño")] // "Niño" not in priceEntries
    const result = calculateTourPrice(booking, [tour], passengers)
    expect(result.baseTotal).toBe(100000) // unchanged
  })
})

// ─── T-07: PRIVATE tier/billable split ────────────────────────────────────────

describe("T-07: PRIVATE mode — tier and billable split", () => {
  const entrySnapshots: EventBookingSchema["entrySnapshots"] = []

  test("REQ-06 Scenario G: tier by totalPax, billable = totalPax - compCount", () => {
    const tour = makeTour({
      privatePricing: [
        { capacity: 4, price: 80000 },
        { capacity: 8, price: 60000 },
      ] as any,
    })
    const booking = makePrivateBooking(entrySnapshots)
    const passengers = [
      makePassenger(false),
      makePassenger(true),
      makePassenger(false),
      makePassenger(false),
    ] // 4 total, 1 comp
    const result = calculateTourPrice(booking, [tour], passengers)
    // tier by 4 → capacity:4 → 80000; billable = 3
    expect(result.baseTotal).toBe(240000)
  })

  test("REQ-06 Scenario H: all-but-one comp → billable=1", () => {
    const tour = makeTour({
      privatePricing: [{ capacity: 4, price: 80000 }] as any,
    })
    const booking = makePrivateBooking(entrySnapshots)
    const passengers = [
      makePassenger(true),
      makePassenger(true),
      makePassenger(true),
      makePassenger(false),
    ] // 4 total, 3 comps
    const result = calculateTourPrice(booking, [tour], passengers)
    // tier by 4 → 80000; billable=1
    expect(result.baseTotal).toBe(80000)
  })

  test("REQ-06 Scenario I: comps keep booking at higher tier (tier by totalPax)", () => {
    const tour = makeTour({
      privatePricing: [
        { capacity: 4, price: 80000 },
        { capacity: 6, price: 60000 },
      ] as any,
    })
    const booking = makePrivateBooking(entrySnapshots)
    const passengers = [
      makePassenger(false),
      makePassenger(false),
      makePassenger(false),
      makePassenger(false),
      makePassenger(true), // 5 total, 1 comp
    ]
    const result = calculateTourPrice(booking, [tour], passengers)
    // tier by 5 → capacity:6 → 60000; billable=4
    expect(result.baseTotal).toBe(240000)
  })

  test("REQ-06 Scenario J: all passengers comp → billable=0, baseTotal=0, entrance intact", () => {
    const tour = makeTour({
      privatePricing: [{ capacity: 2, price: 90000 }] as any,
    })
    const booking = makePrivateBooking(
      [{ tourEntryId: "e-1", entryName: "Parque", categoryName: "General", variantName: "", count: 2, price: 10000 }]
    )
    const passengers = [makePassenger(true), makePassenger(true)]
    const result = calculateTourPrice(booking, [tour], passengers)
    expect(result.baseTotal).toBe(0)
    expect(result.entranceTotal).toBe(20000)
    expect(result.total).toBe(20000)
  })
})

// ─── T-08: Additional cases ───────────────────────────────────────────────────

describe("T-08: Additional pricing cases", () => {
  const tour = makeTour()

  test("REQ-04 Scenario C: multi-comp same category within count — deducts N×unitPrice, no clamp", () => {
    const booking = makeRegularBooking([
      { priceCategoryId: "cat-1", categoryName: "Adulto", count: 3, price: 50000, reception: 0 },
    ])
    const passengers = [
      makePassenger(true, "Adulto"),
      makePassenger(true, "Adulto"),
      makePassenger(false),
    ] // 2 comps, count=3 → no clamp
    const result = calculateTourPrice(booking, [tour], passengers)
    // baseTotal = 3×50000 - 2×50000 = 50000
    expect(result.baseTotal).toBe(50000)
  })

  test("REQ-04 Scenario D: complimentary=false with complimentaryCategory set → no deduction", () => {
    const booking = makeRegularBooking([
      { priceCategoryId: "cat-1", categoryName: "Adulto", count: 2, price: 50000, reception: 0 },
    ])
    const passengers = [
      makePassenger(false, "Adulto"), // switch is OFF → no deduction
      makePassenger(false),
    ]
    const result = calculateTourPrice(booking, [tour], passengers)
    expect(result.baseTotal).toBe(100000)
  })

  test("no-comp regression: existing totals unchanged when zero comps", () => {
    const booking = makeRegularBooking([
      { priceCategoryId: "cat-1", categoryName: "Adulto", count: 2, price: 50000, reception: 0 },
    ])
    const passengers = [makePassenger(false), makePassenger(false)]
    const result = calculateTourPrice(booking, [tour], passengers)
    expect(result.baseTotal).toBe(100000)
  })

  test("countComplimentary: total count (no category filter)", () => {
    const passengers = [
      makePassenger(true, "Adulto"),
      makePassenger(false),
      makePassenger(true, "Niño"),
    ]
    expect(countComplimentary(passengers)).toBe(2)
  })

  test("countComplimentary: category-filtered count", () => {
    const passengers = [
      makePassenger(true, "Adulto"),
      makePassenger(true, "Niño"),
      makePassenger(true, "Adulto"),
    ]
    expect(countComplimentary(passengers, "Adulto")).toBe(2)
    expect(countComplimentary(passengers, "Niño")).toBe(1)
    expect(countComplimentary(passengers, "Senior")).toBe(0)
  })

  test("REQ-11 Scenario O: multi-tour blanket — deduction in matching booking, none in other", () => {
    const tour1 = makeTour({ id: "tour-1" })
    const tour2 = makeTour({ id: "tour-2" })
    const booking1: EventBookingSchema = makeRegularBooking([
      { priceCategoryId: "cat-1", categoryName: "Adulto", count: 2, price: 50000, reception: 0 },
    ])
    const booking2: EventBookingSchema = {
      ...makeRegularBooking([
        { priceCategoryId: "cat-2", categoryName: "Niño", count: 2, price: 25000, reception: 0 },
      ]),
      tourId: "tour-2",
    }
    const passengers = [makePassenger(true, "Adulto"), makePassenger(false)]

    const result1 = calculateTourPrice(booking1, [tour1], passengers)
    const result2 = calculateTourPrice(booking2, [tour2], passengers)

    // Booking1: 2×50000 - 50000 = 50000
    expect(result1.baseTotal).toBe(50000)
    // Booking2: no "Adulto" in priceEntries → 2×25000 = 50000
    expect(result2.baseTotal).toBe(50000)
  })

  // S-1: Lock the ordering — comp deduction reduces baseTotal FIRST, markup
  // multiplies the already-reduced base (markup amplifies the savings, not
  // the other way around). Concrete numbers make the expected total unambiguous.
  //
  // Setup: REGULAR sale, isWholesale=true, wholesaleMarkup=50%
  //   priceEntries: [{Adulto, price:100000, count:2}] → rawBase=200000
  //   1 comp Adulto → deduction=100000 → baseTotal=100000
  //   markup 50% on baseTotal=100000 → baseTotalWithMarkup=150000
  //   entranceTotal=0 → totalTours=150000
  //
  // If ordering were WRONG (markup first, then comp deduction):
  //   rawBase=200000 → markup=300000 → deduct=100000 → totalTours=200000 ≠ 150000
  test("S-1: markup multiplies the comp-reduced base (comp deduction before markup)", () => {
    const tour = makeTour({ id: "tour-s1" })
    const booking: EventBookingSchema = {
      ...makeRegularBooking([
        { priceCategoryId: "cat-1", categoryName: "Adulto", count: 2, price: 100000, reception: 0 },
      ]),
      tourId: "tour-s1",
    }
    const passengers = [makePassenger(true, "Adulto"), makePassenger(false)]

    const saleData: Partial<import("@/project/sales/schemas/sale-record.schema").SaleRecord> = {
      eventBookings: [booking],
      passengerArray: passengers,
      paymentArray: [],
      isWholesale: true,
      wholesaleMarkup: 50,
    }

    const result = calculateSaleTotals(saleData, [tour])

    // comp deduction reduces baseTotal: 200000 - 100000 = 100000
    expect(result.totalBaseTours).toBe(100000)
    // markup of 50% applied ON the reduced base: 100000 × 1.5 = 150000
    expect(result.subtotalTours).toBe(150000)
    expect(result.totalTours).toBe(150000)
    // markup amount = 150000 - 100000 = 50000
    expect(result.wholesaleMarkupAmount).toBe(50000)
  })

  test("mixed-mode: REGULAR booking deducts, PRIVATE booking uses billable split", () => {
    const tourReg = makeTour({ id: "tour-reg" })
    const tourPriv = makeTour({
      id: "tour-priv",
      privatePricing: [{ capacity: 3, price: 60000 }] as any,
    })
    // Override tourId to match the tour lookup
    const regularBooking: EventBookingSchema = {
      ...makeRegularBooking([
        { priceCategoryId: "cat-1", categoryName: "Adulto", count: 2, price: 50000, reception: 0 },
      ]),
      tourId: "tour-reg",
    }
    const privateBooking: EventBookingSchema = {
      ...makePrivateBooking(),
      tourId: "tour-priv",
    }
    const passengers = [
      makePassenger(true, "Adulto"),
      makePassenger(false),
      makePassenger(false),
    ]

    const resultReg = calculateTourPrice(regularBooking, [tourReg], passengers)
    const resultPriv = calculateTourPrice(privateBooking, [tourPriv], passengers)

    // REGULAR: 2×50000 - 50000 = 50000
    expect(resultReg.baseTotal).toBe(50000)
    // PRIVATE: tier by 3 → 60000; billable = 2
    expect(resultPriv.baseTotal).toBe(120000)
  })
})

// ─── Single-category booking: uncategorized comp still goes free ──────────────

describe("REGULAR mode — single-category booking deducts an uncategorized comp", () => {
  // The form hides the category selector when only one category exists, so a comp
  // passenger may carry no complimentaryCategory. The deduction must still apply.
  const priceEntries = [
    { priceCategoryId: "cat-1", categoryName: "Adulto", count: 3, price: 38000, reception: 0 },
  ]
  const tour = makeTour()
  const booking = makeRegularBooking(priceEntries)

  test("comp with undefined category is deducted from the sole category", () => {
    const passengers = [
      makePassenger(true, undefined),
      makePassenger(false),
      makePassenger(false),
    ]
    const result = calculateTourPrice(booking, [tour], passengers)
    // 3×38000=114000; deduct 1 comp = 38000 → 76000
    expect(result.baseTotal).toBe(76000)
  })

  test("comp with empty-string category is deducted from the sole category", () => {
    const passengers = [makePassenger(true, ""), makePassenger(false), makePassenger(false)]
    const result = calculateTourPrice(booking, [tour], passengers)
    expect(result.baseTotal).toBe(76000)
  })

  test("does not deduct more than the category count (clamped)", () => {
    const passengers = [
      makePassenger(true, undefined),
      makePassenger(true, undefined),
      makePassenger(true, undefined),
      makePassenger(true, undefined),
    ]
    const result = calculateTourPrice(booking, [tour], passengers)
    // 4 comps but only 3 charged → clamp to 3 → baseTotal 0
    expect(result.baseTotal).toBe(0)
  })

  test("multi-category booking does NOT attribute an uncategorized comp (no double-count)", () => {
    const multi = makeRegularBooking([
      { priceCategoryId: "cat-1", categoryName: "Adulto", count: 2, price: 50000, reception: 0 },
      { priceCategoryId: "cat-2", categoryName: "Niño", count: 1, price: 25000, reception: 0 },
    ])
    const passengers = [makePassenger(true, undefined), makePassenger(false)]
    const result = calculateTourPrice(multi, [tour], passengers)
    // No category match for an uncategorized comp when >1 entries → no deduction
    // 2×50000 + 1×25000 = 125000
    expect(result.baseTotal).toBe(125000)
  })
})
