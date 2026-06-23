import { describe, it, expect } from "vitest"
import { pickSellerId, normalizeSellerName } from "../../../prisma/seed/helpers"

/**
 * Seller-attribution rule (read-only pick, no DB writes):
 *   seller = Vendedor  IF Vendedor resolves to a known internal user
 *   seller = Created By IF that resolves to a known user
 *   seller = admin      otherwise
 *
 * Vendedor wins because for direct sales it is the REAL seller, even when another
 * person entered the sale (Created By). For wholesale/agency sales Vendedor holds
 * the agency name (not a user) → it falls through to Created By.
 */
describe("pickSellerId", () => {
	const ADMIN = "admin-id"
	const users = new Map<string, string>([
		[normalizeSellerName("Ronald Machuca"), "ronald-id"],
		[normalizeSellerName("Federico Solano"), "federico-id"],
		[normalizeSellerName("Grisselle Torres"), "grisselle-id"],
	])

	it("prefers Vendedor when it is a known user (sale entered on behalf of another)", () => {
		// Federico ENTERED it (Created By) but Ronald SOLD it (Vendedor).
		expect(pickSellerId(users, ADMIN, "Ronald Machuca", "Federico Solano")).toBe("ronald-id")
	})

	it("falls back to Created By when Vendedor is an agency name (wholesale)", () => {
		expect(pickSellerId(users, ADMIN, "CL Mundo", "Federico Solano")).toBe("federico-id")
	})

	it("falls back to Created By when Vendedor is blank", () => {
		expect(pickSellerId(users, ADMIN, "", "Grisselle Torres")).toBe("grisselle-id")
	})

	it("treats Vendedor='ANULADO' as non-person and falls back to Created By", () => {
		expect(pickSellerId(users, ADMIN, "ANULADO", "Ronald Machuca")).toBe("ronald-id")
	})

	it("returns admin when neither Vendedor nor Created By is a known user", () => {
		expect(pickSellerId(users, ADMIN, "CL Mundo", "Desarrollador")).toBe(ADMIN)
	})

	it("applies the Griselle->Grisselle alias on the Vendedor side", () => {
		expect(pickSellerId(users, ADMIN, "Griselle Torres", "Federico Solano")).toBe("grisselle-id")
	})
})
