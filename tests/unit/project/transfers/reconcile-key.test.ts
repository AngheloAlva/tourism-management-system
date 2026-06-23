/**
 * S3-T1 RED → GREEN: Unit tests for deriveReconcileKey pure function.
 * Verifies the no-loop invariant: identical selection → identical key,
 * changed selection → different key.
 *
 * Also covers the CREATE regression fix: transferFullEvent and selectedVoucherId
 * are now part of the key so that switching voucher mode or specific voucher
 * in CREATE mode triggers passenger reconciliation.
 */

import { describe, it, expect } from "vitest"
import { deriveReconcileKey } from "@/project/transfers/utils/reconcile-key"

type PassengerPrice = {
  passengerId: string
  isSelected: boolean
  [key: string]: unknown
}

type EventTransfer = {
  eventId: string
  transferEvent: boolean
  passengerPrices: PassengerPrice[]
  [key: string]: unknown
}

/** Shorthand: call with default transferFullEvent=false, selectedVoucherId="" */
function key(
  ets: EventTransfer[],
  eventId: string,
  fullEvent = false,
  voucherId = ""
): string {
  return deriveReconcileKey(ets, eventId, fullEvent, voucherId)
}

describe("deriveReconcileKey", () => {
  it("returns a string", () => {
    expect(typeof key([], "event1")).toBe("string")
  })

  it("same selection in same order → same key", () => {
    const ets: EventTransfer[] = [
      {
        eventId: "e1",
        transferEvent: true,
        passengerPrices: [
          { passengerId: "p1", isSelected: true },
          { passengerId: "p2", isSelected: true },
        ],
      },
    ]
    expect(key(ets, "e1")).toBe(key(ets, "e1"))
  })

  it("same selection different order → same key (order-independent)", () => {
    const ets1: EventTransfer[] = [
      {
        eventId: "e1",
        transferEvent: true,
        passengerPrices: [
          { passengerId: "p1", isSelected: true },
          { passengerId: "p2", isSelected: true },
        ],
      },
    ]
    const ets2: EventTransfer[] = [
      {
        eventId: "e1",
        transferEvent: true,
        passengerPrices: [
          { passengerId: "p2", isSelected: true },
          { passengerId: "p1", isSelected: true },
        ],
      },
    ]
    expect(key(ets1, "e1")).toBe(key(ets2, "e1"))
  })

  it("different selectedEventId → different key", () => {
    const ets: EventTransfer[] = [
      {
        eventId: "e1",
        transferEvent: true,
        passengerPrices: [{ passengerId: "p1", isSelected: true }],
      },
    ]
    expect(key(ets, "e1")).not.toBe(key(ets, "e2"))
  })

  it("passenger added → different key", () => {
    const base: EventTransfer[] = [
      {
        eventId: "e1",
        transferEvent: true,
        passengerPrices: [{ passengerId: "p1", isSelected: true }],
      },
    ]
    const withExtra: EventTransfer[] = [
      {
        eventId: "e1",
        transferEvent: true,
        passengerPrices: [
          { passengerId: "p1", isSelected: true },
          { passengerId: "p2", isSelected: true },
        ],
      },
    ]
    expect(key(base, "e1")).not.toBe(key(withExtra, "e1"))
  })

  it("passenger removed → different key", () => {
    const full: EventTransfer[] = [
      {
        eventId: "e1",
        transferEvent: true,
        passengerPrices: [
          { passengerId: "p1", isSelected: true },
          { passengerId: "p2", isSelected: true },
        ],
      },
    ]
    const reduced: EventTransfer[] = [
      {
        eventId: "e1",
        transferEvent: true,
        passengerPrices: [{ passengerId: "p1", isSelected: true }],
      },
    ]
    expect(key(full, "e1")).not.toBe(key(reduced, "e1"))
  })

  it("deselecting a passenger → different key (isSelected=false excluded)", () => {
    const selected: EventTransfer[] = [
      {
        eventId: "e1",
        transferEvent: true,
        passengerPrices: [
          { passengerId: "p1", isSelected: true },
          { passengerId: "p2", isSelected: true },
        ],
      },
    ]
    const deselected: EventTransfer[] = [
      {
        eventId: "e1",
        transferEvent: true,
        passengerPrices: [
          { passengerId: "p1", isSelected: true },
          { passengerId: "p2", isSelected: false },
        ],
      },
    ]
    expect(key(selected, "e1")).not.toBe(key(deselected, "e1"))
  })

  it("scalar-only change (no ets/pax/voucher change) → same key (scalars not in key)", () => {
    // The key should only depend on eventTransfers, selectedEventId,
    // transferFullEvent, and selectedVoucherId — not on agencyId, date, etc.
    const ets: EventTransfer[] = [
      {
        eventId: "e1",
        transferEvent: true,
        passengerPrices: [{ passengerId: "p1", isSelected: true }],
      },
    ]
    const key1 = key(ets, "e1", false, "v1")
    const key2 = key(ets, "e1", false, "v1")
    expect(key1).toBe(key2)
  })

  it("non-transferEvent entries excluded from eventKey", () => {
    const withNonTransfer: EventTransfer[] = [
      {
        eventId: "e1",
        transferEvent: false, // not a transferEvent
        passengerPrices: [{ passengerId: "p1", isSelected: true }],
      },
    ]
    const empty: EventTransfer[] = []
    // Both have no transferEvent=true entries → same eventKey contribution
    const key1 = key(withNonTransfer, "e1")
    const key2 = key(empty, "e1")
    expect(key1).toBe(key2)
  })

  it("empty eventTransfers → stable key with selectedEventId", () => {
    const k = key([], "event-xyz")
    expect(k).toContain("event-xyz")
  })

  // --- CREATE regression fix: transferFullEvent and selectedVoucherId ---

  it("transferFullEvent=true → different key than transferFullEvent=false", () => {
    const ets: EventTransfer[] = [
      {
        eventId: "e1",
        transferEvent: true,
        passengerPrices: [{ passengerId: "p1", isSelected: true }],
      },
    ]
    expect(key(ets, "e1", false, "v1")).not.toBe(key(ets, "e1", true, "v1"))
  })

  it("different selectedVoucherId → different key", () => {
    const ets: EventTransfer[] = [
      {
        eventId: "e1",
        transferEvent: true,
        passengerPrices: [{ passengerId: "p1", isSelected: true }],
      },
    ]
    expect(key(ets, "e1", false, "voucher-A")).not.toBe(key(ets, "e1", false, "voucher-B"))
  })

  it("same config (transferFullEvent + voucherId) → same key (idempotent, no loop)", () => {
    const ets: EventTransfer[] = [
      {
        eventId: "e1",
        transferEvent: true,
        passengerPrices: [
          { passengerId: "p1", isSelected: true },
          { passengerId: "p2", isSelected: true },
        ],
      },
    ]
    const k1 = key(ets, "e1", true, "v1")
    const k2 = key(ets, "e1", true, "v1")
    const k3 = key(ets, "e1", true, "v1")
    expect(k1).toBe(k2)
    expect(k2).toBe(k3)
  })
})
