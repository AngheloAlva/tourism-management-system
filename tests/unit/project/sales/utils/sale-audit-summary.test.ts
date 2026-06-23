import { describe, it, expect } from "vitest"
import {
  buildSaleAuditSnapshot,
  buildSaleAuditSnapshotFromInput,
  isSaleNoOp,
  type SaleRecordForSnapshotInput,
} from "@/project/sales/utils/sale-audit-summary"
import type { SaleRecordFormSchema } from "@/project/sales/schemas/sale-record.schema"

// Minimal record shape used across tests
function makeRecord(overrides: Partial<Parameters<typeof buildSaleAuditSnapshot>[0]> = {}) {
  return {
    type: "SALE" as const,
    channel: "PHYSICAL" as const,
    fileNumber: null,
    comments: null,
    agencyId: null,
    discount: 0,
    isWholesale: false,
    wholesaleAgencyId: null,
    passengers: [],
    paymentRecords: [],
    eventBookings: [],
    ...overrides,
  }
}

describe("buildSaleAuditSnapshot", () => {
  // ── T1a: empty arrays ─────────────────────────────────────────────────────

  it("T1a: empty arrays → all counts = 0, summary strings empty/zero-indicator", () => {
    const snap = buildSaleAuditSnapshot(makeRecord())

    expect((snap.passengers as { count: number }).count).toBe(0)
    expect((snap.paymentRecords as { count: number }).count).toBe(0)
    expect((snap.eventBookings as { count: number }).count).toBe(0)
    expect(typeof (snap.passengers as { names: string }).names).toBe("string")
    expect(typeof (snap.paymentRecords as { summary: string }).summary).toBe("string")
    expect(typeof (snap.eventBookings as { summary: string }).summary).toBe("string")
  })

  // ── T1b: null/undefined names and documents handled gracefully ────────────

  it("T1b: null name and null document → does not throw, produces a valid string", () => {
    const record = makeRecord({
      passengers: [
        {
          name: null,
          document: null,
          id: "p1",
          age: null,
          nationality: null,
          diet: null,
          dietOther: null,
          phone: null,
          email: null,
          allergies: [],
          hotels: [],
        },
      ],
    })
    expect(() => buildSaleAuditSnapshot(record)).not.toThrow()
    const snap = buildSaleAuditSnapshot(record)
    expect((snap.passengers as { count: number }).count).toBe(1)
    const names = (snap.passengers as { names: string }).names
    expect(typeof names).toBe("string")
  })

  // ── T1c: passengers count and names string ────────────────────────────────

  it("T1c: two passengers → correct count and names string with documents when present", () => {
    const record = makeRecord({
      passengers: [
        {
          name: "Juan Perez",
          document: "12.345.678-9",
          id: "p1",
          age: 30,
          nationality: "CL",
          diet: null,
          dietOther: null,
          phone: null,
          email: null,
          allergies: [],
          hotels: [],
        },
        {
          name: "Maria Lopez",
          document: null,
          id: "p2",
          age: 25,
          nationality: "AR",
          diet: null,
          dietOther: null,
          phone: null,
          email: null,
          allergies: [],
          hotels: [],
        },
      ],
    })

    const snap = buildSaleAuditSnapshot(record)
    const passengers = snap.passengers as { count: number; names: string }
    expect(passengers.count).toBe(2)
    expect(passengers.names).toContain("Juan Perez")
    expect(passengers.names).toContain("12.345.678-9")
    expect(passengers.names).toContain("Maria Lopez")
  })

  // ── T1d: eventBookings count and summary string ───────────────────────────

  it("T1d: one booking with tour name → correct count and summary includes tour name", () => {
    const record = makeRecord({
      eventBookings: [
        {
          id: "b1",
          passengerCount: 4,
          event: {
            id: "e1",
            date: new Date("2026-06-01"),
            serviceKind: "TOUR" as const,
            mode: "REGULAR" as const,
            status: "TO_BE_DONE",
            startTime: null,
            endTime: null,
            tour: {
              id: "t1",
              name: "Valle de la Luna",
              generalSummaryEs: null,
              generalSummaryEn: null,
              generalSummaryPt: null,
              scheduleEs: null,
              scheduleEn: null,
              schedulePt: null,
              includesEs: null,
              includesEn: null,
              includesPt: null,
              pickupEs: null,
              pickupEn: null,
              pickupPt: null,
              whatToBringEs: null,
              whatToBringEn: null,
              whatToBringPt: null,
              altitudeEs: null,
              altitudeEn: null,
              altitudePt: null,
            },
            transferService: null,
          },
          priceEntries: [],
          entrySnapshots: [],
          bookingPassengers: [],
        },
      ],
    })

    const snap = buildSaleAuditSnapshot(record)
    const bookings = snap.eventBookings as { count: number; summary: string }
    expect(bookings.count).toBe(1)
    expect(bookings.summary).toContain("Valle de la Luna")
  })

  // ── T1e: CLP-only payments ────────────────────────────────────────────────

  it("T1e: one CLP payment → correct count, totalClp, and summary includes method", () => {
    const record = makeRecord({
      paymentRecords: [
        {
          id: "pay1",
          refund: false,
          method: "CASH" as const,
          currency: "CLP" as const,
          amount: 50000,
          originalAmount: null,
          exchangeRate: null,
          date: new Date(),
          comments: null,
          documentNumber: null,
          voucherUrl: null,
        },
      ],
    })

    const snap = buildSaleAuditSnapshot(record)
    const payments = snap.paymentRecords as { count: number; totalClp: number; summary: string }
    expect(payments.count).toBe(1)
    expect(payments.totalClp).toBe(50000)
    expect(payments.summary).toContain("CASH")
  })

  // ── T1f: mixed USD/CLP payments → totalClp = CLP amounts only ────────────

  it("T1f: USD + CLP payments → totalClp equals the CLP amount only, summary includes both methods", () => {
    const record = makeRecord({
      paymentRecords: [
        {
          id: "pay1",
          refund: false,
          method: "TRANSFER" as const,
          currency: "CLP" as const,
          amount: 100000,
          originalAmount: null,
          exchangeRate: null,
          date: new Date(),
          comments: null,
          documentNumber: null,
          voucherUrl: null,
        },
        {
          id: "pay2",
          refund: false,
          method: "CASH" as const,
          currency: "USD" as const,
          amount: 47500, // stored CLP equivalent (50 USD * 950)
          originalAmount: 50,
          exchangeRate: 950,
          date: new Date(),
          comments: null,
          documentNumber: null,
          voucherUrl: null,
        },
      ],
    })

    const snap = buildSaleAuditSnapshot(record)
    const payments = snap.paymentRecords as { count: number; totalClp: number; summary: string }
    // Scenario H says totalClp = CLP amount only (amountClp: 100000, USD doesn't add to CLP total)
    // But re-reading the spec: "totalClp = sum of CLP only; USD amounts do NOT add to totalClp"
    // This means we sum only amount from records with currency=CLP
    expect(payments.totalClp).toBe(100000)
    expect(payments.summary).toContain("TRANSFER")
    expect(payments.summary).toContain("CASH")
  })

  // ── T1g: USD normalization parity ────────────────────────────────────────

  it("T1g: same record produces same totalClp on repeated calls (deterministic, stable key order)", () => {
    const record = makeRecord({
      paymentRecords: [
        {
          id: "pay1",
          refund: false,
          method: "CASH" as const,
          currency: "USD" as const,
          amount: 95000, // 100 USD * 950
          originalAmount: 100,
          exchangeRate: 950,
          date: new Date(),
          comments: null,
          documentNumber: null,
          voucherUrl: null,
        },
      ],
    })

    const snap1 = buildSaleAuditSnapshot(record)
    const snap2 = buildSaleAuditSnapshot(record)

    // JSON.stringify must be identical (stable key order)
    expect(JSON.stringify(snap1)).toBe(JSON.stringify(snap2))
    // The USD payment's amount (CLP-equivalent stored as `amount`) must be 0 in totalClp
    // since currency !== CLP
    expect((snap1.paymentRecords as { totalClp: number }).totalClp).toBe(0)
  })

  // ── T1i: order-independence — same set in different order → identical snapshot ─

  it("T1i: passengers in different input order produce identical snapshot string (regression guard for spurious-diff bug)", () => {
    const passengersA = [
      { name: "Carlos Ruiz", document: "AR-999" },
      { name: "Ana Torres", document: null },
    ]
    const passengersB = [
      { name: "Ana Torres", document: null },
      { name: "Carlos Ruiz", document: "AR-999" },
    ]

    const snapA = buildSaleAuditSnapshot(makeRecord({ passengers: passengersA }))
    const snapB = buildSaleAuditSnapshot(makeRecord({ passengers: passengersB }))

    const namesA = (snapA.passengers as { names: string }).names
    const namesB = (snapB.passengers as { names: string }).names
    expect(namesA).toBe(namesB)
    expect(JSON.stringify(snapA)).toBe(JSON.stringify(snapB))
  })

  it("T1i-payments: payment records in different input order produce identical snapshot string", () => {
    const paymentsA = [
      { refund: false, method: "CASH" as const, currency: "CLP" as const, amount: 80000, originalAmount: null, exchangeRate: null },
      { refund: false, method: "TRANSFER" as const, currency: "CLP" as const, amount: 40000, originalAmount: null, exchangeRate: null },
    ]
    const paymentsB = [
      { refund: false, method: "TRANSFER" as const, currency: "CLP" as const, amount: 40000, originalAmount: null, exchangeRate: null },
      { refund: false, method: "CASH" as const, currency: "CLP" as const, amount: 80000, originalAmount: null, exchangeRate: null },
    ]

    const snapA = buildSaleAuditSnapshot(makeRecord({ paymentRecords: paymentsA }))
    const snapB = buildSaleAuditSnapshot(makeRecord({ paymentRecords: paymentsB }))

    const summaryA = (snapA.paymentRecords as { summary: string }).summary
    const summaryB = (snapB.paymentRecords as { summary: string }).summary
    expect(summaryA).toBe(summaryB)
    expect(JSON.stringify(snapA)).toBe(JSON.stringify(snapB))
  })

  it("T1i-bookings: event bookings in different input order produce identical snapshot string", () => {
    const date1 = new Date("2026-06-01")
    const date2 = new Date("2026-06-15")
    const bookingsA = [
      {
        passengerCount: 2,
        event: { date: date2, serviceKind: "TOUR" as const, tour: { name: "Laguna Cejar" }, transferService: null },
      },
      {
        passengerCount: 3,
        event: { date: date1, serviceKind: "TOUR" as const, tour: { name: "Valle de la Luna" }, transferService: null },
      },
    ]
    const bookingsB = [
      {
        passengerCount: 3,
        event: { date: date1, serviceKind: "TOUR" as const, tour: { name: "Valle de la Luna" }, transferService: null },
      },
      {
        passengerCount: 2,
        event: { date: date2, serviceKind: "TOUR" as const, tour: { name: "Laguna Cejar" }, transferService: null },
      },
    ]

    const snapA = buildSaleAuditSnapshot(makeRecord({ eventBookings: bookingsA }))
    const snapB = buildSaleAuditSnapshot(makeRecord({ eventBookings: bookingsB }))

    const summaryA = (snapA.eventBookings as { summary: string }).summary
    const summaryB = (snapB.eventBookings as { summary: string }).summary
    expect(summaryA).toBe(summaryB)
    expect(JSON.stringify(snapA)).toBe(JSON.stringify(snapB))
  })

  // ── T1h: all scalar fields present in output ──────────────────────────────

  it("T1h: scalar fields type, channel, fileNumber, voucher, isWholesale, agencyId, discount, comments are present", () => {
    const record = makeRecord({
      type: "QUOTE" as const,
      channel: "ONLINE" as const,
      fileNumber: "F-001",
      comments: "Test comment",
      agencyId: "agency-123",
      discount: 10,
      isWholesale: true,
      wholesaleAgencyId: "wholesale-456",
    })

    const snap = buildSaleAuditSnapshot(record)

    expect(snap.type).toBe("QUOTE")
    expect(snap.channel).toBe("ONLINE")
    expect(snap.fileNumber).toBe("F-001")
    expect(snap.comments).toBe("Test comment")
    expect(snap.agencyId).toBe("agency-123")
    expect(snap.discount).toBe(10)
    expect(snap.isWholesale).toBe(true)
    expect(snap.wholesaleAgencyId).toBe("wholesale-456")
  })
})

// ── Helpers for isSaleNoOp / buildSaleAuditSnapshotFromInput tests ─────────────

const BASE_DATE = new Date("2026-07-01T00:00:00.000Z")

/**
 * Builds a minimal SaleRecordForSnapshotInput (the DB-side record shape).
 * passengerCount per booking should reflect the effective count (total − excluded).
 */
function makeCurrentRecord(
  overrides: Partial<SaleRecordForSnapshotInput> = {}
): SaleRecordForSnapshotInput {
  return {
    type: "SALE",
    channel: "PHYSICAL",
    fileNumber: null,
    comments: null,
    agencyId: null,
    discount: 0,
    isWholesale: false,
    wholesaleAgencyId: null,
    eventBookings: [],
    ...overrides,
  }
}

/**
 * Builds a minimal SaleRecordFormSchema payload.
 * All required fields are present; optional ones default to empty.
 */
function makeValidatedData(
  overrides: Partial<SaleRecordFormSchema> = {}
): SaleRecordFormSchema {
  return {
    type: "SALE",
    channel: "PHYSICAL",
    fileNumber: "",
    comments: "",
    agencyId: "",
    discount: undefined,
    isWholesale: false,
    wholesaleAgencyId: "",
    paymentPending: false,
    passengerArray: [],
    paymentArray: [],
    eventBookings: [],
    ...overrides,
  } as unknown as SaleRecordFormSchema
}

// ── isSaleNoOp / buildSaleAuditSnapshotFromInput ───────────────────────────────

/**
 * Builds the DB-side SaleSnapshotInput from a currentRecord (SaleRecordForSnapshotInput).
 * passengerCount values must reflect effective (DB-stored) counts.
 * passengers and paymentRecords are provided separately to keep test fixtures focused.
 */
function makeDbSnapshotInput(
  currentRecord: SaleRecordForSnapshotInput,
  opts: {
    passengers?: Parameters<typeof buildSaleAuditSnapshot>[0]["passengers"]
    paymentRecords?: Parameters<typeof buildSaleAuditSnapshot>[0]["paymentRecords"]
    priceEntriesPerBooking?: Array<Parameters<typeof buildSaleAuditSnapshot>[0]["eventBookings"][number]["priceEntries"]>
    entrySnapshotsPerBooking?: Array<Parameters<typeof buildSaleAuditSnapshot>[0]["eventBookings"][number]["entrySnapshots"]>
  } = {}
): Parameters<typeof buildSaleAuditSnapshot>[0] {
  return {
    type: currentRecord.type,
    channel: currentRecord.channel,
    fileNumber: currentRecord.fileNumber,
    comments: currentRecord.comments,
    agencyId: currentRecord.agencyId,
    discount: currentRecord.discount,
    isWholesale: currentRecord.isWholesale,
    wholesaleAgencyId: currentRecord.wholesaleAgencyId,
    passengers: opts.passengers ?? [],
    paymentRecords: opts.paymentRecords ?? [],
    eventBookings: currentRecord.eventBookings.map((eb, idx) => ({
      passengerCount: eb.passengerCount, // DB effective count
      priceEntries: opts.priceEntriesPerBooking?.[idx] ?? [],
      entrySnapshots: opts.entrySnapshotsPerBooking?.[idx] ?? [],
      event: {
        date: eb.event.date,
        serviceKind: eb.event.serviceKind,
        tour: eb.event.tour,
        transferService: eb.event.transferService,
      },
    })),
  }
}

describe("isSaleNoOp + buildSaleAuditSnapshotFromInput", () => {
  // ── W-NEW-1 guard: excluded-passenger no-op ────────────────────────────────

  it("T-NOOP-1 (W-NEW-1): identical resubmit of a sale with excluded passengers → isSaleNoOp returns true (no false-positive gate)", () => {
    /**
     * Setup: 3 passengers, 1 booking, passenger index 0 excluded.
     * DB stores passengerCount = 2 (total 3 − 1 excluded).
     * The form payload re-submits the exact same data.
     * Expected: isSaleNoOp → true (no real change, gate must NOT fire).
     */
    const tourId = "tour-id-abc"
    const passengers = [
      { name: "Ana Torres", document: "AR-001" },
      { name: "Carlos Ruiz", document: "CL-002" },
      { name: "Maria Lopez", document: "PE-003" },
    ]
    const currentRecord = makeCurrentRecord({
      eventBookings: [
        {
          passengerCount: 2, // DB effective count: 3 total − 1 excluded
          event: {
            date: BASE_DATE,
            serviceKind: "TOUR",
            tourId,
            tour: { name: "Valle de la Luna" },
            transferServiceId: null,
            transferService: null,
          },
        },
      ],
    })

    // Old snapshot built from what the DB currently holds
    const oldSnapshotInput = makeDbSnapshotInput(currentRecord, { passengers })
    const oldSnapshot = buildSaleAuditSnapshot(oldSnapshotInput)

    // Form re-submits identical data (same 3 passengers, same 1 exclusion)
    const validatedData = makeValidatedData({
      passengerArray: [
        { name: "Ana Torres", rut: "AR-001", allergies: [], hotels: [] },
        { name: "Carlos Ruiz", rut: "CL-002", allergies: [], hotels: [] },
        { name: "Maria Lopez", rut: "PE-003", allergies: [], hotels: [] },
      ] as SaleRecordFormSchema["passengerArray"],
      eventBookings: [
        {
          mode: "REGULAR",
          date: BASE_DATE,
          tourId,
          priceEntries: [],
          entrySnapshots: [],
          excludedPassengers: [{ passengerIndex: 0 }], // 1 excluded — same as DB
        },
      ] as SaleRecordFormSchema["eventBookings"],
    })

    const isNoOp = isSaleNoOp(oldSnapshot, validatedData, currentRecord)
    expect(isNoOp).toBe(true)
  })

  it("T-NOOP-2 (W-NEW-1): adding a new exclusion → isSaleNoOp returns false (real change, gate must fire)", () => {
    /**
     * DB: 3 passengers, 1 booking, no exclusions (passengerCount = 3).
     * Form payload adds an exclusion (passenger index 0 now excluded → effective = 2).
     * Expected: isSaleNoOp → false (passenger count changed from 3 to 2).
     */
    const tourId = "tour-id-abc"
    const passengers = [
      { name: "Ana Torres", document: "AR-001" },
      { name: "Carlos Ruiz", document: "CL-002" },
      { name: "Maria Lopez", document: "PE-003" },
    ]
    const currentRecord = makeCurrentRecord({
      eventBookings: [
        {
          passengerCount: 3, // DB: all 3 passengers included, no exclusions
          event: {
            date: BASE_DATE,
            serviceKind: "TOUR",
            tourId,
            tour: { name: "Valle de la Luna" },
            transferServiceId: null,
            transferService: null,
          },
        },
      ],
    })

    const oldSnapshotInput = makeDbSnapshotInput(currentRecord, { passengers })
    const oldSnapshot = buildSaleAuditSnapshot(oldSnapshotInput)

    const validatedData = makeValidatedData({
      passengerArray: [
        { name: "Ana Torres", rut: "AR-001", allergies: [], hotels: [] },
        { name: "Carlos Ruiz", rut: "CL-002", allergies: [], hotels: [] },
        { name: "Maria Lopez", rut: "PE-003", allergies: [], hotels: [] },
      ] as SaleRecordFormSchema["passengerArray"],
      eventBookings: [
        {
          mode: "REGULAR",
          date: BASE_DATE,
          tourId,
          priceEntries: [],
          entrySnapshots: [],
          excludedPassengers: [{ passengerIndex: 0 }], // NEW exclusion
        },
      ] as SaleRecordFormSchema["eventBookings"],
    })

    const isNoOp = isSaleNoOp(oldSnapshot, validatedData, currentRecord)
    expect(isNoOp).toBe(false)
  })

  it("T-NOOP-3 (W-NEW-1): removing an exclusion → isSaleNoOp returns false (passenger count changes from 2 to 3)", () => {
    const tourId = "tour-id-abc"
    const passengers = [
      { name: "Ana Torres", document: "AR-001" },
      { name: "Carlos Ruiz", document: "CL-002" },
      { name: "Maria Lopez", document: "PE-003" },
    ]
    const currentRecord = makeCurrentRecord({
      eventBookings: [
        {
          passengerCount: 2, // DB: 1 excluded, effective = 2
          event: {
            date: BASE_DATE,
            serviceKind: "TOUR",
            tourId,
            tour: { name: "Valle de la Luna" },
            transferServiceId: null,
            transferService: null,
          },
        },
      ],
    })

    const oldSnapshotInput = makeDbSnapshotInput(currentRecord, { passengers })
    const oldSnapshot = buildSaleAuditSnapshot(oldSnapshotInput)

    const validatedData = makeValidatedData({
      passengerArray: [
        { name: "Ana Torres", rut: "AR-001", allergies: [], hotels: [] },
        { name: "Carlos Ruiz", rut: "CL-002", allergies: [], hotels: [] },
        { name: "Maria Lopez", rut: "PE-003", allergies: [], hotels: [] },
      ] as SaleRecordFormSchema["passengerArray"],
      eventBookings: [
        {
          mode: "REGULAR",
          date: BASE_DATE,
          tourId,
          priceEntries: [],
          entrySnapshots: [],
          excludedPassengers: [], // exclusion removed → effective = 3
        },
      ] as SaleRecordFormSchema["eventBookings"],
    })

    const isNoOp = isSaleNoOp(oldSnapshot, validatedData, currentRecord)
    expect(isNoOp).toBe(false)
  })

  // ── USD payment normalization parity ─────────────────────────────────────────

  it("T-NOOP-4: identical USD payment (same exchange rate + amount) → isSaleNoOp returns true", () => {
    /**
     * 100 USD at exchange rate 950 → stored in DB as:
     *   amount: 95000 (CLP equivalent), originalAmount: 100, exchangeRate: 950, currency: USD
     * Form payload re-submits the same values.
     * Expected: no-op (gate must NOT fire).
     */
    const currentRecord = makeCurrentRecord({ eventBookings: [] })

    const oldSnapshotInput = makeDbSnapshotInput(currentRecord, {
      paymentRecords: [
        {
          refund: false,
          method: "TRANSFER",
          currency: "USD",
          amount: 95000, // stored CLP equivalent
          originalAmount: 100,
          exchangeRate: 950,
        },
      ],
    })
    const oldSnapshot = buildSaleAuditSnapshot(oldSnapshotInput)

    const validatedData = makeValidatedData({
      paymentArray: [
        {
          refund: false,
          method: "TRANSFER",
          currency: "USD",
          amount: 100, // same original amount in USD
          exchange_rate: 950, // same exchange rate
          movement_date: new Date(),
          document_number: "DOC-001",
        },
      ] as SaleRecordFormSchema["paymentArray"],
    })

    const isNoOp = isSaleNoOp(oldSnapshot, validatedData, currentRecord)
    expect(isNoOp).toBe(true)
  })

  it("T-NOOP-5: USD payment with different originalAmount → isSaleNoOp returns false", () => {
    const currentRecord = makeCurrentRecord({ eventBookings: [] })

    const oldSnapshotInput = makeDbSnapshotInput(currentRecord, {
      paymentRecords: [
        {
          refund: false,
          method: "TRANSFER",
          currency: "USD",
          amount: 95000,
          originalAmount: 100,
          exchangeRate: 950,
        },
      ],
    })
    const oldSnapshot = buildSaleAuditSnapshot(oldSnapshotInput)

    const validatedData = makeValidatedData({
      paymentArray: [
        {
          refund: false,
          method: "TRANSFER",
          currency: "USD",
          amount: 150, // changed from 100 to 150
          exchange_rate: 950,
          movement_date: new Date(),
          document_number: "DOC-001",
        },
      ] as SaleRecordFormSchema["paymentArray"],
    })

    const isNoOp = isSaleNoOp(oldSnapshot, validatedData, currentRecord)
    expect(isNoOp).toBe(false)
  })

  // ── priceEntries signature match/mismatch ─────────────────────────────────────

  it("T-NOOP-6: identical priceEntries → isSaleNoOp returns true", () => {
    const tourId = "tour-id-xyz"
    const passengers = [
      { name: "Ana", document: "CL-001" },
      { name: "Bob", document: "CL-002" },
    ]
    const currentRecord = makeCurrentRecord({
      eventBookings: [
        {
          passengerCount: 2,
          event: {
            date: BASE_DATE,
            serviceKind: "TOUR",
            tourId,
            tour: { name: "Laguna Cejar" },
            transferServiceId: null,
            transferService: null,
          },
        },
      ],
    })

    // DB record has priceEntries
    const oldSnapshotInput = makeDbSnapshotInput(currentRecord, {
      passengers,
      priceEntriesPerBooking: [[{ count: 2, priceSnapshot: 15000, categoryName: "Adulto" }]],
    })
    const oldSnapshot = buildSaleAuditSnapshot(oldSnapshotInput)

    const validatedData = makeValidatedData({
      passengerArray: [
        { name: "Ana", rut: "CL-001", allergies: [], hotels: [] },
        { name: "Bob", rut: "CL-002", allergies: [], hotels: [] },
      ] as SaleRecordFormSchema["passengerArray"],
      eventBookings: [
        {
          mode: "REGULAR",
          date: BASE_DATE,
          tourId,
          priceEntries: [{ count: 2, price: 15000, categoryName: "Adulto", priceCategoryId: "", reception: 0 }],
          entrySnapshots: [],
          excludedPassengers: [],
        },
      ] as SaleRecordFormSchema["eventBookings"],
    })

    const isNoOp = isSaleNoOp(oldSnapshot, validatedData, currentRecord)
    expect(isNoOp).toBe(true)
  })

  it("T-NOOP-7: priceEntries with changed price → isSaleNoOp returns false", () => {
    const tourId = "tour-id-xyz"
    const passengers = [
      { name: "Ana", document: "CL-001" },
      { name: "Bob", document: "CL-002" },
    ]
    const currentRecord = makeCurrentRecord({
      eventBookings: [
        {
          passengerCount: 2,
          event: {
            date: BASE_DATE,
            serviceKind: "TOUR",
            tourId,
            tour: { name: "Laguna Cejar" },
            transferServiceId: null,
            transferService: null,
          },
        },
      ],
    })

    const oldSnapshotInput = makeDbSnapshotInput(currentRecord, {
      passengers,
      priceEntriesPerBooking: [[{ count: 2, priceSnapshot: 15000, categoryName: "Adulto" }]],
    })
    const oldSnapshot = buildSaleAuditSnapshot(oldSnapshotInput)

    const validatedData = makeValidatedData({
      passengerArray: [
        { name: "Ana", rut: "CL-001", allergies: [], hotels: [] },
        { name: "Bob", rut: "CL-002", allergies: [], hotels: [] },
      ] as SaleRecordFormSchema["passengerArray"],
      eventBookings: [
        {
          mode: "REGULAR",
          date: BASE_DATE,
          tourId,
          priceEntries: [{ count: 2, price: 18000, categoryName: "Adulto", priceCategoryId: "", reception: 0 }], // price changed
          entrySnapshots: [],
          excludedPassengers: [],
        },
      ] as SaleRecordFormSchema["eventBookings"],
    })

    const isNoOp = isSaleNoOp(oldSnapshot, validatedData, currentRecord)
    expect(isNoOp).toBe(false)
  })

  // ── Tour-swap detection ────────────────────────────────────────────────────────

  it("T-NOOP-8: tour-swap (different tourId) → isSaleNoOp returns false (service name changes)", () => {
    const originalTourId = "tour-original"
    const newTourId = "tour-swapped"
    const passengers = [
      { name: "Ana", document: "CL-001" },
      { name: "Bob", document: "CL-002" },
    ]

    const currentRecord = makeCurrentRecord({
      eventBookings: [
        {
          passengerCount: 2,
          event: {
            date: BASE_DATE,
            serviceKind: "TOUR",
            tourId: originalTourId,
            tour: { name: "Valle de la Luna" },
            transferServiceId: null,
            transferService: null,
          },
        },
      ],
    })

    const oldSnapshotInput = makeDbSnapshotInput(currentRecord, { passengers })
    const oldSnapshot = buildSaleAuditSnapshot(oldSnapshotInput)

    const validatedData = makeValidatedData({
      passengerArray: [
        { name: "Ana", rut: "CL-001", allergies: [], hotels: [] },
        { name: "Bob", rut: "CL-002", allergies: [], hotels: [] },
      ] as SaleRecordFormSchema["passengerArray"],
      eventBookings: [
        {
          mode: "REGULAR",
          date: BASE_DATE,
          tourId: newTourId, // different tourId → falls back to tourId string as serviceName
          priceEntries: [],
          entrySnapshots: [],
          excludedPassengers: [],
        },
      ] as SaleRecordFormSchema["eventBookings"],
    })

    const isNoOp = isSaleNoOp(oldSnapshot, validatedData, currentRecord)
    expect(isNoOp).toBe(false)
  })

  // ── Passenger document change detection ──────────────────────────────────────

  it("T-NOOP-9: passenger rut/document changed → isSaleNoOp returns false", () => {
    const currentRecord = makeCurrentRecord({ eventBookings: [] })

    const oldSnapshotInput = makeDbSnapshotInput(currentRecord, {
      passengers: [
        { name: "Ana Torres", document: "AR-001" },
        { name: "Bob Cruz", document: "CL-999" },
      ],
    })
    const oldSnapshot = buildSaleAuditSnapshot(oldSnapshotInput)

    const validatedData = makeValidatedData({
      passengerArray: [
        { name: "Ana Torres", rut: "AR-001", allergies: [], hotels: [] },
        { name: "Bob Cruz", rut: "CL-CHANGED", allergies: [], hotels: [] }, // rut changed
      ] as SaleRecordFormSchema["passengerArray"],
    })

    const isNoOp = isSaleNoOp(oldSnapshot, validatedData, currentRecord)
    expect(isNoOp).toBe(false)
  })
})
