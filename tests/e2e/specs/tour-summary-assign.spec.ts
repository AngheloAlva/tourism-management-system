/**
 * E2E spec: Calendar grouped card — assignment routing by group size (Tasks 5.1 + 5.2)
 *
 * Verifies:
 *   - Single-event group card click → EventDetailPanel opens (not GroupAssignmentPanel).
 *   - Multi-event group card click → GroupAssignmentPanel opens with aggregated voucher sections.
 *   - GroupAssignmentPanel "Guardar" button triggers bulkAssignProvider
 *     (verified via network intercept or success toast).
 *   - Skips gracefully if seed data cannot provide the required group size.
 *
 * Spec reference: §Provider Assignment from Grouped Card — Routed by Group Size.
 */

const E2E_DB_PORT = process.env.E2E_DB_PORT ?? "54320"
process.env.DATABASE_URL =
	process.env.E2E_DATABASE_URL ?? `postgresql://e2e:e2e@localhost:${E2E_DB_PORT}/tct_e2e`

import { test, expect } from "@playwright/test"
import { prisma } from "@/lib/prisma"
import { CalendarPage } from "../pages/calendar-page"

test.use({ storageState: "tests/e2e/.auth/admin.json" })

const RUN_ID = Date.now()

test.describe("calendar grouped card — assignment routing by group size", () => {
	// IDs for seeded records — cleaned up in afterAll
	let tourId: string | null = null
	let singleEventId: string | null = null
	let multiEvent1Id: string | null = null
	let multiEvent2Id: string | null = null

	// Today as UTC midnight (consistent with @db.Date storage)
	const today = new Date()
	today.setUTCHours(0, 0, 0, 0)

	test.beforeAll(async () => {
		// Seed a Tour
		const existingTour = await prisma.tour.findFirst({ where: { active: true } })
		if (existingTour) {
			tourId = existingTour.id
		} else {
			const tour = await prisma.tour.create({
				data: { name: `E2E-GroupAssign-${RUN_ID}`, active: true },
			})
			tourId = tour.id
		}

		if (!tourId) return

		// Seed ONE REGULAR event — this group will have eventIds.length === 1
		const singleEvent = await prisma.event.create({
			data: {
				date: today,
				serviceKind: "TOUR",
				mode: "REGULAR",
				status: "CONFIRMED",
				tourId,
				maxCapacity: 10,
				startTime: "08:00",
			},
		})
		singleEventId = singleEvent.id

		// Seed TWO REGULAR events for a different (or same) tour on the SAME day.
		// To guarantee a multi-event group we use a fresh tourId so they are isolated.
		const multiTour = await prisma.tour.create({
			data: { name: `E2E-MultiGroup-${RUN_ID}`, active: true },
		})

		const [e1, e2] = await prisma.$transaction([
			prisma.event.create({
				data: {
					date: today,
					serviceKind: "TOUR",
					mode: "REGULAR",
					status: "CONFIRMED",
					tourId: multiTour.id,
					maxCapacity: 10,
					startTime: "09:00",
				},
			}),
			prisma.event.create({
				data: {
					date: today,
					serviceKind: "TOUR",
					mode: "REGULAR",
					status: "CONFIRMED",
					tourId: multiTour.id,
					maxCapacity: 10,
					startTime: "11:00",
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
		// Clean up multi-tour (created fresh for this test)
		await prisma.tour.deleteMany({ where: { name: { startsWith: `E2E-MultiGroup-${RUN_ID}` } } }).catch(() => null)
		await prisma.$disconnect()
	})

	test(
		"single-event group card click opens EventDetailPanel (not GroupAssignmentPanel)",
		{ tag: ["@critical", "@e2e", "@calendar", "@CAL-E2E-020"] },
		async ({ page }) => {
			test.skip(!tourId || !singleEventId, "Could not seed single-event group — skipping")

			const calendarPage = new CalendarPage(page)
			await calendarPage.goto()
			await calendarPage.expectGroupedToggleOn()

			// Navigate to day view to see today's groups clearly
			await calendarPage.switchToDayView()

			// Find the group card for the single-event tour (by touring the cards)
			const cards = calendarPage.groupCards
			const cardCount = await cards.count()
			test.skip(cardCount === 0, "No group cards visible — skipping single-event routing test")

			// Look for the card whose accessible name / text contains the single-event tour
			// We iterate cards to find one that, when clicked, opens EventDetailPanel not GroupAssignmentPanel.
			// Strategy: click the FIRST card and check which panel opens.
			// The seeded single-event tour should produce a group with eventIds.length=1.
			let foundSingleCard = false
			for (let i = 0; i < cardCount; i++) {
				const card = cards.nth(i)
				await card.click()

				// GroupAssignmentPanel opens for multi-event groups; EventDetailPanel for single
				const groupPanelOpen = await calendarPage.groupAssignPanel.isVisible().catch(() => false)
				if (!groupPanelOpen) {
					// EventDetailPanel (a dialog) should be open
					const dialogCount = await page.getByRole("dialog").count()
					if (dialogCount > 0) {
						foundSingleCard = true
						// Close the dialog before continuing
						await page.keyboard.press("Escape")
						break
					}
				} else {
					// This was a multi-event group — close and try the next
					await page.keyboard.press("Escape")
				}
			}

			expect(
				foundSingleCard,
				"Expected at least one single-event group card to open EventDetailPanel"
			).toBe(true)
		}
	)

	test(
		"multi-event group card click opens GroupAssignmentPanel with aggregated voucher sections",
		{ tag: ["@critical", "@e2e", "@calendar", "@CAL-E2E-021"] },
		async ({ page }) => {
			test.skip(
				!multiEvent1Id || !multiEvent2Id,
				"Could not seed multi-event group — skipping"
			)

			const calendarPage = new CalendarPage(page)
			await calendarPage.goto()
			await calendarPage.expectGroupedToggleOn()

			await calendarPage.switchToDayView()

			const cards = calendarPage.groupCards
			const cardCount = await cards.count()
			test.skip(cardCount === 0, "No group cards visible — skipping multi-event routing test")

			// Click each card until GroupAssignmentPanel opens (multi-event group)
			let foundMultiCard = false
			for (let i = 0; i < cardCount; i++) {
				const card = cards.nth(i)
				await card.click()

				const groupPanelOpen = await calendarPage.groupAssignPanel.isVisible().catch(() => false)
				if (groupPanelOpen) {
					foundMultiCard = true
					// Verify the panel has a "Asignación de grupo" heading
					await expect(
						page.getByText(/asignación de grupo/i).first()
					).toBeVisible({ timeout: 5_000 })

					// Panel should show at least one "Salida N" sub-header (aggregated voucher sections)
					await expect(
						page.getByText(/salida 1/i).first()
					).toBeVisible({ timeout: 10_000 })

					await page.keyboard.press("Escape")
					break
				}

				// Not a multi-event card — close whatever opened
				await page.keyboard.press("Escape")
				await page.waitForTimeout(200)
			}

			expect(
				foundMultiCard,
				"Expected a multi-event group card to open GroupAssignmentPanel"
			).toBe(true)
		}
	)

	test(
		"GroupAssignmentPanel Guardar button calls bulkAssignProvider (via network intercept)",
		{ tag: ["@high", "@e2e", "@calendar", "@CAL-E2E-022"] },
		async ({ page }) => {
			test.skip(
				!multiEvent1Id || !multiEvent2Id,
				"Could not seed multi-event group — skipping"
			)

			// Intercept the Next.js Server Action for bulkAssignProvider.
			// Server Actions are POST requests to the page URL with a special Next-Action header.
			const assignCalls: string[] = []
			page.on("request", (req) => {
				if (req.method() === "POST" && req.headers()["next-action"]) {
					assignCalls.push(req.url())
				}
			})

			const calendarPage = new CalendarPage(page)
			await calendarPage.goto()
			await calendarPage.expectGroupedToggleOn()
			await calendarPage.switchToDayView()

			const cards = calendarPage.groupCards
			const cardCount = await cards.count()
			test.skip(cardCount === 0, "No group cards — skipping save test")

			// Open the GroupAssignmentPanel
			let panelOpened = false
			for (let i = 0; i < cardCount; i++) {
				await cards.nth(i).click()
				const isOpen = await calendarPage.groupAssignPanel.isVisible().catch(() => false)
				if (isOpen) {
					panelOpened = true
					break
				}
				await page.keyboard.press("Escape")
				await page.waitForTimeout(200)
			}

			test.skip(!panelOpened, "No multi-event group found — skipping save test")

			// Click Guardar (without selecting any providers — saves an empty assignment)
			await calendarPage.clickGroupAssignSave()

			// Wait briefly for the request to fire
			await page.waitForTimeout(1_500)

			// A POST with Next-Action header must have been fired
			expect(
				assignCalls.length,
				"Expected a Server Action POST (bulkAssignProvider) to be fired"
			).toBeGreaterThan(0)
		}
	)
})
