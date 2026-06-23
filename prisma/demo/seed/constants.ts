/**
 * Seed constants for the Atacama Demo dataset.
 *
 * All identifiers are FICTIONAL — they must not reference "TurismoChileTours",
 * real client names, or any proprietary production data.
 *
 * These constants are also imported by unit tests (no-real-brand scan,
 * monetary reconciliation) — keep them pure data, no Prisma imports.
 */

// ─── Brand ───────────────────────────────────────────────────────────────────

export const COMPANY_BRAND = "Atacama Demo Tours"
export const DEMO_USER_EMAIL = "demo@atacama-demo.cl"
export const DEMO_USER_PASSWORD = "Demo1234!"

// ─── Cast ────────────────────────────────────────────────────────────────────

export const SELLER_NAMES = [
  "Valentina Ríos",
  "Sebastián Morales",
  "Camila Fuentes",
  "Diego Salazar",
  "Andrea Vega",
]

export const AGENCY_NAMES = [
  "Patagonia Viajes",
  "Altiplano Connect",
  "Desert Road Agency",
  "Sur Andino Tours",
  "Horizonte Turismo",
]

export const TRANSFER_AGENCY_NAMES = [
  "Noroeste Transfers",
  "Puna Express",
  "Atacama Shuttle Co.",
  "Alto Transfer",
  "Puche Movilidad",
]

export const TOUR_NAMES = [
  "Valle de la Luna",
  "Lagunas Altiplánicas",
  "Géiseres del Tatio",
  "Salar de Atacama",
  "Piedras Rojas",
  "Laguna Cejar",
  "Cañon del Diablo",
  "Quebrada de Jerez",
  "Laguna Miscanti",
  "Aldea de Tulor",
  "Pukará de Quitor",
  "Termas de Puritama",
]

// ─── Monetary scenarios (unit-testable) ──────────────────────────────────────

/** Fixed commission rate used for all bookings in the seed (10 %). */
export const COMMISSION_RATE = 0.1

/**
 * Pre-computed sale scenarios.
 *
 * For each scenario:
 *   - `saleTotal` must equal sum(payments[].amount)
 *   - `commissionAmount` must equal round(saleTotal * COMMISSION_RATE, 2)
 */
export interface SaleScenario {
  voucher: number
  saleTotal: number
  commissionAmount: number
  payments: { amount: number; method: string }[]
}

export const SALE_SCENARIOS: SaleScenario[] = [
  {
    voucher: 1001,
    saleTotal: 120000,
    commissionAmount: 12000,
    payments: [
      { amount: 70000, method: "CASH" },
      { amount: 50000, method: "TRANSFER" },
    ],
  },
  {
    voucher: 1002,
    saleTotal: 85000,
    commissionAmount: 8500,
    payments: [{ amount: 85000, method: "TRANSFER" }],
  },
  {
    voucher: 1003,
    saleTotal: 200000,
    commissionAmount: 20000,
    payments: [
      { amount: 100000, method: "TRANSFER" },
      { amount: 100000, method: "CREDIT_CARD" },
    ],
  },
  {
    voucher: 1004,
    saleTotal: 60000,
    commissionAmount: 6000,
    payments: [{ amount: 60000, method: "CASH" }],
  },
  {
    voucher: 1005,
    saleTotal: 150000,
    commissionAmount: 15000,
    payments: [
      { amount: 80000, method: "TRANSFER" },
      { amount: 70000, method: "PAYMENT_LINK_DEBIT" },
    ],
  },
  {
    voucher: 1006,
    saleTotal: 95000,
    commissionAmount: 9500,
    payments: [{ amount: 95000, method: "TRANSFER" }],
  },
  {
    voucher: 1007,
    saleTotal: 180000,
    commissionAmount: 18000,
    payments: [
      { amount: 100000, method: "CASH" },
      { amount: 80000, method: "TRANSFER" },
    ],
  },
  {
    voucher: 1008,
    saleTotal: 75000,
    commissionAmount: 7500,
    payments: [{ amount: 75000, method: "CREDIT_CARD" }],
  },
  {
    voucher: 1009,
    saleTotal: 110000,
    commissionAmount: 11000,
    payments: [
      { amount: 60000, method: "TRANSFER" },
      { amount: 50000, method: "CASH" },
    ],
  },
  {
    voucher: 1010,
    saleTotal: 240000,
    commissionAmount: 24000,
    payments: [
      { amount: 120000, method: "TRANSFER" },
      { amount: 120000, method: "TRANSFER" },
    ],
  },
]

// ─── Invoice scenarios (unit-testable) ───────────────────────────────────────

export interface InvoiceLine {
  description: string
  grossAmount: number
  discountAmount: number
  netAmount: number
}

export interface InvoiceScenario {
  number: string
  totalAmount: number
  lines: InvoiceLine[]
}

export const INVOICE_SCENARIOS: InvoiceScenario[] = [
  {
    number: "F-001",
    totalAmount: 355000,
    lines: [
      {
        description: "Valle de la Luna x3",
        grossAmount: 150000,
        discountAmount: 0,
        netAmount: 150000,
      },
      {
        description: "Lagunas Altiplánicas x2",
        grossAmount: 220000,
        discountAmount: 15000,
        netAmount: 205000,
      },
    ],
  },
  {
    number: "F-002",
    totalAmount: 180000,
    lines: [
      {
        description: "Géiseres del Tatio x2",
        grossAmount: 190000,
        discountAmount: 10000,
        netAmount: 180000,
      },
    ],
  },
  {
    number: "F-003",
    totalAmount: 420000,
    lines: [
      {
        description: "Salar de Atacama x4",
        grossAmount: 280000,
        discountAmount: 0,
        netAmount: 280000,
      },
      {
        description: "Piedras Rojas x2",
        grossAmount: 160000,
        discountAmount: 20000,
        netAmount: 140000,
      },
    ],
  },
  {
    number: "F-004",
    totalAmount: 95000,
    lines: [
      {
        description: "Laguna Cejar x1",
        grossAmount: 100000,
        discountAmount: 5000,
        netAmount: 95000,
      },
    ],
  },
  {
    number: "F-005",
    totalAmount: 310000,
    lines: [
      {
        description: "Cañon del Diablo x3",
        grossAmount: 180000,
        discountAmount: 0,
        netAmount: 180000,
      },
      {
        description: "Aldea de Tulor x2",
        grossAmount: 140000,
        discountAmount: 10000,
        netAmount: 130000,
      },
    ],
  },
]
