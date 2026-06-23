/**
 * T-C8 — Event completion integration tests
 * Production code: src/project/events/actions/event-completion.actions.ts
 *
 * Key observations:
 * - completeElapsedEvents() is a cron-driven bulk action (no auth guard needed).
 * - Uses updateMany — no per-row audit log.
 * - Applies to SCHEDULED, CONFIRMED, IN_PROGRESS events 7+ days in the past.
 * - CANCELLED, TRANSFERRED, and already-COMPLETED events must remain unchanged.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { completeElapsedEvents } from "@/project/events/actions/event-completion.actions"
import { truncateAll, disconnect } from "../../helpers/db"
import { createEvent } from "../../helpers/factories"
import { todayInSantiago } from "@/shared/utils/calendar-day"

/** Returns a UTC-midnight Date that is `n` days before today, matching the
 *  production cutoff (todayInSantiago() minus n days via exact UTC arithmetic).
 *  Avoids the day-boundary off-by-one a wall-clock Date.now() would risk. */
function daysAgo(n: number): Date {
  return new Date(todayInSantiago().getTime() - n * 24 * 60 * 60 * 1000)
}

describe("completeElapsedEvents integration", () => {
  beforeEach(async () => {
    await truncateAll()
  })

  afterAll(async () => {
    await disconnect()
  })

  it("marks a CONFIRMED event 8 days old as COMPLETED", async () => {
    const event = await createEvent({ status: "CONFIRMED", date: daysAgo(8) })

    const result = await completeElapsedEvents()

    expect(result.completed).toBeGreaterThanOrEqual(1)
    const updated = await prisma.event.findUnique({ where: { id: event.id } })
    expect(updated?.status).toBe("COMPLETED")
  })

  it("leaves a CANCELLED event 8 days old unchanged", async () => {
    const event = await createEvent({ status: "CANCELLED", date: daysAgo(8) })

    await completeElapsedEvents()

    const unchanged = await prisma.event.findUnique({ where: { id: event.id } })
    expect(unchanged?.status).toBe("CANCELLED")
  })

  it("leaves a TRANSFERRED event 8 days old unchanged", async () => {
    const event = await createEvent({ status: "TRANSFERRED", date: daysAgo(8) })

    await completeElapsedEvents()

    const unchanged = await prisma.event.findUnique({ where: { id: event.id } })
    expect(unchanged?.status).toBe("TRANSFERRED")
  })

  it("leaves a SCHEDULED event only 3 days old unchanged", async () => {
    const event = await createEvent({ status: "SCHEDULED", date: daysAgo(3) })

    await completeElapsedEvents()

    const unchanged = await prisma.event.findUnique({ where: { id: event.id } })
    expect(unchanged?.status).toBe("SCHEDULED")
  })

  it("leaves an already-COMPLETED event 8 days old unchanged (stays COMPLETED)", async () => {
    const event = await createEvent({ status: "COMPLETED", date: daysAgo(8) })

    const result = await completeElapsedEvents()

    // The already-COMPLETED event must not be double-counted
    const unchanged = await prisma.event.findUnique({ where: { id: event.id } })
    expect(unchanged?.status).toBe("COMPLETED")
    // count reflects only genuinely transitioned events
    expect(result.completed).toBe(0)
  })

  it("returned count matches the number of events actually transitioned", async () => {
    // Two eligible events (SCHEDULED + IN_PROGRESS, both 8 days old)
    await createEvent({ status: "SCHEDULED", date: daysAgo(8) })
    await createEvent({ status: "IN_PROGRESS", date: daysAgo(8) })
    // One ineligible (CANCELLED, 8 days old)
    await createEvent({ status: "CANCELLED", date: daysAgo(8) })
    // One too recent (CONFIRMED, 3 days old)
    await createEvent({ status: "CONFIRMED", date: daysAgo(3) })

    const result = await completeElapsedEvents()

    expect(result.completed).toBe(2)
  })
})
