/**
 * S1-T1 RED: Unit tests for prepareTransferUpdate pure logic.
 * No DB, no I/O — validates deduplication, already-transferred conflict, and
 * event-booking count aggregation.
 *
 * These tests will FAIL until apply-transfer-update.ts is implemented.
 */

import { describe, it, expect, vi } from "vitest"
import type { PreparedTransferUpdate } from "@/project/transfers/server/apply-transfer-update"

// We import the non-DB pure helpers only. The db-hitting prepareTransferUpdate
// is tested in integration; here we test helpers it delegates to.
import {
  dedupePassengerPrices,
  buildEventBookings,
  checkAlreadyTransferred,
} from "@/project/transfers/server/apply-transfer-update"

// ── dedupePassengerPrices ─────────────────────────────────────────────────────

describe("dedupePassengerPrices", () => {
  it("returns unique passengers by passengerId", () => {
    const prices = [
      {
        passengerId: "p1",
        passengerName: "Ana",
        ageCategory: "adult",
        tourPrice: 100,
        entrancePrice: 50,
        totalPrice: 150,
        isSelected: true,
        isAlreadyTransferred: false,
        sourceSaleRecordId: "s1",
      },
      {
        passengerId: "p1",
        passengerName: "Ana (dup)",
        ageCategory: "adult",
        tourPrice: 100,
        entrancePrice: 50,
        totalPrice: 150,
        isSelected: true,
        isAlreadyTransferred: false,
        sourceSaleRecordId: "s1",
      },
      {
        passengerId: "p2",
        passengerName: "Bob",
        ageCategory: "child",
        tourPrice: 80,
        entrancePrice: 40,
        totalPrice: 120,
        isSelected: true,
        isAlreadyTransferred: false,
        sourceSaleRecordId: "s1",
      },
    ]

    const result = dedupePassengerPrices(prices)
    expect(result).toHaveLength(2)
    expect(result.map((p) => p.passengerId)).toEqual(["p1", "p2"])
    // First occurrence wins
    expect(result[0].passengerName).toBe("Ana")
  })

  it("returns empty array for empty input", () => {
    expect(dedupePassengerPrices([])).toEqual([])
  })
})

// ── buildEventBookings ────────────────────────────────────────────────────────

describe("buildEventBookings", () => {
  const basePassenger = (
    id: string,
    category: "adult" | "child" | "senior",
    eventId: string
  ) => ({
    passengerId: id,
    passengerName: `Passenger ${id}`,
    ageCategory: category,
    tourPrice: 100,
    entrancePrice: 50,
    totalPrice: 150,
    isSelected: true,
    isAlreadyTransferred: false,
    sourceSaleRecordId: "s1",
    _eventId: eventId,
  })

  it("aggregates counts correctly for a single event", () => {
    const passengersByEvent = [
      {
        eventId: "e1",
        passengerPrices: [
          { ...basePassenger("p1", "adult", "e1") },
          { ...basePassenger("p2", "adult", "e1") },
          { ...basePassenger("p3", "child", "e1") },
          { ...basePassenger("p4", "senior", "e1") },
        ],
      },
    ]

    const result = buildEventBookings(passengersByEvent, new Set())
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      eventId: "e1",
      passengerCount: 4,
      adultsCount: 2,
      childrenCount: 1,
      seniorsCount: 1,
    })
  })

  it("excludes already-transferred passengers from counts", () => {
    const passengersByEvent = [
      {
        eventId: "e1",
        passengerPrices: [
          { ...basePassenger("p1", "adult", "e1") },
          { ...basePassenger("p2", "adult", "e1") },
        ],
      },
    ]
    const alreadyTransferred = new Set(["p1"])

    const result = buildEventBookings(passengersByEvent, alreadyTransferred)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      passengerCount: 1,
      adultsCount: 1,
    })
  })

  it("omits event entirely when all passengers are already transferred", () => {
    const passengersByEvent = [
      {
        eventId: "e1",
        passengerPrices: [
          { ...basePassenger("p1", "adult", "e1") },
        ],
      },
    ]
    const alreadyTransferred = new Set(["p1"])

    const result = buildEventBookings(passengersByEvent, alreadyTransferred)
    expect(result).toHaveLength(0)
  })

  it("handles multiple events independently", () => {
    const passengersByEvent = [
      {
        eventId: "e1",
        passengerPrices: [
          { ...basePassenger("p1", "adult", "e1") },
        ],
      },
      {
        eventId: "e2",
        passengerPrices: [
          { ...basePassenger("p2", "child", "e2") },
          { ...basePassenger("p3", "senior", "e2") },
        ],
      },
    ]

    const result = buildEventBookings(passengersByEvent, new Set())
    expect(result).toHaveLength(2)
    expect(result.find((b) => b.eventId === "e1")?.passengerCount).toBe(1)
    expect(result.find((b) => b.eventId === "e2")?.passengerCount).toBe(2)
  })
})

// ── checkAlreadyTransferred ───────────────────────────────────────────────────

describe("checkAlreadyTransferred", () => {
  it("returns names of passengers in alreadyTransferredIds set", () => {
    const passengers = [
      {
        passengerId: "p1",
        passengerName: "Ana",
        ageCategory: "adult",
        tourPrice: 100,
        entrancePrice: 50,
        totalPrice: 150,
        isSelected: true,
        isAlreadyTransferred: false,
        sourceSaleRecordId: "s1",
      },
      {
        passengerId: "p2",
        passengerName: "Bob",
        ageCategory: "adult",
        tourPrice: 100,
        entrancePrice: 50,
        totalPrice: 150,
        isSelected: true,
        isAlreadyTransferred: false,
        sourceSaleRecordId: "s1",
      },
    ]

    const result = checkAlreadyTransferred(passengers, new Set(["p1"]))
    expect(result).toEqual(["Ana"])
  })

  it("returns empty array when no conflicts", () => {
    const passengers = [
      {
        passengerId: "p1",
        passengerName: "Ana",
        ageCategory: "adult",
        tourPrice: 100,
        entrancePrice: 50,
        totalPrice: 150,
        isSelected: true,
        isAlreadyTransferred: false,
        sourceSaleRecordId: "s1",
      },
    ]

    const result = checkAlreadyTransferred(passengers, new Set())
    expect(result).toEqual([])
  })

  it("caps result at 5 names", () => {
    const passengers = Array.from({ length: 10 }, (_, i) => ({
      passengerId: `p${i}`,
      passengerName: `Passenger ${i}`,
      ageCategory: "adult",
      tourPrice: 100,
      entrancePrice: 50,
      totalPrice: 150,
      isSelected: true,
      isAlreadyTransferred: false,
      sourceSaleRecordId: "s1",
    }))

    const alreadyTransferred = new Set(passengers.map((p) => p.passengerId))
    const result = checkAlreadyTransferred(passengers, alreadyTransferred)
    expect(result.length).toBeLessThanOrEqual(5)
  })
})
