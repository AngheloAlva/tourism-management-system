/**
 * E2E spec: sales inline-edit flows (T-G1 through T-G4)
 *
 * Tests inline-edit controls in SaleDetailSheet:
 *   T-G1: Edit fileNumber from sheet (COMPLETED sale, past booking date).
 *   T-G2: CANCELLED sale → all inline controls disabled/read-only.
 *   T-G3: Toggle contacted switch → optimistic update + success toast.
 *   T-G4: AGENCY-channel sale → agency combobox disabled.
 *
 * Strategy:
 * - Sales seeded directly via Prisma (bypasses the wizard form).
 * - Sheet opened by clicking the sale row in /dashboard/navegacion-ventas.
 * - Controls identified by data-testid set in inline-edit components.
 * - Admin session reused (tests/e2e/.auth/admin.json).
 *
 * DB setup notes:
 * - RUN_ID prefix keeps names unique across parallel/repeat runs.
 * - afterAll cleans up seeded records to avoid bleed across specs.
 */

// Point DATABASE_URL to the E2E container before importing prisma.
const E2E_DB_PORT = process.env.E2E_DB_PORT ?? "54320"
process.env.DATABASE_URL =
	process.env.E2E_DATABASE_URL ??
	`postgresql://e2e:e2e@localhost:${E2E_DB_PORT}/tct_e2e`

import { test, expect } from "@playwright/test"
import { prisma } from "@/lib/prisma"

test.use({ storageState: "tests/e2e/.auth/admin.json" })

// Voucher must be a PostgreSQL integer (max ~2.1B). Use a small range.
// The E2E DB is ephemeral so collisions across runs are not a concern.
let voucherCounter = 800_100
const nextVoucher = () => ++voucherCounter

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Seed a minimal sale and return its id + voucher. */
async function seedSale(opts: {
	channel?: "PHYSICAL" | "ONLINE" | "WHOLESALE" | "AGENCY"
	status?: "TO_BE_DONE" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
	contacted?: boolean
}) {
	// Need a seller user — use the e2e admin that was seeded during auth setup.
	const seller = await prisma.user.findFirst({
		where: { email: "e2e-admin@test.local" },
	})
	if (!seller) throw new Error("E2E admin user not found — run auth.setup first")

	const sale = await prisma.saleRecord.create({
		data: {
			voucher: nextVoucher(),
			type: "SALE",
			channel: opts.channel ?? "PHYSICAL",
			status: opts.status ?? "COMPLETED",
			operatorPaymentStatus: "UNKNOWN",
			discount: 0,
			isWholesale: false,
			wholesalePaymentTerm: "IMMEDIATE",
			wholesaleMarkup: 0,
			contacted: opts.contacted ?? false,
			sellerId: seller.id,
		},
	})
	return sale
}

/** Navigate to navegacion-ventas and open the sheet for the given sale voucher. */
async function openSheetForVoucher(page: Parameters<typeof test>[1]["page"], voucher: number) {
	await page.goto("/dashboard/navegacion-ventas")
	await page.waitForLoadState("networkidle")

	// The voucher column shows "V-{number}" or just the number — locate the row by text
	const voucherText = page.getByText(`V-${voucher}`, { exact: false }).first()
	await expect(voucherText).toBeVisible({ timeout: 15_000 })

	// Click the table row (row has cursor-pointer onClick from DataGrid)
	await voucherText.click()
	await page.waitForLoadState("networkidle")

	// Verify sheet is open by looking for "Información General" accordion
	await expect(
		page.getByText("Información General", { exact: false }).first()
	).toBeVisible({ timeout: 10_000 })
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

test.afterAll(async () => {
	// Clean up all sales seeded in this spec (voucher range 800_101 to voucherCounter)
	await prisma.saleRecord.deleteMany({
		where: { voucher: { gte: 800_101, lte: voucherCounter } },
	})
	await prisma.$disconnect()
})

// ─── T-G1: Edit fileNumber from sheet ────────────────────────────────────────

test("T-G1: edit fileNumber in SaleDetailSheet (COMPLETED sale)", async ({ page }) => {
	const sale = await seedSale({ status: "COMPLETED" })
	await openSheetForVoucher(page, sale.voucher)

	// The InlineEditableText for fileNumber has data-testid="inline-edit-text-N° de file"
	const fileNumberDisplay = page.getByTestId("inline-edit-text-N° de file")
	await expect(fileNumberDisplay).toBeVisible({ timeout: 5_000 })

	// Click to enter edit mode
	await fileNumberDisplay.click()

	// An input should appear
	const input = page.locator('[aria-label="N° de file"]')
	await expect(input).toBeVisible({ timeout: 3_000 })

	const newValue = `FN-E2E-${sale.voucher}`
	await input.fill(newValue)
	await input.press("Enter")

	// Optimistic update: the display should show the new value
	await expect(fileNumberDisplay).toContainText(newValue, { timeout: 5_000 })

	// A success toast should appear
	await expect(page.getByText("N° de file actualizado").first()).toBeVisible({ timeout: 5_000 })

	// Verify in DB
	const row = await prisma.saleRecord.findUnique({ where: { id: sale.id } })
	expect(row?.fileNumber).toBe(newValue)
})

// ─── T-G2: CANCELLED sale → all controls disabled ─────────────────────────

test("T-G2: CANCELLED sale — all inline edit controls are disabled", async ({ page }) => {
	const sale = await seedSale({ status: "CANCELLED" })
	await openSheetForVoucher(page, sale.voucher)

	// fileNumber display should be present but NOT interactive (disabled prop)
	const fileNumberDisplay = page.getByTestId("inline-edit-text-N° de file")
	await expect(fileNumberDisplay).toBeVisible({ timeout: 5_000 })

	// Clicking should NOT open an input (disabled)
	await fileNumberDisplay.click()
	const inputAfterClick = page.locator('[aria-label="N° de file"]')
	// Should NOT appear within a reasonable timeout
	await expect(inputAfterClick).not.toBeVisible({ timeout: 1_500 })

	// The contacted switch should be disabled
	const contactedSwitch = page.locator('[aria-label="Contactado"]')
	await expect(contactedSwitch).toBeVisible({ timeout: 5_000 })
	await expect(contactedSwitch).toBeDisabled({ timeout: 3_000 })
})

// ─── T-G3: Toggle contacted switch ────────────────────────────────────────

test("T-G3: toggle contacted switch — optimistic update + success toast", async ({ page }) => {
	const sale = await seedSale({ status: "COMPLETED", contacted: false })
	await openSheetForVoucher(page, sale.voucher)

	// Find the contacted switch
	const contactedSwitch = page.locator('[aria-label="Contactado"]')
	await expect(contactedSwitch).toBeVisible({ timeout: 5_000 })

	// It should be unchecked (contacted = false)
	await expect(contactedSwitch).not.toBeChecked()

	// Toggle it
	await contactedSwitch.click()

	// Optimistic: switch becomes checked immediately
	await expect(contactedSwitch).toBeChecked({ timeout: 3_000 })

	// Success toast appears
	await expect(page.getByText("Marcado como contactado").first()).toBeVisible({ timeout: 5_000 })

	// Verify in DB
	const row = await prisma.saleRecord.findUnique({ where: { id: sale.id } })
	expect(row?.contacted).toBe(true)
})

// ─── T-G4: AGENCY-channel sale → agency combobox disabled ────────────────

test("T-G4: AGENCY-channel sale — agency combobox is disabled/read-only", async ({ page }) => {
	const sale = await seedSale({ status: "COMPLETED", channel: "AGENCY" })
	await openSheetForVoucher(page, sale.voucher)

	// The InlineEditableAgency renders a disabled span when resolveAgencyTargetColumn returns null
	// It uses data-testid="inline-edit-agency"
	const agencyDisplay = page.getByTestId("inline-edit-agency")
	await expect(agencyDisplay).toBeVisible({ timeout: 5_000 })

	// The agency combobox Button should NOT be present (disabled path renders a span, not a button)
	const agencyButton = agencyDisplay.locator('button[role="combobox"]')
	await expect(agencyButton).not.toBeVisible({ timeout: 2_000 })
})
