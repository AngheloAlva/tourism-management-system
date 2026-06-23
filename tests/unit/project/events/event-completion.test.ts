import { describe, expect, it } from "vitest"
import { buildElapsedEventWhere } from "@/project/events/utils/event-completion"

describe("buildElapsedEventWhere", () => {
  it("sets cutoff to exactly today minus 7 days via UTC arithmetic", () => {
    // Use a known UTC-midnight Date as 'today'
    const today = new Date(Date.UTC(2025, 5, 15, 0, 0, 0, 0)) // 2025-06-15 UTC midnight
    const expected = new Date(Date.UTC(2025, 5, 8, 0, 0, 0, 0)) // 2025-06-08 UTC midnight

    const where = buildElapsedEventWhere(today)

    expect(where.date.lte.getTime()).toBe(expected.getTime())
  })

  it("includes SCHEDULED, CONFIRMED, IN_PROGRESS in the status filter", () => {
    const today = new Date(Date.UTC(2025, 5, 15, 0, 0, 0, 0))
    const where = buildElapsedEventWhere(today)

    expect(where.status.in).toContain("SCHEDULED")
    expect(where.status.in).toContain("CONFIRMED")
    expect(where.status.in).toContain("IN_PROGRESS")
    expect(where.status.in).toHaveLength(3)
  })

  it("excludes CANCELLED, TRANSFERRED, and COMPLETED from the status filter", () => {
    const today = new Date(Date.UTC(2025, 5, 15, 0, 0, 0, 0))
    const where = buildElapsedEventWhere(today)

    expect(where.status.in).not.toContain("CANCELLED")
    expect(where.status.in).not.toContain("TRANSFERRED")
    expect(where.status.in).not.toContain("COMPLETED")
  })

  it("produces a cutoff exactly 7 * 24h * 60m * 60s * 1000ms before today", () => {
    const today = new Date(Date.UTC(2026, 0, 1, 0, 0, 0, 0)) // 2026-01-01
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000

    const where = buildElapsedEventWhere(today)

    expect(today.getTime() - where.date.lte.getTime()).toBe(sevenDaysMs)
  })
})
