import { describe, expect, test } from "vitest"
import { rescheduleEventSchema } from "@/project/events/schemas/reschedule-event.schema"

describe("rescheduleEventSchema", () => {
  test("accepts a valid reschedule payload", () => {
    const result = rescheduleEventSchema.safeParse({
      eventId: "cm000000000000000000000000",
      newDate: new Date("2025-06-01"),
      reason: "Clima adverso",
    })
    expect(result.success).toBe(true)
  })

  test("rejects when reason is empty string", () => {
    const result = rescheduleEventSchema.safeParse({
      eventId: "cm000000000000000000000000",
      newDate: new Date("2025-06-01"),
      reason: "",
    })
    expect(result.success).toBe(false)
  })

  test("rejects when reason is only whitespace", () => {
    const result = rescheduleEventSchema.safeParse({
      eventId: "cm000000000000000000000000",
      newDate: new Date("2025-06-01"),
      reason: "   ",
    })
    expect(result.success).toBe(false)
  })

  test("accepts optional time fields when provided in HH:mm format", () => {
    const result = rescheduleEventSchema.safeParse({
      eventId: "cm000000000000000000000000",
      newDate: new Date("2025-06-01"),
      newStartTime: "08:30",
      newEndTime: "10:00",
      reason: "Logística",
    })
    expect(result.success).toBe(true)
  })

  test("rejects newStartTime in invalid format", () => {
    const result = rescheduleEventSchema.safeParse({
      eventId: "cm000000000000000000000000",
      newDate: new Date("2025-06-01"),
      newStartTime: "8:30am",
      reason: "Ajuste de horario",
    })
    expect(result.success).toBe(false)
  })
})
