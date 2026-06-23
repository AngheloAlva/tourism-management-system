/**
 * E2E spec: Agency (mayoristas) CRUD smoke (Cluster 1 — D-N2)
 *
 * Tests create and edit flows for the Agency module.
 * Route: /dashboard/gestion-de-mayoristas
 *
 * Testids used:
 *   agency-button-create       — "Nuevo Mayorista" dialog trigger
 *   agency-input-name          — name field in the agency form
 *   agency-button-form-submit  — form submit button
 */

const E2E_DB_PORT = process.env.E2E_DB_PORT ?? "54320"
process.env.DATABASE_URL =
	process.env.E2E_DATABASE_URL ?? `postgresql://e2e:e2e@localhost:${E2E_DB_PORT}/tct_e2e`

import { test, expect } from "@playwright/test"
import { prisma } from "@/lib/prisma"
import { AgencyPage } from "../pages/agency-page"

test.use({ storageState: "tests/e2e/.auth/admin.json" })

const RUN_ID = Date.now()
const AGENCY_NAME = `Agencia-E2E-${RUN_ID}`
const AGENCY_NAME_UPDATED = `Agencia-E2E-Editada-${RUN_ID}`

test.describe("agency CRUD smoke", () => {
	test.afterAll(async () => {
		// Clean up created agencies.
		await prisma.agency.deleteMany({
			where: { name: { contains: `E2E-${RUN_ID}` } },
		})
		await prisma.$disconnect()
	})

	test("creates an agency and it appears in the list", async ({ page }) => {
		const agencyPage = new AgencyPage(page)

		await agencyPage.goto()

		// Open create dialog.
		await agencyPage.openCreateDialog()

		// Fill the agency name and a valid contact email (required by schema validation).
		await agencyPage.fillCreateForm({ name: AGENCY_NAME, email: `e2e-agency-${RUN_ID}@test.local` })

		// Submit the form.
		await agencyPage.submitCreate()

		// Wait for dialog to close and list to refresh.
		await page.waitForLoadState("networkidle")

		// Filter the list by the new agency name to avoid pagination issues.
		// The AgencyDataTable has a search input filtered by name.
		const searchInput = page.getByPlaceholder("Buscar por nombre...")
		await searchInput.fill(AGENCY_NAME)
		await page.waitForTimeout(500) // debounce is 400ms

		// Assert the new agency appears in the filtered list.
		await agencyPage.expectRowByName(AGENCY_NAME)

		// Verify in DB.
		const agency = await prisma.agency.findFirst({
			where: { name: AGENCY_NAME },
		})
		expect(agency).not.toBeNull()
		expect(agency?.name).toBe(AGENCY_NAME)
	})

	test("edits an existing agency name", async ({ page }) => {
		const SEED_NAME = `Agencia-E2E-Seed-${RUN_ID}`
		// Seed the agency to edit via prisma (to avoid test coupling with the create test).
		// Include a valid contact email — the agency schema requires at least one valid email
		// so the edit form can submit successfully.
		const seededAgency = await prisma.agency.create({
			data: { name: SEED_NAME, contactEmails: [`e2e-seed-${RUN_ID}@test.local`] },
		})

		const agencyPage = new AgencyPage(page)
		await agencyPage.goto()

		// Filter by the seeded agency name so it's visible even with pagination.
		const searchInput = page.getByPlaceholder("Buscar por nombre...")
		await searchInput.fill(SEED_NAME)
		await page.waitForTimeout(500) // debounce is 400ms

		// Find the agency row and open its row menu.
		await agencyPage.openRowMenu(SEED_NAME)

		// Click the edit option.
		const editItem = page.getByRole("menuitem").filter({ hasText: /editar/i }).first()
		await editItem.click()

		// Wait for the edit dialog to open and the name input to be populated with the
		// existing value before attempting to change it.
		const nameInput = page.getByTestId("agency-input-name")
		await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8_000 })
		await expect(nameInput).toHaveValue(SEED_NAME, { timeout: 8_000 })

		// Triple-click to select all, then type the new name — this avoids any React
		// controlled-input race where fill() clears the DOM value before React can
		// reconcile, causing onChange to fire with an intermediate empty string.
		await nameInput.click({ clickCount: 3 })
		await nameInput.type(AGENCY_NAME_UPDATED)
		// Verify the input DOM value matches before submitting.
		await expect(nameInput).toHaveValue(AGENCY_NAME_UPDATED, { timeout: 3_000 })
		// Blur the field so TanStack Form commits the change before submit.
		await nameInput.blur()

		// Submit and wait for the dialog to close — the dialog closes in onSuccess(),
		// which fires only after the server action completes. This ensures the DB write
		// has finished before we query.
		await page.getByTestId("agency-button-form-submit").click()
		await expect(page.getByRole("dialog")).toBeHidden({ timeout: 15_000 })
		await page.waitForLoadState("networkidle")

		// Verify in DB.
		const updated = await prisma.agency.findUnique({ where: { id: seededAgency.id } })
		expect(updated?.name).toBe(AGENCY_NAME_UPDATED)

		await prisma.agency.delete({ where: { id: seededAgency.id } }).catch(() => null)
	})
})
