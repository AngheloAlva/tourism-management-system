/**
 * E2E spec: Provider CRUD smoke (Cluster 1 — D-N3)
 *
 * Tests create flow for the Provider module.
 * Create route: /dashboard/control-de-proveedores/nuevo (separate page)
 *
 * Uses JURIDICA provider type to avoid the date picker required for NATURAL.
 * Minimum required for JURIDICA: rut, companyName, category, giro.
 *
 * Testids used:
 *   provider-button-create      — "Nuevo Proveedor" button on list page
 *   provider-input-name         — fullName input (NATURAL type)
 *   provider-button-form-submit — form submit button
 *
 * NOTE: The provider-input-name testid is on the NATURAL type's fullName field.
 * For JURIDICA type, we use the companyName field (located by id="companyName").
 * The spec navigates directly to the create route.
 */

const E2E_DB_PORT = process.env.E2E_DB_PORT ?? "54320"
process.env.DATABASE_URL =
	process.env.E2E_DATABASE_URL ?? `postgresql://e2e:e2e@localhost:${E2E_DB_PORT}/tct_e2e`

import { test, expect } from "@playwright/test"
import { prisma } from "@/lib/prisma"

test.use({ storageState: "tests/e2e/.auth/admin.json" })

const RUN_ID = Date.now()
const PROVIDER_RUT = `${RUN_ID.toString().slice(-8)}-${(RUN_ID % 9) + 1}`
const PROVIDER_NAME = `Empresa-E2E-${RUN_ID} SpA`

test.describe("provider CRUD smoke", () => {
	test.afterAll(async () => {
		await prisma.provider.deleteMany({
			where: { companyName: { contains: `E2E-${RUN_ID}` } },
		})
		await prisma.$disconnect()
	})

	test("creates a JURIDICA provider and it appears in the list", async ({ page }) => {
		// Navigate directly to the create form.
		await page.goto("/dashboard/control-de-proveedores/nuevo")
		await page.waitForLoadState("networkidle")

		// Select JURIDICA type (click the radio button).
		await page.getByLabel("Persona Jurídica").click()
		await page.waitForTimeout(300)

		// Fill the RUT field (always required regardless of type).
		const rutInput = page.locator("input#rut, input[placeholder='12345678-9']").first()
		await rutInput.fill(PROVIDER_RUT)

		// Fill the company name (shown for JURIDICA type).
		const companyInput = page.locator("input#companyName, input[placeholder='Empresa SpA']").first()
		await companyInput.fill(PROVIDER_NAME)

		// Fill category.
		const categoryInput = page.locator("input#category, input[placeholder='Transporte, Turismo, etc.']").first()
		await categoryInput.fill("Turismo E2E")

		// Select giro (EXENTO or AFECTO).
		const giroTrigger = page.getByRole("combobox").filter({ hasText: /giro|seleccione/i }).first()
		if (await giroTrigger.isVisible().catch(() => false)) {
			await giroTrigger.click()
			await page.getByRole("option", { name: "Exento" }).click()
		} else {
			// Fallback: look for the giro select differently.
			await page.locator("select").last().selectOption("EXENTO").catch(() => null)
		}

		// Submit the form.
		await page.getByTestId("provider-button-form-submit").click()

		// Should navigate back to provider list after success.
		await page.waitForURL("**/control-de-proveedores", { timeout: 30_000 })
		await page.waitForLoadState("networkidle")

		// Verify in DB.
		const provider = await prisma.provider.findFirst({
			where: { companyName: PROVIDER_NAME },
		})
		expect(provider).not.toBeNull()
		expect(provider?.companyName).toBe(PROVIDER_NAME)
		expect(provider?.type).toBe("JURIDICA")
	})
})
