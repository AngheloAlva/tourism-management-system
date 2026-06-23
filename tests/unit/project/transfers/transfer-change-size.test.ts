/**
 * S2-T1 RED: Unit tests for isLargeTransferChange / classifyTransferChange.
 *
 * Covers ALL cases from the spec (R3-AC1..R3-AC6):
 * - Only scalars changed → SMALL
 * - Event changed → LARGE
 * - Passenger added → LARGE
 * - Passenger removed → LARGE
 * - Passenger removed with payment → LARGE (set changes regardless)
 * - No changes at all → SMALL
 * - Set equality is order-independent → SMALL when same elements different order
 * - Empty sets edge cases
 */

import { describe, it, expect } from "vitest"
import {
  isLargeTransferChange,
  classifyTransferChange,
  type TransferSnapshot,
} from "@/project/transfers/utils/transfer-change-size"

describe("classifyTransferChange (R3-AC6: pure, no DB)", () => {
  // R3-AC1 — only scalars changed (agencyId changed, event+passengers same) → SMALL
  it("returns 'small' when only scalar fields changed (event and passengers identical)", () => {
    const current: TransferSnapshot = {
      eventIds: new Set(["E1"]),
      passengerIds: new Set(["p1", "p2"]),
    }
    const next: TransferSnapshot = {
      eventIds: new Set(["E1"]),
      passengerIds: new Set(["p1", "p2"]),
    }
    expect(classifyTransferChange(current, next)).toBe("small")
  })

  // R3-AC2 — event changed → LARGE
  it("returns 'large' when eventId changed", () => {
    const current: TransferSnapshot = {
      eventIds: new Set(["E1"]),
      passengerIds: new Set(["p1", "p2"]),
    }
    const next: TransferSnapshot = {
      eventIds: new Set(["E2"]),
      passengerIds: new Set(["p1", "p2"]),
    }
    expect(classifyTransferChange(current, next)).toBe("large")
  })

  // R3-AC3 — passenger added → LARGE
  it("returns 'large' when a passenger was added", () => {
    const current: TransferSnapshot = {
      eventIds: new Set(["E1"]),
      passengerIds: new Set(["p1", "p2"]),
    }
    const next: TransferSnapshot = {
      eventIds: new Set(["E1"]),
      passengerIds: new Set(["p1", "p2", "p3"]),
    }
    expect(classifyTransferChange(current, next)).toBe("large")
  })

  // R3-AC4 — passenger removed → LARGE
  it("returns 'large' when a passenger was removed", () => {
    const current: TransferSnapshot = {
      eventIds: new Set(["E1"]),
      passengerIds: new Set(["p1", "p2"]),
    }
    const next: TransferSnapshot = {
      eventIds: new Set(["E1"]),
      passengerIds: new Set(["p1"]),
    }
    expect(classifyTransferChange(current, next)).toBe("large")
  })

  // R3-AC4 (variant) — removing a passenger with payments is always LARGE
  it("returns 'large' when a paid passenger was removed (set changes → LARGE regardless of payment)", () => {
    // The payment status is irrelevant to the classifier — it only looks at set membership
    const current: TransferSnapshot = {
      eventIds: new Set(["E1"]),
      passengerIds: new Set(["p1", "p2"]),
    }
    const next: TransferSnapshot = {
      eventIds: new Set(["E1"]),
      passengerIds: new Set(["p1"]), // p2 removed (even if p2 had payments)
    }
    expect(classifyTransferChange(current, next)).toBe("large")
  })

  // No changes at all → SMALL
  it("returns 'small' when nothing changed (identical snapshots)", () => {
    const current: TransferSnapshot = {
      eventIds: new Set(["E1", "E2"]),
      passengerIds: new Set(["p1", "p2", "p3"]),
    }
    const next: TransferSnapshot = {
      eventIds: new Set(["E1", "E2"]),
      passengerIds: new Set(["p1", "p2", "p3"]),
    }
    expect(classifyTransferChange(current, next)).toBe("small")
  })

  // R3-AC5 — set comparison is order-independent → SMALL when same elements different order
  it("returns 'small' for order-independent set equality (passengers in different order)", () => {
    const current: TransferSnapshot = {
      eventIds: new Set(["E1"]),
      passengerIds: new Set(["p2", "p1"]),
    }
    const next: TransferSnapshot = {
      eventIds: new Set(["E1"]),
      passengerIds: new Set(["p1", "p2"]),
    }
    expect(classifyTransferChange(current, next)).toBe("small")
  })

  // Edge case: empty passenger sets (no change) → SMALL
  it("returns 'small' when both sets are empty", () => {
    const current: TransferSnapshot = {
      eventIds: new Set(["E1"]),
      passengerIds: new Set(),
    }
    const next: TransferSnapshot = {
      eventIds: new Set(["E1"]),
      passengerIds: new Set(),
    }
    expect(classifyTransferChange(current, next)).toBe("small")
  })

  // Edge case: event removed from a multi-event set → LARGE
  it("returns 'large' when an event is removed from a multi-event transfer", () => {
    const current: TransferSnapshot = {
      eventIds: new Set(["E1", "E2"]),
      passengerIds: new Set(["p1"]),
    }
    const next: TransferSnapshot = {
      eventIds: new Set(["E1"]),
      passengerIds: new Set(["p1"]),
    }
    expect(classifyTransferChange(current, next)).toBe("large")
  })
})

describe("isLargeTransferChange (boolean shorthand)", () => {
  it("returns true when event changed", () => {
    const current: TransferSnapshot = {
      eventIds: new Set(["E1"]),
      passengerIds: new Set(["p1"]),
    }
    const next: TransferSnapshot = {
      eventIds: new Set(["E2"]),
      passengerIds: new Set(["p1"]),
    }
    expect(isLargeTransferChange(current, next)).toBe(true)
  })

  it("returns false when nothing changed", () => {
    const current: TransferSnapshot = {
      eventIds: new Set(["E1"]),
      passengerIds: new Set(["p1"]),
    }
    const next: TransferSnapshot = {
      eventIds: new Set(["E1"]),
      passengerIds: new Set(["p1"]),
    }
    expect(isLargeTransferChange(current, next)).toBe(false)
  })
})
