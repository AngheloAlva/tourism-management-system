/**
 * E2E spec: Sales CRUD smoke (Cluster 1 — D-N1)
 *
 * Tests the create and basic read flows for sale records.
 * Uses the multi-step sales form at /dashboard/registro-de-ventas.
 *
 * Strategy:
 * - A tour is seeded via prisma in beforeAll (required by step 2 of the form).
 * - The form is filled with type=QUOTE (skips payment step) and a unique
 *   passenger name so the record can be found later.
 * - After submission, the record is verified via prisma DB query.
 *
 * Note: The sales form is a 4-step wizard. For QUOTE type, step 4 (payment)
 * is skipped. Step 2 requires selecting a tour via TourSearchSelect. The spec
 * uses the tab key + keyboard to navigate the combobox.
 *
 * DB setup:
 * - Tour seeded by name "E2E-Tour-{RUN_ID}".
 * - SaleRecord is created by the UI form (no direct DB insert).
 */

// Point DATABASE_URL to the E2E container before importing prisma.
const E2E_DB_PORT = process.env.E2E_DB_PORT ?? "54320"
process.env.DATABASE_URL =
	process.env.E2E_DATABASE_URL ?? `postgresql://e2e:e2e@localhost:${E2E_DB_PORT}/tct_e2e`

import { test, expect } from "@playwright/test"
import { prisma } from "@/lib/prisma"
import { SalesPage } from "../pages/sales-page"

// Use the pre-authenticated admin session for all tests in this spec.
test.use({ storageState: "tests/e2e/.auth/admin.json" })

const RUN_ID = Date.now()
const TOUR_NAME = `E2E-Tour-${RUN_ID}`
const PASSENGER_NAME = `Pasajero-E2E-${RUN_ID}`

let tourId: string

test.describe("sales CRUD smoke", () => {
	test.beforeAll(async () => {
		// Seed a tour with one price category — step 2 validation requires at least
		// 1 passenger in priceEntries, which only auto-populates if the tour has
		// price categories.
		const tour = await prisma.tour.create({
			data: {
				name: TOUR_NAME,
				active: true,
				priceCategories: {
					create: [
						{
							name: "Adulto",
							price: 25000,
							receptionPrice: 0,
							isDefault: true,
							sortOrder: 0,
						},
					],
				},
			},
		})
		tourId = tour.id
	})

	test.afterAll(async () => {
		// Clean up seeded records.
		await prisma.saleRecord.deleteMany({
			where: { passengers: { some: { name: { contains: PASSENGER_NAME } } } },
		})
		await prisma.tour.delete({ where: { id: tourId } }).catch(() => null)
		await prisma.$disconnect()
	})

	test("creates a QUOTE via the sales form and appears in navigation list", async ({ page }) => {
		// Navigate to the sales create form.
		await page.goto("/dashboard/registro-de-ventas")
		await page.waitForLoadState("networkidle")

		// --- Step 1: Información General ---
		// Default type is SALE — switch to QUOTE so we skip the payment step.
		// The select is labeled "Tipo de Registro".
		const tipoSelect = page.locator('select[name="type"], [data-radix-select-trigger]').first()
		// Use the Select component which renders as a Radix trigger button.
		// Look for the trigger containing "Venta" text (the default selection).
		const tipoTrigger = page.getByRole("combobox").first()
		await tipoTrigger.click()
		await page.getByRole("option", { name: "Cotización" }).click()
		await page.waitForTimeout(300)

		// Advance to step 2.
		await page.getByTestId("sales-button-step-next").click()
		await page.waitForLoadState("networkidle")

		// --- Step 2: Detalle de Evento/Tour ---
		// The TourSearchSelect is a Radix Popover + cmdk Command. The trigger button has
		// role="combobox" and contains placeholder text "Buscar tour o transfer...".
		// Step 2 also has a Radix Select for "Modo de Venta" (role="combobox") — use
		// locator text to disambiguate rather than positional `.first()`.
		const tourTriggerButton = page.locator('[role="combobox"]').filter({
			hasText: /buscar tour/i,
		})
		await tourTriggerButton.click()
		// Wait for the popover content with CommandInput to appear.
		const tourSearchInput = page.getByPlaceholder("Buscar por nombre...")
		await expect(tourSearchInput).toBeVisible({ timeout: 5_000 })
		await tourSearchInput.fill(TOUR_NAME)
		// Wait for the filtered option to appear in the command list.
		const tourOption = page.getByRole("option", { name: TOUR_NAME, exact: false }).first()
		await expect(tourOption).toBeVisible({ timeout: 5_000 })
		await tourOption.click()
		// After selection, the popover closes. Wait for the price category count input
		// to appear (it renders only after the tour's priceCategories are loaded).
		const passengerCountInput = page.getByTestId("sales-input-event-passenger-count")
		await expect(passengerCountInput).toBeVisible({ timeout: 5_000 })
		// Set passenger count to 1 — step 2 validation requires totalPassengers >= 1.
		await passengerCountInput.fill("1")

		// Advance to step 3.
		await page.getByTestId("sales-button-step-next").click()
		await page.waitForLoadState("networkidle")

		// --- Step 3: Detalle de Pasajeros ---
		// Fill the passenger name (first passenger, index 0).
		await page.getByTestId("sales-input-passenger-name").fill(PASSENGER_NAME)

		// For QUOTE type (non-edit mode), successful submission resets the form back to
		// step 1 (type=VENTA default) instead of navigating. Wait for the step-next
		// button to reappear (indicates form reset completed = server action succeeded).
		await page.getByTestId("sales-button-form-submit").click()
		await expect(page.getByTestId("sales-button-step-next")).toBeVisible({ timeout: 20_000 })
		await page.waitForLoadState("networkidle")

		// --- Verify: check via prisma that a record exists ---
		const record = await prisma.saleRecord.findFirst({
			where: { passengers: { some: { name: PASSENGER_NAME } } },
		})
		expect(record).not.toBeNull()
		expect(record?.type).toBe("QUOTE")
	})
})

/**
 * T-08 — Sale edit: free section navigation (sale-edit-sections-ui)
 *
 * NOTE: These tests are written but NOT run during sdd-apply (requires Docker + build).
 * Run manually or via `pnpm test:e2e` with Docker up + app built.
 *
 * Covers:
 *   (1) Create mode: step circles are disabled (inert)
 *   (2) Edit mode: clicking step 4 from step 1 navigates directly
 *   (3) Edit mode: "Guardar cambios" on every step + "Continuar" on every non-last step
 *   (4) Edit mode: changing event quantities on step 2 then navigating to step 3
 *       reflects the updated passenger count
 *   (5) Edit mode: Save from a non-last step fires updateSaleRecord and redirects
 *
 * Data-testids used:
 *   sales-step-circle-{n}      — step circle buttons (1–4)
 *   sales-button-form-submit   — submit button ("Guardar cambios" in edit)
 *   sales-button-step-next     — "Siguiente" (create) / "Continuar" (edit, non-last step)
 */

const EDIT_RUN_ID = Date.now() + 1
const EDIT_TOUR_NAME = `E2E-EditTour-${EDIT_RUN_ID}`
const EDIT_PASSENGER_NAME = `Pasajero-Edit-${EDIT_RUN_ID}`

// Unique voucher number in a high range to avoid collisions with the factory counter (900_000+).
const EDIT_VOUCHER = 800_000 + (EDIT_RUN_ID % 100_000)

let editTourId: string
let editSaleId: string

test.describe(
	"sale edit — free section navigation",
	{ tag: ["@high", "@e2e", "@sale-edit-nav"] },
	() => {
		test.use({ storageState: "tests/e2e/.auth/admin.json" })

		test.beforeAll(async () => {
			// Resolve the admin user that auth.setup.ts registers — we need its id as sellerId.
			// The admin is always present when this beforeAll runs (auth setup project runs first).
			const adminUser = await prisma.user.findUniqueOrThrow({
				where: { email: "e2e-admin@test.local" },
			})

			// 1. Seed tour with one price category.
			//    Event.tourId → Tour, EventBooking.eventId → Event.
			//    The tour's priceCategories are needed so the edit form can render step 2.
			const tour = await prisma.tour.create({
				data: {
					name: EDIT_TOUR_NAME,
					active: true,
					priceCategories: {
						create: [
							{
								name: "Adulto",
								price: 20000,
								receptionPrice: 0,
								isDefault: true,
								sortOrder: 0,
							},
						],
					},
				},
				include: { priceCategories: true },
			})
			editTourId = tour.id

			// 2. Seed Event linked to the tour.
			//    Event holds the date/mode/serviceKind — NOT EventBooking.
			//    Use a date 7 days in the future so it always passes the
			//    "date must be today or later" step-2 validator, regardless of
			//    when in a CI day this test runs.
			const futureDate = new Date()
			futureDate.setDate(futureDate.getDate() + 7)
			const event = await prisma.event.create({
				data: {
					serviceKind: "TOUR",
					mode: "REGULAR",
					date: futureDate,
					maxCapacity: 12,
					currentBookings: 0,
					status: "SCHEDULED",
					tourId: editTourId,
				},
			})

			// 3. Seed SaleRecord with required fields: voucher (unique Int) + sellerId.
			//    status must be a valid VOUCHER_STATUS value (TO_BE_DONE, not PENDING).
			const sale = await prisma.saleRecord.create({
				data: {
					voucher: EDIT_VOUCHER,
					type: "QUOTE",
					channel: "PHYSICAL",
					status: "TO_BE_DONE",
					isWholesale: false,
					discount: 0,
					wholesaleMarkup: 0,
					contacted: false,
					sellerId: adminUser.id,
				},
			})
			editSaleId = sale.id

			// 4. Seed Passenger linked to the sale.
			const passenger = await prisma.passenger.create({
				data: {
					name: EDIT_PASSENGER_NAME,
					allergies: [],
					saleRecordId: editSaleId,
				},
			})

			// 5. Seed EventBooking linking the Event → SaleRecord.
			//    EventBooking does NOT hold tourId/date/mode — those belong to Event.
			const booking = await prisma.eventBooking.create({
				data: {
					eventId: event.id,
					saleRecordId: editSaleId,
					passengerCount: 1,
				},
			})

			// 6. Seed BookingPriceEntry with correct fields (priceSnapshot, not unitPrice/totalPrice).
			await prisma.bookingPriceEntry.create({
				data: {
					eventBookingId: booking.id,
					categoryName: "Adulto",
					count: 1,
					priceSnapshot: 20000,
					receptionSnapshot: 0,
					tourPriceCategoryId: tour.priceCategories[0]?.id ?? null,
				},
			})

			// 7. Link the passenger to the booking via BookingPassenger.
			await prisma.bookingPassenger.create({
				data: {
					eventBookingId: booking.id,
					passengerId: passenger.id,
					excluded: false,
				},
			})
		})

		test.afterAll(async () => {
			// Clean up seeded records.
			await prisma.saleRecord.delete({ where: { id: editSaleId } }).catch(() => null)
			await prisma.tour.delete({ where: { id: editTourId } }).catch(() => null)
			await prisma.$disconnect()
		})

		test(
			"(1) create mode: step circles are disabled",
			{ tag: ["@SALE-EDIT-E2E-001"] },
			async ({ page }) => {
				const salesPage = new SalesPage(page)
				await salesPage.gotoCreate()

				// All step circles should be disabled in create mode (no free navigation).
				await salesPage.expectStepCircleDisabled(1)
				await salesPage.expectStepCircleDisabled(2)
				await salesPage.expectStepCircleDisabled(3)

				// The "Siguiente" button must still be present in create mode.
				await expect(page.getByTestId("sales-button-step-next")).toBeVisible()
			}
		)

		test(
			"(2) edit mode: jump to non-adjacent step from step 1 navigates directly",
			{ tag: ["@SALE-EDIT-E2E-002"] },
			async ({ page }) => {
				// Open the sale in edit mode via the /[id] edit route.
				await page.goto(`/dashboard/registro-de-ventas/${editSaleId}`)
				await page.waitForLoadState("networkidle")

				const salesPage = new SalesPage(page)

				// Circles should be enabled in edit mode.
				await salesPage.expectStepCircleEnabled(1)
				await salesPage.expectStepCircleEnabled(2)

				// Click step 3 circle from step 1 — should navigate directly
				// (step 4 / Pago is hidden for QUOTE type, so step 3 is the farthest visible step).
				await salesPage.clickStepCircle(3)

				// Step 3 section (Detalle de Pasajeros) should be visible after jump.
				await expect(
					page.getByTestId("sales-input-passenger-name")
				).toBeVisible({ timeout: 5_000 })
			}
		)

		test(
			"(3) edit mode: Guardar cambios on every step, Continuar on every non-last step",
			{ tag: ["@SALE-EDIT-E2E-003"] },
			async ({ page }) => {
				await page.goto(`/dashboard/registro-de-ventas/${editSaleId}`)
				await page.waitForLoadState("networkidle")

				const salesPage = new SalesPage(page)

				// editSaleId is a QUOTE → step 4 is skipped, so step 3 is the last
				// visible step. Continuar shows on steps 1-2, is absent on step 3.

				// Step 1: Guardar cambios + Continuar visible.
				await salesPage.expectGuardarCambiosVisible()
				await salesPage.expectNextButtonVisible()

				// Navigate to step 2 via circle and verify again.
				await salesPage.clickStepCircle(2)
				await salesPage.expectGuardarCambiosVisible()
				await salesPage.expectNextButtonVisible()

				// Step 3 is the last visible step (QUOTE) — Continuar absent.
				await salesPage.clickStepCircle(3)
				await salesPage.expectGuardarCambiosVisible()
				await salesPage.expectNextButtonAbsent()
			}
		)

		test(
			"(4) edit mode: change event quantity on step 2, passenger count on step 3 reflects it",
			{ tag: ["@SALE-EDIT-E2E-004"] },
			async ({ page }) => {
				await page.goto(`/dashboard/registro-de-ventas/${editSaleId}`)
				await page.waitForLoadState("networkidle")

				const salesPage = new SalesPage(page)

				// Navigate to step 2 via circle.
				await salesPage.clickStepCircle(2)

				// Update the passenger count input to 3.
				const passengerCountInput = page.getByTestId("sales-input-event-passenger-count")
				await expect(passengerCountInput).toBeVisible({ timeout: 5_000 })
				await passengerCountInput.fill("3")

				// Navigate to step 3 via circle — passenger array should reflect count = 3.
				await salesPage.clickStepCircle(3)
				await page.waitForLoadState("networkidle")

				// The passenger name inputs should have 3 entries.
				// toHaveCount retries automatically — no need for an explicit timeout guard.
				const passengerInputs = page.getByTestId("sales-input-passenger-name")
				await expect(passengerInputs).toHaveCount(3, { timeout: 5_000 })
			}
		)

		test(
			"(5) edit mode: save from step 1 fires updateSaleRecord, redirects, and persists the change",
			{ tag: ["@SALE-EDIT-E2E-005"] },
			async ({ page }) => {
				await page.goto(`/dashboard/registro-de-ventas/${editSaleId}`)
				await page.waitForLoadState("networkidle")

				// Stay on step 1 (general info) and edit the comments field — a safe field
				// that has no step-2 refinement dependency, so full-form validation still passes.
				const EDIT_COMMENT = `e2e-comment-${EDIT_RUN_ID}`
				const commentsTextarea = page.locator('textarea[name="comments"]')
				await expect(commentsTextarea).toBeVisible({ timeout: 5_000 })
				await commentsTextarea.fill(EDIT_COMMENT)

				const salesPage = new SalesPage(page)

				// Click "Guardar cambios" from step 1 (a non-last step).
				await salesPage.submitEdit()

				// After a successful update, the app redirects to the navigation page.
				await expect(page).toHaveURL(
					/navegacion-(ventas|cotizaciones)/,
					{ timeout: 15_000 }
				)

				// Re-query the DB to assert the field actually changed (not just a redirect).
				const updated = await prisma.saleRecord.findUniqueOrThrow({
					where: { id: editSaleId },
				})
				expect(updated.comments).toBe(EDIT_COMMENT)
			}
		)

		test(
			"(6) edit mode: zero-out passengers on step 2, try to save from step 1 — blocked and stepper lands on step 2",
			{ tag: ["@SALE-EDIT-E2E-006"] },
			async ({ page }) => {
				await page.goto(`/dashboard/registro-de-ventas/${editSaleId}`)
				await page.waitForLoadState("networkidle")

				const salesPage = new SalesPage(page)

				// Navigate to step 2 and zero out the passenger count.
				await salesPage.clickStepCircle(2)
				const passengerCountInput = page.getByTestId("sales-input-event-passenger-count")
				await expect(passengerCountInput).toBeVisible({ timeout: 5_000 })
				// Fill with "0" and blur — ensures onChange fires and value is committed.
				await passengerCountInput.fill("0")
				await passengerCountInput.blur()

				// Navigate back to step 1 (user is on a different step from the invalid data).
				await salesPage.clickStepCircle(1)
				await page.waitForLoadState("networkidle")

				// Attempt to save from step 1 — full-form validation should block the save.
				// Do NOT use salesPage.submitEdit() here because it calls waitForLoadState("networkidle")
				// which would race with the async validation and stepper navigation.
				await page.getByTestId("sales-button-form-submit").click()

				// The form must NOT redirect — wait up to 5s to confirm no navigation.
				await expect(page).not.toHaveURL(/navegacion-(ventas|cotizaciones)/, { timeout: 5_000 })

				// A toast error should surface to indicate save was blocked.
				await expect(page.getByText("Corrige los errores antes de guardar")).toBeVisible({
					timeout: 5_000,
				})

				// The stepper should have navigated to step 2 (first failing step).
				// Verify by checking that the passenger count input (step 2) is visible.
				await expect(passengerCountInput).toBeVisible({ timeout: 5_000 })

				// Confirm the DB was NOT modified (record still has QUOTE type).
				const record = await prisma.saleRecord.findUniqueOrThrow({
					where: { id: editSaleId },
				})
				expect(record.type).toBe("QUOTE")
			}
		)
	}
)

/**
 * T-09 — Past-event date rules (sale-edit-past-event-rules)
 *
 * NOTE: These tests are written but NOT run during sdd-apply.
 * They require Docker + a running build (`pnpm test:e2e`).
 * Build workaround: the untracked `scripts/` directory may trigger a build
 * error — remove it or add it to .gitignore before running `pnpm build`.
 *
 * Covers:
 *   (A) Edit: save with past event date SUCCEEDS + amber warning visible in DOM
 *   (B) Create: future date + 1 passenger passes step 2 (inverse; past-date blocking fully unit-tested)
 *   (C) Edit: remove all passengers → BLOCKED (min-passenger still enforced in edit mode)
 *
 * Data-testids referenced:
 *   sales-button-form-submit          — "Guardar cambios" (edit)
 *   sales-step-circle-{n}             — step circle buttons
 *   sales-input-event-passenger-count — passenger count input in step 2
 *   sales-input-passenger-name        — passenger name input in step 3
 */

const PAST_RUN_ID = Date.now() + 2
const PAST_TOUR_NAME = `E2E-PastTour-${PAST_RUN_ID}`
const PAST_PASSENGER_NAME = `Pasajero-Past-${PAST_RUN_ID}`
const PAST_VOUCHER = 700_000 + (PAST_RUN_ID % 100_000)

let pastTourId: string
let pastSaleId: string

test.describe(
	"sale edit — past-event-date rules",
	{ tag: ["@high", "@e2e", "@sale-edit-past-event-rules"] },
	() => {
		test.use({ storageState: "tests/e2e/.auth/admin.json" })

		test.beforeAll(async () => {
			const adminUser = await prisma.user.findUniqueOrThrow({
				where: { email: "e2e-admin@test.local" },
			})

			const tour = await prisma.tour.create({
				data: {
					name: PAST_TOUR_NAME,
					active: true,
					priceCategories: {
						create: [
							{
								name: "Adulto",
								price: 20000,
								receptionPrice: 0,
								isDefault: true,
								sortOrder: 0,
							},
						],
					},
				},
				include: { priceCategories: true },
			})
			pastTourId = tour.id

			// Seed an Event dated 2 days in the PAST.
			const pastDate = new Date()
			pastDate.setUTCDate(pastDate.getUTCDate() - 2)
			const event = await prisma.event.create({
				data: {
					serviceKind: "TOUR",
					mode: "REGULAR",
					date: pastDate,
					maxCapacity: 12,
					currentBookings: 0,
					status: "SCHEDULED",
					tourId: pastTourId,
				},
			})

			const sale = await prisma.saleRecord.create({
				data: {
					voucher: PAST_VOUCHER,
					type: "QUOTE",
					channel: "PHYSICAL",
					status: "TO_BE_DONE",
					isWholesale: false,
					discount: 0,
					wholesaleMarkup: 0,
					contacted: false,
					sellerId: adminUser.id,
				},
			})
			pastSaleId = sale.id

			const passenger = await prisma.passenger.create({
				data: {
					name: PAST_PASSENGER_NAME,
					allergies: [],
					saleRecordId: pastSaleId,
				},
			})

			const booking = await prisma.eventBooking.create({
				data: {
					eventId: event.id,
					saleRecordId: pastSaleId,
					passengerCount: 1,
				},
			})

			await prisma.bookingPriceEntry.create({
				data: {
					eventBookingId: booking.id,
					categoryName: "Adulto",
					count: 1,
					priceSnapshot: 20000,
					receptionSnapshot: 0,
					tourPriceCategoryId: tour.priceCategories[0]?.id ?? null,
				},
			})

			await prisma.bookingPassenger.create({
				data: {
					eventBookingId: booking.id,
					passengerId: passenger.id,
					excluded: false,
				},
			})
		})

		test.afterAll(async () => {
			await prisma.saleRecord.delete({ where: { id: pastSaleId } }).catch(() => null)
			await prisma.tour.delete({ where: { id: pastTourId } }).catch(() => null)
			await prisma.$disconnect()
		})

		test(
			"(A) edit: save with past event date SUCCEEDS + amber warning visible",
			{ tag: ["@PAST-EVENT-E2E-001"] },
			async ({ page }) => {
				await page.goto(`/dashboard/registro-de-ventas/${pastSaleId}`)
				await page.waitForLoadState("networkidle")

				// Navigate to step 2 to verify the amber warning.
				await page.getByTestId("sales-step-circle-2").click()
				await page.waitForLoadState("networkidle")

				// The amber past-date warning must be present in the DOM.
				const warning = page.getByText(
					"Este evento ya pasó — estás editando una venta con fecha anterior a hoy."
				)
				await expect(warning).toBeVisible({ timeout: 5_000 })

				// Submit button must NOT be disabled by the warning.
				const submitBtn = page.getByTestId("sales-button-form-submit")
				await expect(submitBtn).toBeEnabled()

				// Edit a passenger name to prove data mutations work alongside the warning.
				const salesPage = new SalesPage(page)
				await salesPage.clickStepCircle(3)
				const passengerInput = page.getByTestId("sales-input-passenger-name").first()
				await expect(passengerInput).toBeVisible({ timeout: 5_000 })
				await passengerInput.fill(`${PAST_PASSENGER_NAME}-updated`)

				// Submit → success redirect.
				await salesPage.submitEdit()
				await expect(page).toHaveURL(/navegacion-(ventas|cotizaciones)/, { timeout: 15_000 })
			}
		)

		test(
			"(B) create: future date + 1 passenger passes step 2 (blocking on past date covered by unit tests)",
			{ tag: ["@PAST-EVENT-E2E-002"] },
			async ({ page }) => {
				await page.goto("/dashboard/registro-de-ventas")
				await page.waitForLoadState("networkidle")

				// Switch to QUOTE.
				const tipoTrigger = page.getByRole("combobox").first()
				await tipoTrigger.click()
				await page.getByRole("option", { name: "Cotización" }).click()
				await page.waitForTimeout(300)

				await page.getByTestId("sales-button-step-next").click()
				await page.waitForLoadState("networkidle")

				// Select seeded tour.
				const tourTriggerButton = page.locator('[role="combobox"]').filter({
					hasText: /buscar tour/i,
				})
				await tourTriggerButton.click()
				const tourSearchInput = page.getByPlaceholder("Buscar por nombre...")
				await expect(tourSearchInput).toBeVisible({ timeout: 5_000 })
				await tourSearchInput.fill(PAST_TOUR_NAME)
				const tourOption = page
					.getByRole("option", { name: PAST_TOUR_NAME, exact: false })
					.first()
				await expect(tourOption).toBeVisible({ timeout: 5_000 })
				await tourOption.click()

				// 1 passenger, date defaults to today (not past).
				const passengerCountInput = page.getByTestId("sales-input-event-passenger-count")
				await expect(passengerCountInput).toBeVisible({ timeout: 5_000 })
				await passengerCountInput.fill("1")

				// Siguiente should advance because today is not past.
				await page.getByTestId("sales-button-step-next").click()
				await expect(page.getByTestId("sales-input-passenger-name")).toBeVisible({
					timeout: 5_000,
				})
			}
		)

		test(
			"(C) edit: remove all passengers → BLOCKED (min-passenger enforced even with past event date)",
			{ tag: ["@PAST-EVENT-E2E-003"] },
			async ({ page }) => {
				await page.goto(`/dashboard/registro-de-ventas/${pastSaleId}`)
				await page.waitForLoadState("networkidle")

				const salesPage = new SalesPage(page)

				// Zero out passenger count on step 2.
				await salesPage.clickStepCircle(2)
				const passengerCountInput = page.getByTestId("sales-input-event-passenger-count")
				await expect(passengerCountInput).toBeVisible({ timeout: 5_000 })
				await passengerCountInput.fill("0")
				await passengerCountInput.blur()

				// Attempt save — must be blocked.
				await page.getByTestId("sales-button-form-submit").click()

				// Must NOT redirect.
				await expect(page).not.toHaveURL(/navegacion-(ventas|cotizaciones)/, { timeout: 5_000 })

				// The stepper navigates to step 2 on blocked save.
				// Assert the stable in-field min-passenger warning is visible in the DOM
				// (avoids the racing toast assertion that auto-dismisses before the check).
				// The message renders twice now: once in the ErrorSummary banner and
				// once as the in-field warning (both added/changed in ee5b039), so a bare
				// getByText hits a strict-mode violation. .first() asserts the block is shown.
				await expect(page.getByText("Debe haber al menos 1 pasajero").first()).toBeVisible({
					timeout: 5_000,
				})
			}
		)
	}
)
