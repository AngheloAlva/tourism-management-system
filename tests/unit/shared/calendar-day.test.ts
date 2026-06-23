import { describe, expect, it, vi, afterEach } from "vitest"
import {
  todayInSantiago,
  formatCalendarDay,
  parseCalendarDay,
  calendarDayRange,
  isSameCalendarDay,
  calendarDayKey,
  isPastEventDate,
  calendarDayToLocalDate,
} from "@/shared/utils/calendar-day"

afterEach(() => {
  vi.useRealTimers()
})

// ─── todayInSantiago ──────────────────────────────────────────────────────────

describe("todayInSantiago", () => {
  it("returns a Date at UTC midnight representing the Santiago calendar day", () => {
    // 2026-05-28T06:00:00Z = May 28 02:00 in Santiago (CLT UTC-4)
    vi.setSystemTime(new Date("2026-05-28T06:00:00.000Z"))
    const result = todayInSantiago()
    expect(result.getUTCFullYear()).toBe(2026)
    expect(result.getUTCMonth()).toBe(4) // 0-indexed May
    expect(result.getUTCDate()).toBe(28)
    expect(result.getUTCHours()).toBe(0)
    expect(result.getUTCMinutes()).toBe(0)
    expect(result.getUTCSeconds()).toBe(0)
    expect(result.getUTCMilliseconds()).toBe(0)
  })

  it("returns Santiago day even when UTC is already next day", () => {
    // 2026-05-29T02:00:00Z = May 28 22:00 in Santiago (CLT UTC-4)
    vi.setSystemTime(new Date("2026-05-29T02:00:00.000Z"))
    const result = todayInSantiago()
    expect(result.getUTCFullYear()).toBe(2026)
    expect(result.getUTCMonth()).toBe(4) // May
    expect(result.getUTCDate()).toBe(28)
  })

  it("returns the same Date regardless of runtime local zone (isomorphic SSR/client behavior)", () => {
    // Simulate an instant: 2026-07-15T15:00:00Z = July 15 11:00 in Santiago (CLT UTC-4)
    const instant = new Date("2026-07-15T15:00:00.000Z")
    vi.setSystemTime(instant)
    const result = todayInSantiago()
    // Must always return 2026-07-15 UTC midnight regardless of process timezone
    expect(result.getTime()).toBe(new Date("2026-07-15T00:00:00.000Z").getTime())
  })

  // DST fall-back: Chile falls back April 5 2026 at midnight (01:00 → 00:00, UTC-3 → UTC-4)
  it("returns correct day during DST fall-back transition (April 5)", () => {
    // 2026-04-05T02:30:00Z = April 4 23:30 in CLST (UTC-3, summer time) — still April 4 in Santiago
    vi.setSystemTime(new Date("2026-04-05T02:30:00.000Z"))
    const result = todayInSantiago()
    expect(result.getUTCDate()).toBe(4)
    expect(result.getUTCMonth()).toBe(3) // April
  })

  it("returns April 5 once Santiago crosses midnight on fall-back day", () => {
    // 2026-04-05T04:00:00Z = April 5 00:00 CLT (UTC-4, after fall-back)
    vi.setSystemTime(new Date("2026-04-05T04:00:00.000Z"))
    const result = todayInSantiago()
    expect(result.getUTCDate()).toBe(5)
    expect(result.getUTCMonth()).toBe(3) // April
  })

  // DST spring-forward: Chile springs forward Sep 8 2026 at 00:00 (skips to 01:00, UTC-4 → UTC-3)
  it("returns Sep 7 in Santiago just before spring-forward midnight (Sep 7 23:59 CLT)", () => {
    // 2026-09-08T02:59:00Z = Sep 7 22:59 in CLT (UTC-4), still Sep 7 in Santiago
    vi.setSystemTime(new Date("2026-09-08T02:59:00.000Z"))
    const result = todayInSantiago()
    expect(result.getUTCDate()).toBe(7)
    expect(result.getUTCMonth()).toBe(8) // September
  })

  it("returns September 8 once Santiago crosses midnight on spring-forward day", () => {
    // Chile spring-forward: Sep 8 at midnight CLT (UTC-4) clocks skip to 01:00 CLST (UTC-3)
    // Sep 8 00:00 CLT = 2026-09-08T04:00:00Z, but spring-forward skips to 01:00 so
    // the first Sep 8 instant in Santiago is 2026-09-08T03:00:00Z (00:00 CLT / 01:00 CLST)
    // 2026-09-08T03:30:00Z = Sep 8 00:30 in Santiago
    vi.setSystemTime(new Date("2026-09-08T03:30:00.000Z"))
    const result = todayInSantiago()
    expect(result.getUTCDate()).toBe(8)
    expect(result.getUTCMonth()).toBe(8) // September
  })
})

// ─── formatCalendarDay ────────────────────────────────────────────────────────

describe("formatCalendarDay", () => {
  it("formats a UTC-midnight Date as DD/MM/YYYY", () => {
    const date = new Date("2026-05-28T00:00:00.000Z")
    expect(formatCalendarDay(date, "dd/MM/yyyy")).toBe("28/05/2026")
  })

  it("formats using the UTC date components, not local timezone", () => {
    // UTC midnight on May 28 — should always format as May 28
    const date = new Date("2026-05-28T00:00:00.000Z")
    expect(formatCalendarDay(date, "yyyy-MM-dd")).toBe("2026-05-28")
  })

  it("returns empty string for null", () => {
    expect(formatCalendarDay(null, "dd/MM/yyyy")).toBe("")
  })

  it("returns empty string for undefined", () => {
    expect(formatCalendarDay(undefined, "dd/MM/yyyy")).toBe("")
  })

  it("formats DST fall-back boundary date (April 5)", () => {
    const date = new Date("2026-04-05T00:00:00.000Z")
    expect(formatCalendarDay(date, "dd/MM/yyyy")).toBe("05/04/2026")
  })

  it("formats DST spring-forward boundary date (September 8)", () => {
    const date = new Date("2026-09-08T00:00:00.000Z")
    expect(formatCalendarDay(date, "dd/MM/yyyy")).toBe("08/09/2026")
  })

  it("formats different patterns correctly", () => {
    const date = new Date("2026-01-01T00:00:00.000Z")
    expect(formatCalendarDay(date, "MMMM d, yyyy")).toBe("January 1, 2026")
  })
})

// ─── parseCalendarDay ─────────────────────────────────────────────────────────

describe("parseCalendarDay", () => {
  it("parses a valid yyyy-MM-dd string to a UTC-midnight Date", () => {
    const result = parseCalendarDay("2026-05-28")
    expect(result.getUTCFullYear()).toBe(2026)
    expect(result.getUTCMonth()).toBe(4)
    expect(result.getUTCDate()).toBe(28)
    expect(result.getUTCHours()).toBe(0)
    expect(result.getUTCMinutes()).toBe(0)
    expect(result.getUTCSeconds()).toBe(0)
  })

  it("returns a Date Prisma will serialize to the same yyyy-MM-dd as a @db.Date", () => {
    const result = parseCalendarDay("2026-05-28")
    // @db.Date columns store and return UTC-midnight Dates — the stored value is
    // reconstructable from the UTC year/month/day components
    expect(result.toISOString()).toBe("2026-05-28T00:00:00.000Z")
  })

  it("throws on an invalid format string", () => {
    expect(() => parseCalendarDay("28/05/2026")).toThrow()
  })

  it("throws on an empty string", () => {
    expect(() => parseCalendarDay("")).toThrow()
  })

  it("throws on invalid month", () => {
    expect(() => parseCalendarDay("2026-13-01")).toThrow()
  })

  it("throws on day overflow (day > 31)", () => {
    expect(() => parseCalendarDay("2026-01-32")).toThrow()
  })

  it("throws on day zero", () => {
    expect(() => parseCalendarDay("2026-05-00")).toThrow()
  })

  it("throws on random non-date string", () => {
    expect(() => parseCalendarDay("invalid")).toThrow()
  })

  it("correctly parses DST fall-back boundary (April 5)", () => {
    const result = parseCalendarDay("2026-04-05")
    expect(result.toISOString()).toBe("2026-04-05T00:00:00.000Z")
  })

  it("correctly parses DST spring-forward boundary (September 8)", () => {
    const result = parseCalendarDay("2026-09-08")
    expect(result.toISOString()).toBe("2026-09-08T00:00:00.000Z")
  })
})

// ─── calendarDayRange ─────────────────────────────────────────────────────────

describe("calendarDayRange", () => {
  it("returns gte at UTC midnight of the given day", () => {
    const day = new Date("2026-05-28T00:00:00.000Z")
    const { gte } = calendarDayRange(day)
    expect(gte.toISOString()).toBe("2026-05-28T00:00:00.000Z")
  })

  it("returns lt at UTC midnight of the next day", () => {
    const day = new Date("2026-05-28T00:00:00.000Z")
    const { lt } = calendarDayRange(day)
    expect(lt.toISOString()).toBe("2026-05-29T00:00:00.000Z")
  })

  it("lt is exactly 24h after gte", () => {
    const day = new Date("2026-05-28T00:00:00.000Z")
    const { gte, lt } = calendarDayRange(day)
    expect(lt.getTime() - gte.getTime()).toBe(24 * 60 * 60 * 1000)
  })

  it("lt is strictly greater than gte", () => {
    const day = new Date("2026-05-28T00:00:00.000Z")
    const { gte, lt } = calendarDayRange(day)
    expect(lt.getTime()).toBeGreaterThan(gte.getTime())
  })

  it("works across month boundaries", () => {
    const day = new Date("2026-01-31T00:00:00.000Z")
    const { gte, lt } = calendarDayRange(day)
    expect(gte.toISOString()).toBe("2026-01-31T00:00:00.000Z")
    expect(lt.toISOString()).toBe("2026-02-01T00:00:00.000Z")
  })

  it("works across year boundaries", () => {
    const day = new Date("2025-12-31T00:00:00.000Z")
    const { gte, lt } = calendarDayRange(day)
    expect(lt.toISOString()).toBe("2026-01-01T00:00:00.000Z")
  })

  it("handles DST fall-back boundary day (April 5) — range is always exactly 24h in UTC", () => {
    const day = new Date("2026-04-05T00:00:00.000Z")
    const { gte, lt } = calendarDayRange(day)
    expect(lt.getTime() - gte.getTime()).toBe(24 * 60 * 60 * 1000)
  })

  it("handles DST spring-forward boundary day (September 8) — range is always exactly 24h in UTC", () => {
    const day = new Date("2026-09-08T00:00:00.000Z")
    const { gte, lt } = calendarDayRange(day)
    expect(lt.getTime() - gte.getTime()).toBe(24 * 60 * 60 * 1000)
  })
})

// ─── isSameCalendarDay ────────────────────────────────────────────────────────

describe("isSameCalendarDay", () => {
  it("returns true for two Dates representing the same UTC calendar day", () => {
    const a = new Date("2026-05-28T00:00:00.000Z")
    const b = new Date("2026-05-28T00:00:00.000Z")
    expect(isSameCalendarDay(a, b)).toBe(true)
  })

  it("returns false for adjacent days", () => {
    const a = new Date("2026-05-28T00:00:00.000Z")
    const b = new Date("2026-05-29T00:00:00.000Z")
    expect(isSameCalendarDay(a, b)).toBe(false)
  })

  it("returns false for same month different days", () => {
    const a = new Date("2026-05-01T00:00:00.000Z")
    const b = new Date("2026-05-31T00:00:00.000Z")
    expect(isSameCalendarDay(a, b)).toBe(false)
  })

  it("returns false when null is passed as first argument", () => {
    const b = new Date("2026-05-28T00:00:00.000Z")
    expect(isSameCalendarDay(null, b)).toBe(false)
  })

  it("returns false when undefined is passed as second argument", () => {
    const a = new Date("2026-05-28T00:00:00.000Z")
    expect(isSameCalendarDay(a, undefined)).toBe(false)
  })

  it("returns false when both are null", () => {
    expect(isSameCalendarDay(null, null)).toBe(false)
  })

  it("returns false for different years on the same month/day", () => {
    const a = new Date("2025-05-28T00:00:00.000Z")
    const b = new Date("2026-05-28T00:00:00.000Z")
    expect(isSameCalendarDay(a, b)).toBe(false)
  })

  // DST boundary: two Dates that both encode the same Santiago calendar day
  it("returns true for DST fall-back day (April 5) when both encode 2026-04-05", () => {
    const a = new Date("2026-04-05T00:00:00.000Z")
    const b = new Date("2026-04-05T00:00:00.000Z")
    expect(isSameCalendarDay(a, b)).toBe(true)
  })

  it("returns false across DST fall-back boundary (April 4 vs April 5)", () => {
    const a = new Date("2026-04-04T00:00:00.000Z")
    const b = new Date("2026-04-05T00:00:00.000Z")
    expect(isSameCalendarDay(a, b)).toBe(false)
  })

  it("returns false across DST spring-forward boundary (Sep 7 vs Sep 8)", () => {
    const a = new Date("2026-09-07T00:00:00.000Z")
    const b = new Date("2026-09-08T00:00:00.000Z")
    expect(isSameCalendarDay(a, b)).toBe(false)
  })
})

// ─── calendarDayKey ───────────────────────────────────────────────────────────

describe("calendarDayKey", () => {
  it("returns yyyy-MM-dd string for a UTC-midnight Date", () => {
    const date = new Date("2026-05-28T00:00:00.000Z")
    expect(calendarDayKey(date)).toBe("2026-05-28")
  })

  it("returns empty string for null", () => {
    expect(calendarDayKey(null)).toBe("")
  })

  it("returns empty string for undefined", () => {
    expect(calendarDayKey(undefined)).toBe("")
  })

  it("zero-pads month and day", () => {
    const date = new Date("2026-01-05T00:00:00.000Z")
    expect(calendarDayKey(date)).toBe("2026-01-05")
  })

  it("produces keys sortable by calendar order", () => {
    const dates = [
      new Date("2026-03-01T00:00:00.000Z"),
      new Date("2026-01-15T00:00:00.000Z"),
      new Date("2026-12-31T00:00:00.000Z"),
    ]
    const keys = dates.map(calendarDayKey)
    const sorted = [...keys].sort()
    expect(sorted).toEqual(["2026-01-15", "2026-03-01", "2026-12-31"])
  })

  it("returns correct key for DST fall-back boundary (April 5)", () => {
    const date = new Date("2026-04-05T00:00:00.000Z")
    expect(calendarDayKey(date)).toBe("2026-04-05")
  })

  it("returns correct key for DST spring-forward boundary (September 8)", () => {
    const date = new Date("2026-09-08T00:00:00.000Z")
    expect(calendarDayKey(date)).toBe("2026-09-08")
  })
})

// ─── isPastEventDate ──────────────────────────────────────────────────────────

describe("isPastEventDate", () => {
  const TODAY = new Date(Date.UTC(2026, 4, 30)) // 2026-05-30 UTC midnight
  const YESTERDAY = new Date(Date.UTC(2026, 4, 29)) // 2026-05-29 UTC midnight
  const TOMORROW = new Date(Date.UTC(2026, 4, 31)) // 2026-05-31 UTC midnight

  it("returns true for yesterday (strictly before today)", () => {
    expect(isPastEventDate(YESTERDAY, TODAY)).toBe(true)
  })

  it("returns false for today (boundary: today is NOT past)", () => {
    expect(isPastEventDate(TODAY, TODAY)).toBe(false)
  })

  it("returns false for tomorrow (future)", () => {
    expect(isPastEventDate(TOMORROW, TODAY)).toBe(false)
  })

  it("returns false for null date", () => {
    expect(isPastEventDate(null, TODAY)).toBe(false)
  })

  it("returns false for undefined date", () => {
    expect(isPastEventDate(undefined, TODAY)).toBe(false)
  })

  it("works correctly with an explicit today param", () => {
    const customToday = new Date(Date.UTC(2026, 0, 15)) // 2026-01-15
    const beforeCustom = new Date(Date.UTC(2026, 0, 14)) // 2026-01-14
    const onCustom = new Date(Date.UTC(2026, 0, 15)) // 2026-01-15
    const afterCustom = new Date(Date.UTC(2026, 0, 16)) // 2026-01-16
    expect(isPastEventDate(beforeCustom, customToday)).toBe(true)
    expect(isPastEventDate(onCustom, customToday)).toBe(false)
    expect(isPastEventDate(afterCustom, customToday)).toBe(false)
  })

  it("DST edge: system time near Santiago midnight (UTC 23:30 = Santiago 20:30 CLT) — date is still today in Santiago, not past", () => {
    // 2026-05-30T23:30:00Z = May 30 19:30 in Santiago (CLT UTC-4)
    // Santiago calendar day is still May 30 — so a booking for 2026-05-30 is NOT past
    vi.setSystemTime(new Date("2026-05-30T23:30:00.000Z"))
    const santiagoCurrent = todayInSantiago() // should be 2026-05-30
    const todayBooking = new Date(Date.UTC(2026, 4, 30)) // 2026-05-30
    expect(isPastEventDate(todayBooking, santiagoCurrent)).toBe(false)
    vi.useRealTimers()
  })
})

// ─── calendarDayToLocalDate ─────────────────────────────────────────────────────

describe("calendarDayToLocalDate", () => {
  it("returns a Date carrying the stored calendar day in LOCAL components", () => {
    // @db.Date values arrive as UTC midnight. The picker reads LOCAL components,
    // so the returned Date must expose the same Y/M/D via the local getters.
    const dbDate = new Date("2026-07-20T00:00:00.000Z")
    const result = calendarDayToLocalDate(dbDate)!
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(6) // 0-indexed July
    expect(result.getDate()).toBe(20)
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
  })

  it("returns undefined for null/undefined input", () => {
    expect(calendarDayToLocalDate(null)).toBeUndefined()
    expect(calendarDayToLocalDate(undefined)).toBeUndefined()
  })
})
