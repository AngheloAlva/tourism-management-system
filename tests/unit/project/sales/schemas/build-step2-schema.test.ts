import { describe, expect, test } from "vitest"
import { buildStep2Schema } from "@/project/sales/schemas/sale-record.schema"
import { todayInSantiago } from "@/shared/utils/calendar-day"

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Build a minimal eventBookings payload for step-2 safeParse.
// Dates are derived from todayInSantiago() — the SAME boundary the schema uses —
// so they stay relative to the real "today" and never go stale (a hardcoded
// literal would silently flip from "today" to "past" once the calendar advances).
const DAY_MS = 24 * 60 * 60 * 1000
const TODAY = todayInSantiago()
const YESTERDAY = new Date(TODAY.getTime() - DAY_MS)
const TOMORROW = new Date(TODAY.getTime() + DAY_MS)

function makeStep2Values(dateOverride: Date, passengerCount: number) {
  return {
    eventBookings: [
      {
        mode: "REGULAR" as const,
        date: dateOverride,
        tourId: "tour-1",
        startTime: "",
        endTime: "",
        specialRequest: "",
        comments: "",
        priceEntries: [
          {
            priceCategoryId: "cat-1",
            categoryName: "Adulto",
            count: passengerCount,
            price: 20000,
            reception: 0,
          },
        ],
        entrySnapshots: [],
        excludedPassengers: [],
      },
    ],
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("buildStep2Schema", () => {
  test("create + past date + ≥1 passengers → has past-date issue on date path", () => {
    const schema = buildStep2Schema("create")
    const result = schema.safeParse(makeStep2Values(YESTERDAY, 1))
    expect(result.success).toBe(false)
    if (!result.success) {
      const hasDateIssue = result.error.issues.some(
        (i) =>
          Array.isArray(i.path) &&
          i.path[0] === "eventBookings" &&
          i.path[2] === "date"
      )
      expect(hasDateIssue).toBe(true)
    }
  })

  test("create + future date + 0 passengers → has min-passenger issue, no date issue", () => {
    const schema = buildStep2Schema("create")
    const result = schema.safeParse(makeStep2Values(TOMORROW, 0))
    expect(result.success).toBe(false)
    if (!result.success) {
      const hasMinPaxIssue = result.error.issues.some(
        (i) =>
          Array.isArray(i.path) &&
          i.path[0] === "eventBookings" &&
          i.path[2] === "priceEntries"
      )
      const hasDateIssue = result.error.issues.some(
        (i) =>
          Array.isArray(i.path) &&
          i.path[0] === "eventBookings" &&
          i.path[2] === "date"
      )
      expect(hasMinPaxIssue).toBe(true)
      expect(hasDateIssue).toBe(false)
    }
  })

  test("edit + past date + ≥1 passengers → NO issues (save proceeds)", () => {
    const schema = buildStep2Schema("edit")
    const result = schema.safeParse(makeStep2Values(YESTERDAY, 1))
    expect(result.success).toBe(true)
  })

  test("edit + past date + 0 passengers → has min-passenger issue, NO past-date issue", () => {
    const schema = buildStep2Schema("edit")
    const result = schema.safeParse(makeStep2Values(YESTERDAY, 0))
    expect(result.success).toBe(false)
    if (!result.success) {
      const hasMinPaxIssue = result.error.issues.some(
        (i) =>
          Array.isArray(i.path) &&
          i.path[0] === "eventBookings" &&
          i.path[2] === "priceEntries"
      )
      const hasDateIssue = result.error.issues.some(
        (i) =>
          Array.isArray(i.path) &&
          i.path[0] === "eventBookings" &&
          i.path[2] === "date"
      )
      expect(hasMinPaxIssue).toBe(true)
      expect(hasDateIssue).toBe(false)
    }
  })

  test("create + future date + ≥1 passengers → no issues (REQ-9 regression)", () => {
    const schema = buildStep2Schema("create")
    const result = schema.safeParse(makeStep2Values(TOMORROW, 1))
    expect(result.success).toBe(true)
  })

  test("create + today + ≥1 passengers → no issues (today is NOT past)", () => {
    const schema = buildStep2Schema("create")
    const result = schema.safeParse(makeStep2Values(TODAY, 1))
    expect(result.success).toBe(true)
  })
})
