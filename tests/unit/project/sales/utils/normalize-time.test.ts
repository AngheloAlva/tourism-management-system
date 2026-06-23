import { describe, expect, test } from "vitest"
import { toHHmm } from "@/project/sales/utils/normalize-time"

describe("toHHmm", () => {
  test("passes through a canonical HH:mm value", () => {
    expect(toHHmm("14:30")).toBe("14:30")
    expect(toHHmm("18:00")).toBe("18:00")
    expect(toHHmm("00:00")).toBe("00:00")
  })

  test("strips seconds and fractional seconds (the migrated-Excel case)", () => {
    expect(toHHmm("14:30:00")).toBe("14:30")
    expect(toHHmm("14:30:00.000")).toBe("14:30")
    expect(toHHmm("18:00:00.0")).toBe("18:00")
  })

  test("trims surrounding whitespace", () => {
    expect(toHHmm(" 14:30 ")).toBe("14:30")
  })

  test("pads single-digit hours", () => {
    expect(toHHmm("9:30")).toBe("09:30")
    expect(toHHmm("8:05")).toBe("08:05")
  })

  test("converts 12-hour clock with meridiem to 24-hour", () => {
    expect(toHHmm("2:30 PM")).toBe("14:30")
    expect(toHHmm("2:30 pm")).toBe("14:30")
    expect(toHHmm("2:30 p.m.")).toBe("14:30")
    expect(toHHmm("11:15 AM")).toBe("11:15")
    expect(toHHmm("12:00 AM")).toBe("00:00")
    expect(toHHmm("12:00 PM")).toBe("12:00")
  })

  test("takes the first time when the source holds several", () => {
    expect(toHHmm("14:00/14:30")).toBe("14:00")
    expect(toHHmm("8:30 o 13:30")).toBe("08:30")
  })

  test("returns empty string for empty, null or unparseable input", () => {
    expect(toHHmm("")).toBe("")
    expect(toHHmm("   ")).toBe("")
    expect(toHHmm(null)).toBe("")
    expect(toHHmm(undefined)).toBe("")
    expect(toHHmm("Pendiente")).toBe("")
    expect(toHHmm("abc")).toBe("")
  })

  test("returns empty string for out-of-range times", () => {
    expect(toHHmm("25:00")).toBe("")
    expect(toHHmm("14:75")).toBe("")
  })
})
