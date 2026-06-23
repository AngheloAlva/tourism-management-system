import { describe, expect, test } from "vitest"
import {
  buildReceptionFormSteps,
} from "@/project/receptions/schemas/reception.schema"
import { todayInSantiago } from "@/shared/utils/calendar-day"

// ─── Date helpers ─────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000
const TODAY = todayInSantiago()
const YESTERDAY = new Date(TODAY.getTime() - DAY_MS)
const TOMORROW = new Date(TODAY.getTime() + DAY_MS)

// ─── Minimal valid event detail ────────────────────────────────────────────────

function makeEventDetail(dateOverride: Date) {
  return {
    mode: "REGULAR" as const,
    date: dateOverride,
    tourId: "tour-1",
    startTime: "",
    endTime: "",
    comments: "",
    priceEntries: [
      {
        priceCategoryId: "cat-1",
        categoryName: "Adulto",
        count: 2,
        price: 10000,
        reception: 0,
      },
    ],
    entrySnapshots: [],
  }
}

function makeStep1Values(dateOverride?: Date, eventDate?: Date) {
  return {
    agencyId: "agency-1",
    date: dateOverride ?? TOMORROW,
    paymentStatus: "PENDING" as const,
    eventDetails: [makeEventDetail(eventDate ?? TOMORROW)],
    comments: "",
  }
}

// ─── Tests: step1 includes date in validation ─────────────────────────────────
// Note: the base schema has date.default(() => new Date()), so an absent key
// uses the default rather than failing. These tests verify:
// 1. An invalid date type (e.g. a string that can't coerce) is rejected.
// 2. A valid Date passes through step1.

describe("buildReceptionFormSteps — step1 validates date", () => {
  test("step1 with invalid date value (non-date) → fails", () => {
    const [step1] = buildReceptionFormSteps("create")
    const values = makeStep1Values()
    // Force an invalid value that cannot satisfy z.date()
    const withBadDate = { ...values, date: "not-a-date" }
    const result = step1.safeParse(withBadDate)
    expect(result.success).toBe(false)
  })

  test("step1 with valid date → passes", () => {
    const [step1] = buildReceptionFormSteps("create")
    const result = step1.safeParse(makeStep1Values(TOMORROW))
    expect(result.success).toBe(true)
  })
})

// ─── Tests: past-date blocking for eventDetails[].date ────────────────────────

describe("buildReceptionFormSteps — step1 eventDetails past-date blocking", () => {
  test("create + event yesterday → fails with date issue on eventDetails path", () => {
    const [step1] = buildReceptionFormSteps("create")
    const result = step1.safeParse(makeStep1Values(TOMORROW, YESTERDAY))
    expect(result.success).toBe(false)
    if (!result.success) {
      const hasDateIssue = result.error.issues.some(
        (i) =>
          Array.isArray(i.path) &&
          i.path[0] === "eventDetails" &&
          i.path[2] === "date"
      )
      expect(hasDateIssue).toBe(true)
    }
  })

  test("create + event today → passes", () => {
    const [step1] = buildReceptionFormSteps("create")
    const result = step1.safeParse(makeStep1Values(TODAY, TODAY))
    expect(result.success).toBe(true)
  })

  test("create + event tomorrow → passes", () => {
    const [step1] = buildReceptionFormSteps("create")
    const result = step1.safeParse(makeStep1Values(TOMORROW, TOMORROW))
    expect(result.success).toBe(true)
  })

  test("edit + event yesterday → passes (no blocking)", () => {
    const [step1] = buildReceptionFormSteps("edit")
    const result = step1.safeParse(makeStep1Values(YESTERDAY, YESTERDAY))
    expect(result.success).toBe(true)
  })
})
