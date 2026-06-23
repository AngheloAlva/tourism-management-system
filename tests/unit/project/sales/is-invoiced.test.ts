/**
 * Unit tests for isInvoiced() helper.
 * REQ-2: invoiced detection checks wholesaleInvoiceLine != null only;
 * does NOT inspect parent WholesaleInvoice.status.
 */

import { describe, it, expect } from "vitest"
import { isInvoiced } from "@/project/sales/server/apply-sale-update"

describe("isInvoiced", () => {
  it("returns true when wholesaleInvoiceLine is a non-null object", () => {
    const record = {
      wholesaleInvoiceLine: {
        id: "line-1",
        saleRecordId: "sale-1",
        invoiceId: "inv-1",
        amount: 1000,
      },
    }
    expect(isInvoiced(record)).toBe(true)
  })

  it("returns false when wholesaleInvoiceLine is null", () => {
    const record = { wholesaleInvoiceLine: null }
    expect(isInvoiced(record)).toBe(false)
  })

  it("returns false when wholesaleInvoiceLine is undefined", () => {
    const record = { wholesaleInvoiceLine: undefined }
    expect(isInvoiced(record)).toBe(false)
  })

  it("does NOT inspect parent invoice status — any non-null line is invoiced", () => {
    // Even with a minimal/partial object, truthy check passes
    const record = {
      wholesaleInvoiceLine: { status: "DRAFT" }, // parent invoice status irrelevant
    }
    expect(isInvoiced(record)).toBe(true)
  })
})
