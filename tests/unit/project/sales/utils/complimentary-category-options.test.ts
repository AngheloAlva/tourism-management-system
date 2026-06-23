/**
 * T-13: Unit tests for the complimentary category options derivation logic.
 *
 * These tests cover the pure logic used by the UI to determine:
 * 1. Which category names are available for complimentary selection
 *    (union of categoryName values from REGULAR bookings, deduped).
 * 2. Whether the category Select should be shown (REGULAR bookings exist).
 * 3. Whether a stored complimentaryCategory is orphaned (not in current options).
 *
 * The logic is extracted to a pure helper so it can be unit-tested without
 * rendering the component (the existing vitest config doesn't include jsdom/RTL).
 */
import { describe, expect, test } from "vitest"
import {
  getComplimentaryCategoryOptions,
  isOrphanedCategory,
} from "@/project/sales/utils/complimentary-category-options"
import type { EventBookingSchema } from "@/project/sales/schemas/sale-record.schema"

const makeBooking = (
  mode: "REGULAR" | "PRIVATE",
  categoryNames: string[] = []
): EventBookingSchema =>
  ({
    mode,
    tourId: "tour-1",
    date: new Date("2030-01-15"),
    priceEntries: categoryNames.map((name, i) => ({
      priceCategoryId: `cat-${i}`,
      categoryName: name,
      count: 1,
      price: 50000,
      reception: 0,
    })),
    entrySnapshots: [],
    excludedPassengers: [],
  }) as unknown as EventBookingSchema

describe("getComplimentaryCategoryOptions", () => {
  test("returns empty array for no bookings", () => {
    expect(getComplimentaryCategoryOptions([])).toEqual([])
  })

  test("returns empty array for PRIVATE-only bookings", () => {
    const bookings = [makeBooking("PRIVATE"), makeBooking("PRIVATE")]
    expect(getComplimentaryCategoryOptions(bookings)).toEqual([])
  })

  test("returns unique category names from REGULAR bookings", () => {
    const bookings = [makeBooking("REGULAR", ["Adulto", "Niño"])]
    const result = getComplimentaryCategoryOptions(bookings)
    expect(result).toContain("Adulto")
    expect(result).toContain("Niño")
    expect(result.length).toBe(2)
  })

  test("deduplicates category names across multiple REGULAR bookings", () => {
    const bookings = [
      makeBooking("REGULAR", ["Adulto", "Niño"]),
      makeBooking("REGULAR", ["Adulto", "Senior"]),
    ]
    const result = getComplimentaryCategoryOptions(bookings)
    expect(result.filter((n) => n === "Adulto").length).toBe(1)
    expect(result).toContain("Niño")
    expect(result).toContain("Senior")
    expect(result.length).toBe(3)
  })

  test("ignores PRIVATE bookings when mixed with REGULAR", () => {
    const bookings = [
      makeBooking("REGULAR", ["Adulto"]),
      makeBooking("PRIVATE", ["IgnoredCategory"]),
    ]
    const result = getComplimentaryCategoryOptions(bookings)
    expect(result).toContain("Adulto")
    expect(result).not.toContain("IgnoredCategory")
    expect(result.length).toBe(1)
  })

  test("filters out empty/falsy category names", () => {
    const bookings = [
      {
        ...makeBooking("REGULAR", ["Adulto"]),
        priceEntries: [
          { priceCategoryId: "cat-1", categoryName: "Adulto", count: 1, price: 50000, reception: 0 },
          { priceCategoryId: "cat-2", categoryName: "", count: 1, price: 0, reception: 0 },
        ],
      } as unknown as EventBookingSchema,
    ]
    const result = getComplimentaryCategoryOptions(bookings)
    expect(result).toContain("Adulto")
    expect(result).not.toContain("")
    expect(result.length).toBe(1)
  })
})

describe("isOrphanedCategory", () => {
  test("returns false when complimentaryCategory is in the options list", () => {
    expect(isOrphanedCategory("Adulto", ["Adulto", "Niño"])).toBe(false)
  })

  test("returns true when complimentaryCategory is not in the options list", () => {
    expect(isOrphanedCategory("OldCategory", ["Adulto", "Niño"])).toBe(true)
  })

  test("returns false when complimentaryCategory is empty/falsy", () => {
    expect(isOrphanedCategory("", ["Adulto"])).toBe(false)
    expect(isOrphanedCategory(undefined, ["Adulto"])).toBe(false)
  })

  test("returns false when options list is empty (nothing to be orphaned from)", () => {
    expect(isOrphanedCategory("Adulto", [])).toBe(false)
  })
})
