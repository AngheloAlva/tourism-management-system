import { describe, expect, test } from "vitest"
import {
  buildTransferSteps,
  buildTransferSchema,
} from "@/project/transfers/schemas/transfer.schema"
import { todayInSantiago } from "@/shared/utils/calendar-day"

// ─── Date helpers ─────────────────────────────────────────────────────────────
// Derived from todayInSantiago() so they stay relative to the real "today"
// and never go stale (hardcoded literals would silently flip to "past").

const DAY_MS = 24 * 60 * 60 * 1000
const TODAY = todayInSantiago()
const YESTERDAY = new Date(TODAY.getTime() - DAY_MS)
const TOMORROW = new Date(TODAY.getTime() + DAY_MS)

// ─── Minimal valid payload builders ───────────────────────────────────────────

const validPayment = {
  refund: false,
  method: "CASH" as const,
  amount: "10000",
  date: new Date(),
  documentNumber: undefined,
  comments: undefined,
}

const validEventTransfer = {
  eventId: "event-1",
  transferEvent: true,
  passengerPrices: [
    {
      passengerId: "pax-1",
      sourceSaleRecordId: "sale-1",
      isSelected: true,
      isAlreadyTransferred: false,
      passengerName: "Juan Perez",
      ageCategory: "Adulto",
      tourPrice: 10000,
      entrancePrice: 0,
      totalPrice: 10000,
    },
  ],
}

function makeTransferData(
  overrides: Partial<{
    date: Date
    paymentStatus: "PENDING" | "ENTRANCE_ONLY" | "TOUR_ONLY" | "FULLY_PAID"
    payments: typeof validPayment[]
  }> = {}
) {
  return {
    type: "OUTGOING" as const,
    agencyId: "agency-1",
    date: TOMORROW,
    paymentStatus: "PENDING" as const,
    comments: "",
    saleRecordId: "sale-1",
    eventTransfers: [validEventTransfer],
    payments: [],
    ...overrides,
  }
}

// ─── Tests: payment required when not PENDING ─────────────────────────────────

describe("buildTransferSchema — payments required when not PENDING", () => {
  test("FULLY_PAID + empty payments → fails with payments issue", () => {
    const schema = buildTransferSchema("create")
    const result = schema.safeParse(
      makeTransferData({ paymentStatus: "FULLY_PAID", payments: [] })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const hasPaymentsIssue = result.error.issues.some(
        (i) => Array.isArray(i.path) && i.path[0] === "payments"
      )
      expect(hasPaymentsIssue).toBe(true)
    }
  })

  test("FULLY_PAID + 1 payment → passes", () => {
    const schema = buildTransferSchema("create")
    const result = schema.safeParse(
      makeTransferData({ paymentStatus: "FULLY_PAID", payments: [validPayment] })
    )
    expect(result.success).toBe(true)
  })

  test("PENDING + empty payments → passes", () => {
    const schema = buildTransferSchema("create")
    const result = schema.safeParse(
      makeTransferData({ paymentStatus: "PENDING", payments: [] })
    )
    expect(result.success).toBe(true)
  })

  test("TOUR_ONLY + empty payments → fails", () => {
    const schema = buildTransferSchema("create")
    const result = schema.safeParse(
      makeTransferData({ paymentStatus: "TOUR_ONLY", payments: [] })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const hasPaymentsIssue = result.error.issues.some(
        (i) => Array.isArray(i.path) && i.path[0] === "payments"
      )
      expect(hasPaymentsIssue).toBe(true)
    }
  })
})

// ─── Tests: past-date blocking in create vs edit ───────────────────────────────

describe("buildTransferSteps — step1 past-date validation", () => {
  test("create + yesterday → fails with date issue", () => {
    const [step1] = buildTransferSteps("create")
    const result = step1.safeParse(makeTransferData({ date: YESTERDAY }))
    expect(result.success).toBe(false)
    if (!result.success) {
      const hasDateIssue = result.error.issues.some(
        (i) => Array.isArray(i.path) && i.path[0] === "date"
      )
      expect(hasDateIssue).toBe(true)
    }
  })

  test("create + today → passes", () => {
    const [step1] = buildTransferSteps("create")
    const result = step1.safeParse(makeTransferData({ date: TODAY }))
    expect(result.success).toBe(true)
  })

  test("create + tomorrow → passes", () => {
    const [step1] = buildTransferSteps("create")
    const result = step1.safeParse(makeTransferData({ date: TOMORROW }))
    expect(result.success).toBe(true)
  })

  test("edit + yesterday → passes (no blocking)", () => {
    const [step1] = buildTransferSteps("edit")
    const result = step1.safeParse(makeTransferData({ date: YESTERDAY }))
    expect(result.success).toBe(true)
  })
})
