/**
 * T-12 — Complimentary passengers integration tests
 * Verifies that the complimentary/complimentaryCategory fields persist correctly
 * through the CREATE and UPDATE paths, and that existing rows are backward-compatible.
 *
 * Requires Docker (test DB). Run with: pnpm test:integration
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import {
  createSaleRecord as createSaleRecordAction,
  updateSaleRecord as updateSaleRecordAction,
} from "@/project/sales/actions/sale-record.actions"
import { mapPassengersToForm } from "@/project/sales/utils/sale-form-mappers"
import { loginAs, logout } from "../../helpers/auth"
import { truncateAll, disconnect } from "../../helpers/db"
import { createUser, createTour } from "../../helpers/factories"

/**
 * Minimal valid payload for createSaleRecord / updateSaleRecord.
 * Mirrors the proven shape from sale-record.test.ts (validSalePayload):
 * - role must be "admin" (lowercase) to pass canCurrentUserInteractPaths
 * - priceEntries carries one "Adulto" category with count === passenger count, so the
 *   passenger-overflow guard (computeTargetPassengerCount floors at 1) is satisfied for
 *   any roster size, and a complimentary passenger's "Adulto" category resolves to a real entry
 * - priceCategoryId is "" so the action maps it to null (tourPriceCategoryId is nullable);
 *   a non-existent non-null id like "cat-1" would instead trigger an FK violation
 */
function validPayload(tourId: string, passengerOverrides: Record<string, unknown>[] = [{}]) {
  return {
    type: "SALE" as const,
    channel: "PHYSICAL" as const,
    isWholesale: false,
    paymentPending: false,
    fileNumberPending: false,
    discount: 0,
    passengerArray: passengerOverrides.map((overrides, i) => ({
      name: `Passenger ${i + 1}`,
      age: 30,
      nacionality: "CL",
      allergies: [],
      hotels: [],
      complimentary: false,
      complimentaryCategory: undefined,
      ...overrides,
    })),
    paymentArray: [
      {
        refund: false,
        method: "CASH" as const,
        currency: "CLP" as const,
        amount: 50000,
        movement_date: new Date("2030-01-15"),
      },
    ],
    eventBookings: [
      {
        mode: "REGULAR" as const,
        date: new Date("2030-01-15"),
        tourId,
        startTime: "",
        endTime: "",
        priceEntries: [
          {
            priceCategoryId: "",
            categoryName: "Adulto",
            count: passengerOverrides.length,
            price: 50000,
            reception: 0,
          },
        ],
        entrySnapshots: [],
        excludedPassengers: [],
      },
    ],
  }
}

describe("complimentary passengers — integration", () => {
  let tourId: string

  beforeEach(async () => {
    await truncateAll()
    // role must be "admin" (lowercase) — matches SYSTEM_ROLE_KEY.ADMIN and the
    // factory's accepted type. "ADMIN" (uppercase) is silently ignored by the
    // factory and leaves the user without admin access, causing canCurrentUserInteractPaths to fail.
    const admin = await createUser({ role: "admin", mustChangePassword: false })
    loginAs(admin)
    const tour = await createTour()
    tourId = tour.id
  })

  afterAll(async () => {
    await logout()
    await disconnect()
  })

  it("REQ-01 backward-compat: existing passenger rows have complimentary=false, complimentaryCategory=null after migration", async () => {
    // Create a passenger without the new fields (mimics legacy data)
    const result = await createSaleRecordAction(validPayload(tourId))
    expect(result.success, JSON.stringify(result)).toBe(true)

    const passengers = await prisma.passenger.findMany({
      where: { saleRecordId: (result as { data?: { id: string } }).data?.id },
    })
    expect(passengers.length).toBeGreaterThan(0)
    for (const p of passengers) {
      expect(p.complimentary).toBe(false)
      expect(p.complimentaryCategory).toBeNull()
    }
  })

  it("REQ-03 CREATE: complimentary=true and complimentaryCategory persist correctly", async () => {
    // Two passengers: one comp with category, one without. priceEntries empty so no FK issue.
    const payload = validPayload(tourId, [
      { complimentary: true, complimentaryCategory: "Adulto" },
      { complimentary: false },
    ])
    const result = await createSaleRecordAction(payload)
    expect(result.success, JSON.stringify(result)).toBe(true)

    const passengers = await prisma.passenger.findMany({
      where: { saleRecordId: (result as { data?: { id: string } }).data?.id },
      orderBy: { id: "asc" },
    })
    expect(passengers[0].complimentary).toBe(true)
    expect(passengers[0].complimentaryCategory).toBe("Adulto")
    expect(passengers[1].complimentary).toBe(false)
    expect(passengers[1].complimentaryCategory).toBeNull()
  })

  it("REQ-03 UPDATE round-trip: load → edit comp flag → save → reload preserves values", async () => {
    // 1. Create with no comp
    const createResult = await createSaleRecordAction(validPayload(tourId))
    expect(createResult.success, JSON.stringify(createResult)).toBe(true)
    const saleId = (createResult as { data: { id: string } }).data.id

    // 2. Load and map
    const sale = await prisma.saleRecord.findUnique({
      where: { id: saleId },
      include: { passengers: { include: { hotels: true } } },
    })
    expect(sale).not.toBeNull()
    const formPassengers = mapPassengersToForm(sale!.passengers as Parameters<typeof mapPassengersToForm>[0])
    expect(formPassengers[0].complimentary).toBe(false)

    // 3. Edit comp flag and update
    const updatePayload = {
      ...validPayload(tourId, [
        { complimentary: true, complimentaryCategory: "Adulto" },
      ]),
      saleId,
    }
    const updateResult = await updateSaleRecordAction(saleId, updatePayload)
    expect(updateResult.success, JSON.stringify(updateResult)).toBe(true)

    // 4. Reload and assert
    const updated = await prisma.passenger.findFirst({
      where: { saleRecordId: saleId },
    })
    expect(updated?.complimentary).toBe(true)
    expect(updated?.complimentaryCategory).toBe("Adulto")

    // 5. Map again and assert round-trip
    const updatedPassengers = await prisma.passenger.findMany({
      where: { saleRecordId: saleId },
      include: { hotels: true },
    })
    const mappedBack = mapPassengersToForm(updatedPassengers as Parameters<typeof mapPassengersToForm>[0])
    expect(mappedBack[0].complimentary).toBe(true)
    expect(mappedBack[0].complimentaryCategory).toBe("Adulto")
  })
})
