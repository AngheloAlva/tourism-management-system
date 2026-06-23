/**
 * Spec: "No real brand data present"
 *
 * Scans all string constants exported by the seed constant modules and asserts
 * that no known real-brand identifier appears. This test is purely unit-scope:
 * it imports the constant arrays directly without any DB connection.
 *
 * Real-brand identifiers forbidden in seed data:
 *   - "TurismoChileTours" (company name variants)
 *   - "turismochile" (subdomain / email domain prefix)
 *   - "atacamatours.cl" (real website)
 *   - "sped.atacama" (internal legacy domain)
 */

import { describe, it, expect } from "vitest"
import {
  AGENCY_NAMES,
  TRANSFER_AGENCY_NAMES,
  TOUR_NAMES,
  DEMO_USER_EMAIL,
  SELLER_NAMES,
  COMPANY_BRAND,
} from "../../../prisma/demo/seed/constants"

const FORBIDDEN_PATTERNS = [
  /turismochile/i,
  /TurismoChileTours/i,
  /atacamatours\.cl/i,
  /sped\.atacama/i,
]

function assertNoBrand(label: string, values: string[]): void {
  for (const value of values) {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(value)) {
        throw new Error(
          `Real-brand identifier "${pattern}" found in ${label}: "${value}"`,
        )
      }
    }
  }
}

describe("Demo seed — no real-brand leak", () => {
  it("AGENCY_NAMES contains no real-brand identifiers", () => {
    expect(() => assertNoBrand("AGENCY_NAMES", AGENCY_NAMES)).not.toThrow()
  })

  it("TRANSFER_AGENCY_NAMES contains no real-brand identifiers", () => {
    expect(() =>
      assertNoBrand("TRANSFER_AGENCY_NAMES", TRANSFER_AGENCY_NAMES),
    ).not.toThrow()
  })

  it("TOUR_NAMES contains no real-brand identifiers", () => {
    expect(() => assertNoBrand("TOUR_NAMES", TOUR_NAMES)).not.toThrow()
  })

  it("DEMO_USER_EMAIL uses the fictional domain", () => {
    expect(DEMO_USER_EMAIL).toMatch(/@atacama-demo\.cl$/)
    assertNoBrand("DEMO_USER_EMAIL", [DEMO_USER_EMAIL])
  })

  it("SELLER_NAMES contains no real-brand identifiers", () => {
    expect(() => assertNoBrand("SELLER_NAMES", SELLER_NAMES)).not.toThrow()
  })

  it("COMPANY_BRAND is fictional", () => {
    expect(COMPANY_BRAND).not.toMatch(/TurismoChileTours/i)
    expect(COMPANY_BRAND.length).toBeGreaterThan(0)
  })
})
