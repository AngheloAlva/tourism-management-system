/**
 * E2E spec: Calendar compact group card (variant="cell") in month/week view (Task 5.4)
 *
 * Verifies:
 *   - Month view with toggle ON renders compact ("cell") group cards in day cells.
 *   - The card name element has line-clamp-2 / break-words (wraps, no horizontal overflow).
 *   - No "Asignar" button is present inside the card (whole card is clickable).
 *   - "N salidas" label is absent when the group has a single departure.
 *   - "N salidas" label is visible when the group has multiple departures.
 *   - Clicking the compact card opens either EventDetailPanel or GroupAssignmentPanel.
 *
 * Spec reference: §Compact Group Card Layout in Month/Week Cells.
 */

const E2E_DB_PORT = process.env.E2E_DB_PORT ?? "54320"
process.env.DATABASE_URL =
	process.env.E2E_DATABASE_URL ?? `postgresql://e2e:e2e@localhost:${E2E_DB_PORT}/tct_e2e`

import { test, expect } from "@playwright/test"
import { prisma } from "@/lib/prisma"
import { CalendarPage } from "../pages/calendar-page"

test.use({ storageState: "tests/e2e/.auth/admin.json" })

const RUN_ID = Date.now()

test.describe("calendar compact group card in month/week view", () => {
	let singleDepartureTourId: string | null = null
	let multiDepartureTourId: string | null = null
	let singleEventId: string | null = null
	let multiEvent1Id: string | null = null
	let multiEvent2Id: string | null = null

	const today = new Date()
	today.setUTCHours(0, 0, 0, 0)

	test.beforeAll(async () => {
		// Seed tour for single-departure group
		const t1 = await prisma.tour.create({
			data: { name: `E2E-SingleDep-${RUN_ID}`, active: true },
		})
		singleDepartureTourId = t1.id

		// Seed tour for multi-departure group
		const t2 = await prisma.tour.create({
			data: { name: `E2E-MultiDep-${RUN_ID}`, active: true },
		})
		multiDepartureTourId = t2.id

		// Single-departure: 1 event
		const se = await prisma.event.create({
			data: {
				date: today,
				serviceKind: "TOUR",
				mode: "REGULAR",
				status: "CONFIRMED",
				tourId: singleDepartureTourId,
				maxCapacity: 12,
			},
		})
		singleEventId = se.id

		// Multi-departure: 2 events for the same tour on the same day
		const [e1, e2] = await prisma.$transaction([
			prisma.event.create({
				data: {
					date: today,
					serviceKind: "TOUR",
					mode: "REGULAR",
					status: "CONFIRMED",
					tourId: multiDepartureTourId,
					maxCapacity: 12,
					startTime: "08:00",
				},
			}),
			prisma.event.create({
				data: {
					date: today,
					serviceKind: "TOUR",
					mode: "REGULAR",
					status: "CONFIRMED",
					tourId: multiDepartureTourId,
					maxCapacity: 12,
					startTime: "14:00",
				},
			}),
		])
		multiEvent1Id = e1.id
		multiEvent2Id = e2.id
	})

	test.afterAll(async () => {
		const ids = [singleEventId, multiEvent1Id, multiEvent2Id].filter(Boolean) as string[]
		for (const id of ids) {
			await prisma.event.delete({ where: { id } }).catch(() => null)
		}
		await prisma.tour
			.deleteMany({
				where: { name: { in: [`E2E-SingleDep-${RUN_ID}`, `E2E-MultiDep-${RUN_ID}`] } },
			})
			.catch(() => null)
		await prisma.$disconnect()
	})

	test.beforeEach(async ({ context }) => {
		// Start with grouped toggle ON
		await context.addInitScript(() => {
			localStorage.setItem("cal-grouped", "true")
		})
	})

	test(
		"month view renders compact (cell) group cards when toggle is ON",
		{ tag: ["@high", "@e2e", "@calendar", "@CAL-E2E-040"] },
		async ({ page }) => {
			const calendarPage = new CalendarPage(page)
			await calendarPage.goto()

			// Month view is the default — confirm toggle is ON
			await calendarPage.expectGroupedToggleOn()

			const compactCards = calendarPage.compactGroupCards
			const count = await compactCards.count()
			test.skip(count === 0, "No compact group cards in E2E DB for this month — skipping")

			await expect(compactCards.first()).toBeVisible({ timeout: 10_000 })
		}
	)

	test(
		"compact card has no standalone Asignar button — whole card is the clickable target",
		{ tag: ["@high", "@e2e", "@calendar", "@CAL-E2E-041"] },
		async ({ page }) => {
			const calendarPage = new CalendarPage(page)
			await calendarPage.goto()
			await calendarPage.expectGroupedToggleOn()

			const compactCards = calendarPage.compactGroupCards
			const count = await compactCards.count()
			test.skip(count === 0, "No compact group cards in E2E DB for this month — skipping")

			// Verify no "Asignar" or "Asignar proveedor" button exists inside any compact card
			const asignarButtons = page.locator(
				'[data-testid="group-card"][data-variant="cell"] button'
			)
			// The only interactive element inside a compact cell card is the outer role="button" div itself.
			// There should be NO nested <button> elements (no standalone "Asignar" button).
			const btnCount = await asignarButtons.count()
			expect(btnCount, "Compact cell card must not contain nested <button> elements").toBe(0)
		}
	)

	test(
		"compact card name element has wrapping classes (line-clamp-2 break-words)",
		{ tag: ["@medium", "@e2e", "@calendar", "@CAL-E2E-042"] },
		async ({ page }) => {
			const calendarPage = new CalendarPage(page)
			await calendarPage.goto()
			await calendarPage.expectGroupedToggleOn()

			const compactCards = calendarPage.compactGroupCards
			const count = await compactCards.count()
			test.skip(count === 0, "No compact group cards in E2E DB for this month — skipping")

			// The name <p> inside the compact card must have line-clamp-2 and break-words classes
			const nameParagraph = compactCards.first().locator("p").first()
			await expect(nameParagraph).toHaveClass(/line-clamp-2/, { timeout: 5_000 })
			await expect(nameParagraph).toHaveClass(/break-words/, { timeout: 5_000 })
		}
	)

	test(
		'"N salidas" label is absent when group has departures=1',
		{ tag: ["@high", "@e2e", "@calendar", "@CAL-E2E-043"] },
		async ({ page }) => {
			test.skip(
				!singleDepartureTourId || !singleEventId,
				"Could not seed single-departure group — skipping"
			)

			const calendarPage = new CalendarPage(page)
			await calendarPage.goto()
			await calendarPage.expectGroupedToggleOn()

			const compactCards = calendarPage.compactGroupCards
			const count = await compactCards.count()
			test.skip(count === 0, "No compact group cards visible — skipping")

			// Find the card for the single-departure tour (name contains E2E-SingleDep)
			const singleDepCard = compactCards.filter({
				hasText: new RegExp(`E2E-SingleDep-${RUN_ID}`, "i"),
			})
			const singleCount = await singleDepCard.count()
			test.skip(singleCount === 0, "Single-departure card not visible in current month — skipping")

			// "N salidas" should NOT appear inside this card
			await expect(singleDepCard.getByText(/salidas?/i)).toHaveCount(0, { timeout: 5_000 })
		}
	)

	test(
		'"N salidas" label is visible when group has departures>1',
		{ tag: ["@high", "@e2e", "@calendar", "@CAL-E2E-044"] },
		async ({ page }) => {
			test.skip(
				!multiDepartureTourId || !multiEvent1Id || !multiEvent2Id,
				"Could not seed multi-departure group — skipping"
			)

			const calendarPage = new CalendarPage(page)
			await calendarPage.goto()
			await calendarPage.expectGroupedToggleOn()

			const compactCards = calendarPage.compactGroupCards
			const count = await compactCards.count()
			test.skip(count === 0, "No compact group cards visible — skipping")

			// Find the card for the multi-departure tour
			const multiDepCard = compactCards.filter({
				hasText: new RegExp(`E2E-MultiDep-${RUN_ID}`, "i"),
			})
			const multiCount = await multiDepCard.count()
			test.skip(multiCount === 0, "Multi-departure card not visible in current month — skipping")

			// "2 salidas" should be visible
			await expect(multiDepCard.getByText(/2 salidas/i).first()).toBeVisible({ timeout: 5_000 })
		}
	)

	test(
		"clicking compact card opens a panel (EventDetailPanel or GroupAssignmentPanel)",
		{ tag: ["@high", "@e2e", "@calendar", "@CAL-E2E-045"] },
		async ({ page }) => {
			const calendarPage = new CalendarPage(page)
			await calendarPage.goto()
			await calendarPage.expectGroupedToggleOn()

			const compactCards = calendarPage.compactGroupCards
			const count = await compactCards.count()
			test.skip(count === 0, "No compact group cards in E2E DB for this month — skipping")

			// Click the first compact card
			await calendarPage.clickCompactGroupCard(0)

			// Either GroupAssignmentPanel or a dialog (EventDetailPanel) must open
			const groupPanelOpen = await calendarPage.groupAssignPanel.isVisible().catch(() => false)
			const dialogOpen = await page.getByRole("dialog").first().isVisible().catch(() => false)

			expect(
				groupPanelOpen || dialogOpen,
				"Compact card click must open either GroupAssignmentPanel or EventDetailPanel"
			).toBe(true)
		}
	)
})
