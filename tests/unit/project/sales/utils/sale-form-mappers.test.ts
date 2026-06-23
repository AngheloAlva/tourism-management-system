import { describe, expect, test } from "vitest"
import { mapPassengersToForm } from "@/project/sales/utils/sale-form-mappers"

// Minimal stub of PassengerWithHotels type (the real type is derived from
// SaleRecordWithDetails which requires importing the full actions module).
// We cast to any to keep the test dependency surface thin.
const makeDbPassenger = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "pass-1",
    name: "Test Passenger",
    document: "12345678",
    age: 30,
    nationality: "1",
    diet: "NORMAL",
    allergies: [],
    phone: "+56912345678",
    email: "test@example.com",
    complimentary: false,
    complimentaryCategory: null,
    hotels: [],
    ...overrides,
  }) as any

// T-11c: mapPassengersToForm round-trip for complimentary fields

describe("mapPassengersToForm — complimentary fields", () => {
  test("complimentary=true and complimentaryCategory='Adulto' survives DB→form mapping", () => {
    const result = mapPassengersToForm([
      makeDbPassenger({ complimentary: true, complimentaryCategory: "Adulto" }),
    ])
    expect(result[0].complimentary).toBe(true)
    expect(result[0].complimentaryCategory).toBe("Adulto")
  })

  test("complimentary=false maps to false; complimentaryCategory maps to empty string", () => {
    const result = mapPassengersToForm([makeDbPassenger({ complimentary: false, complimentaryCategory: null })])
    expect(result[0].complimentary).toBe(false)
    expect(result[0].complimentaryCategory).toBe("")
  })

  test("complimentaryCategory=null (DB) maps to empty string (form)", () => {
    const result = mapPassengersToForm([makeDbPassenger({ complimentaryCategory: null })])
    expect(result[0].complimentaryCategory).toBe("")
  })

  test("complimentaryCategory=undefined (DB) maps to empty string (form)", () => {
    const result = mapPassengersToForm([makeDbPassenger({ complimentaryCategory: undefined })])
    expect(result[0].complimentaryCategory).toBe("")
  })
})
