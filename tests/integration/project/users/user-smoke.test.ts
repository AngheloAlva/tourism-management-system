/**
 * Smoke integration test — validates the harness works end-to-end:
 *  1. User factory creates a real User row
 *  2. loginAs() forges the session mock correctly
 *  3. createSaleRecord() composes dependencies and creates a DB row
 *
 * This suite DOES NOT test application logic — it tests the test infrastructure.
 */
import { afterAll, beforeEach, describe, expect, test } from "vitest"
import { truncateAll, disconnect, prisma } from "../../helpers/db"
import { loginAs } from "../../helpers/auth"
import { createUser, createSaleRecord } from "../../helpers/factories"
import { mockGetSession } from "../../../../vitest.setup.integration"

describe("integration harness smoke tests", () => {
  beforeEach(async () => {
    await truncateAll()
  })

  afterAll(async () => {
    await disconnect()
  })

  test("T1: createUser factory inserts a real User row", async () => {
    const user = await createUser({ name: "Smoke User", role: "user" })

    const found = await prisma.user.findUnique({ where: { id: user.id } })
    expect(found).not.toBeNull()
    expect(found!.name).toBe("Smoke User")
    expect(found!.email).toBe(user.email)
  })

  test("T2: loginAs forges getSession and returns the mocked session", async () => {
    const user = await createUser({ role: "admin" })
    loginAs(user)

    const session = await mockGetSession()
    expect(session).not.toBeNull()
    expect(session!.user.id).toBe(user.id)
    expect(session!.user.role).toBe("admin")
  })

  test("T3: createSaleRecord composes dependencies and row exists in DB", async () => {
    const seller = await createUser()
    const sale = await createSaleRecord({ sellerId: seller.id })

    const found = await prisma.saleRecord.findUnique({ where: { id: sale.id } })
    expect(found).not.toBeNull()
    expect(found!.sellerId).toBe(seller.id)
    expect(found!.type).toBe("SALE")

    // Verify the seller FK is valid
    const foundSeller = await prisma.user.findUnique({
      where: { id: found!.sellerId },
    })
    expect(foundSeller).not.toBeNull()
  })
})
