/**
 * E2E spec: Reception + Transfer CRUD smoke (Cluster 1 — D-N5)
 *
 * Tests navigation and basic visibility for receptions and transfers.
 *
 * DEVIATION FROM DESIGN: Full UI form creation for receptions and transfers
 * requires:
 * 1. An AgencyTransfer record connected to a sale record event.
 * 2. Complex multi-step forms with TransferAgency combobox selectors.
 * These forms are tightly coupled to existing sale record data.
 *
 * Strategy for this PR6 smoke: seed records via prisma and verify they appear
 * in the list pages. This validates that the list/navigation pages render
 * correctly with auth, which is the primary E2E risk for these modules.
 *
 * The form submission path (creation via UI) is already covered by integration
 * tests in tests/integration/project/receptions/ and tests/integration/project/transfers/.
 *
 * Testids added to form submit buttons are available for PR7/PR8 specs that
 * may build on this scaffold.
 */

const E2E_DB_PORT = process.env.E2E_DB_PORT ?? "54320"
process.env.DATABASE_URL =
	process.env.E2E_DATABASE_URL ?? `postgresql://e2e:e2e@localhost:${E2E_DB_PORT}/tct_e2e`

import { test, expect } from "@playwright/test"
import { prisma } from "@/lib/prisma"

test.use({ storageState: "tests/e2e/.auth/admin.json" })

const RUN_ID = Date.now()

test.describe("reception + transfer navigation smoke", () => {
	let adminUserId: string
	let transferAgencyId: string
	let receptionId: string
	let transferId: string

	test.beforeAll(async () => {
		// Find the seeded admin user from auth.setup.ts.
		const admin = await prisma.user.findFirstOrThrow({
			where: { email: "e2e-admin@test.local" },
		})
		adminUserId = admin.id

		// Create a TransferAgency for the seeded records.
		const agency = await prisma.transferAgency.create({
			data: {
				name: `AgenciaTransfer-E2E-${RUN_ID}`,
			},
		})
		transferAgencyId = agency.id

		// Create a reception (AgencyTransfer with type INCOMING).
		// Requires a sequential voucher — use a high number to avoid conflicts.
		const receptionVoucher = Math.floor(Date.now() % 1_000_000) + 900_000
		const reception = await prisma.agencyTransfer.create({
			data: {
				voucher: receptionVoucher,
				type: "INCOMING",
				paymentStatus: "PENDING",
				agencyId: transferAgencyId,
				createdBy: adminUserId,
			},
		})
		receptionId = reception.id

		// Create a transfer (AgencyTransfer with type OUTGOING).
		const transferVoucher = receptionVoucher + 1
		const transfer = await prisma.agencyTransfer.create({
			data: {
				voucher: transferVoucher,
				type: "OUTGOING",
				paymentStatus: "PENDING",
				agencyId: transferAgencyId,
				createdBy: adminUserId,
			},
		})
		transferId = transfer.id
	})

	test.afterAll(async () => {
		await prisma.agencyTransfer.deleteMany({ where: { agencyId: transferAgencyId } })
		await prisma.transferAgency.delete({ where: { id: transferAgencyId } }).catch(() => null)
		await prisma.$disconnect()
	})

	test("reception list page loads and shows seeded reception", async ({ page }) => {
		await page.goto("/dashboard/navegacion-recepciones")
		await page.waitForLoadState("networkidle")

		// The page should load without error.
		await expect(page.getByText("Navegación de Recepciones")).toBeVisible({ timeout: 10_000 })

		// The seeded agency name should appear in the table.
		await expect(
			page.getByText(`AgenciaTransfer-E2E-${RUN_ID}`, { exact: false })
		).toBeVisible({ timeout: 10_000 })
	})

	test("transfer list page loads and shows seeded transfer", async ({ page }) => {
		await page.goto("/dashboard/navegacion-traspasos")
		await page.waitForLoadState("networkidle")

		// The page should load without error — use the h1 heading to avoid strict-mode
		// violations caused by "Traspasos" appearing in sidebar links, breadcrumbs, and
		// tutorial buttons.
		await expect(
			page.getByRole("heading", { name: /Navegacion de Traspasos/i })
		).toBeVisible({ timeout: 10_000 })

		// The seeded agency name should appear in the table.
		await expect(
			page.getByText(`AgenciaTransfer-E2E-${RUN_ID}`, { exact: false })
		).toBeVisible({ timeout: 10_000 })
	})

	test("reception create form page is accessible and renders form", async ({ page }) => {
		await page.goto("/dashboard/recepcion")
		await page.waitForLoadState("networkidle")

		// Use the h1 heading to avoid strict-mode violations — "Recepción" appears in
		// the sidebar navigation as well.
		await expect(
			page.getByRole("heading", { name: /Recepción/i, level: 1 })
		).toBeVisible({ timeout: 10_000 })
		// The reception form is a multi-step wizard — the submit button is only rendered
		// on the last step. Assert the "Siguiente" step button is visible on step 1,
		// confirming the form has rendered correctly.
		await expect(
			page.getByRole("button", { name: /siguiente/i })
		).toBeVisible({ timeout: 10_000 })
	})

	test("transfer create form page is accessible and renders form", async ({ page }) => {
		await page.goto("/dashboard/traspasos")
		await page.waitForLoadState("networkidle")

		// Use the h1 heading to avoid strict-mode violations — "Traspasos" appears in
		// sidebar links, breadcrumbs, and the tutorial button label.
		await expect(
			page.getByRole("heading", { name: /^Traspasos$/i, level: 1 })
		).toBeVisible({ timeout: 10_000 })
		// The submit button should be present (even if disabled without data).
		await expect(page.getByTestId("transfers-button-form-submit")).toBeVisible({
			timeout: 10_000,
		})
	})
})
