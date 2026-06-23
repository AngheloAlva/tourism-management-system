/**
 * E2E spec: Tour + Event CRUD smoke (Cluster 1 — D-N4)
 *
 * Tests:
 * 1. Creates a tour via the UI form at /dashboard/tours/nuevo.
 * 2. Verifies the tour appears in the tours list.
 *
 * NOTE on event creation: Events are coupled to sale records (event bookings) in
 * this application — there is no standalone "create event" UI. Events are created
 * as part of the sales form wizard (step 2: Detalle de Evento/Tour). Standalone
 * event creation is deferred to a future spec that seeds a sale record via UI
 * and then asserts the event was created. For this PR6 smoke, only tour creation
 * is tested via UI. Event creation is verified at the DB level via the sales spec.
 *
 * Testids used:
 *   tours-button-create      — "Nuevo Tour" button on list page
 *   tour-input-name          — tour name input on create form
 *   tour-button-form-submit  — submit button on create form
 */

const E2E_DB_PORT = process.env.E2E_DB_PORT ?? "54320"
process.env.DATABASE_URL =
	process.env.E2E_DATABASE_URL ?? `postgresql://e2e:e2e@localhost:${E2E_DB_PORT}/tct_e2e`

import { test, expect } from "@playwright/test"
import { prisma } from "@/lib/prisma"
import { ToursPage } from "../pages/tours-page"

test.use({ storageState: "tests/e2e/.auth/admin.json" })

const RUN_ID = Date.now()
const TOUR_NAME = `Tour-E2E-${RUN_ID}`

test.describe("tour + event CRUD smoke", () => {
	let createdTourId: string | null = null

	test.afterAll(async () => {
		if (createdTourId) {
			await prisma.tour.delete({ where: { id: createdTourId } }).catch(() => null)
		}
		await prisma.$disconnect()
	})

	test("creates a tour via the form and it appears in the list", async ({ page }) => {
		const toursPage = new ToursPage(page)

		// Navigate to the create form directly.
		await toursPage.gotoCreate()

		// Fill the tour name (inline input at the top of the form).
		await toursPage.fillCreateForm({ name: TOUR_NAME })

		// Submit — should redirect to /dashboard/tours.
		await toursPage.submitCreate()

		// Verify the tour appears in the list.
		await toursPage.expectRowByName(TOUR_NAME)

		// Verify in DB.
		const tour = await prisma.tour.findFirst({
			where: { name: TOUR_NAME },
		})
		expect(tour).not.toBeNull()
		expect(tour?.name).toBe(TOUR_NAME)
		expect(tour?.active).toBe(true)
		createdTourId = tour?.id ?? null
	})

	test("verifies tour is accessible via its page after creation", async ({ page }) => {
		// Seed a tour to test (independent of the creation test).
		const tour = await prisma.tour.create({
			data: { name: `Tour-E2E-Nav-${RUN_ID}`, active: true },
		})

		try {
			// Navigate to the tours list and verify the tour name is visible.
			const toursPage = new ToursPage(page)
			await toursPage.goto()

			await expect(page.getByText(`Tour-E2E-Nav-${RUN_ID}`, { exact: false })).toBeVisible({
				timeout: 10_000,
			})
		} finally {
			await prisma.tour.delete({ where: { id: tour.id } }).catch(() => null)
		}
	})
})
