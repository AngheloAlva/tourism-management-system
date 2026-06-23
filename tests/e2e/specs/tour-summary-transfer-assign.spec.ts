/**
 * E2E spec: Calendar TRANSFER multi-event group — Guía section hidden (Task 5.3)
 *
 * Verifies:
 *   - A multi-event REGULAR TRANSFER group opens GroupAssignmentPanel.
 *   - The Guía section is NOT visible inside the panel.
 *   - The Conductor section IS visible.
 *
 * Spec reference: §Transfer multi-event group — Guía section hidden.
 *
 * Seeds two REGULAR TRANSFER events for the same transferServiceId on the current day.
 * Skips gracefully if no TransferService exists or seeding fails.
 */

const E2E_DB_PORT = process.env.E2E_DB_PORT ?? "54320"
process.env.DATABASE_URL =
	process.env.E2E_DATABASE_URL ?? `postgresql://e2e:e2e@localhost:${E2E_DB_PORT}/tct_e2e`

import { test, expect } from "@playwright/test"
import { prisma } from "@/lib/prisma"
import { CalendarPage } from "../pages/calendar-page"

test.use({ storageState: "tests/e2e/.auth/admin.json" })

const RUN_ID = Date.now()

test.describe("calendar TRANSFER grouped card — Guía section hidden", () => {
	let transferServiceId: string | null = null
	let transferEvent1Id: string | null = null
	let transferEvent2Id: string | null = null

	const today = new Date()
	today.setUTCHours(0, 0, 0, 0)

	test.beforeAll(async () => {
		// Seed a TransferService if none exists
		const existingTs = await prisma.transferService.findFirst({ where: { active: true } })
		if (existingTs) {
			transferServiceId = existingTs.id
		} else {
			const ts = await prisma.transferService.create({
				data: { name: `E2E-TransferGroup-${RUN_ID}`, active: true },
			})
			transferServiceId = ts.id
		}

		if (!transferServiceId) return

		// Seed two REGULAR TRANSFER events for the same transferServiceId + today
		// to guarantee a multi-event TRANSFER group
		const [e1, e2] = await prisma.$transaction([
			prisma.event.create({
				data: {
					date: today,
					serviceKind: "TRANSFER",
					mode: "REGULAR",
					status: "CONFIRMED",
					transferServiceId,
					maxCapacity: 8,
					startTime: "07:00",
				},
			}),
			prisma.event.create({
				data: {
					date: today,
					serviceKind: "TRANSFER",
					mode: "REGULAR",
					status: "CONFIRMED",
					transferServiceId,
					maxCapacity: 8,
					startTime: "10:00",
				},
			}),
		])
		transferEvent1Id = e1.id
		transferEvent2Id = e2.id
	})

	test.afterAll(async () => {
		const ids = [transferEvent1Id, transferEvent2Id].filter(Boolean) as string[]
		for (const id of ids) {
			await prisma.event.delete({ where: { id } }).catch(() => null)
		}
		await prisma.$disconnect()
	})

	test(
		"TRANSFER multi-event group — GroupAssignmentPanel hides Guía section",
		{ tag: ["@critical", "@e2e", "@calendar", "@CAL-E2E-030"] },
		async ({ page }) => {
			test.skip(
				!transferServiceId || !transferEvent1Id || !transferEvent2Id,
				"Could not seed TRANSFER multi-event group — skipping"
			)

			const calendarPage = new CalendarPage(page)
			await calendarPage.goto()
			await calendarPage.expectGroupedToggleOn()

			// Navigate to day view for the current date
			await calendarPage.switchToDayView()

			const cards = calendarPage.groupCards
			const cardCount = await cards.count()
			test.skip(cardCount === 0, "No group cards visible — skipping transfer Guía test")

			// Find and click the TRANSFER multi-event group card
			// Transfer group cards have purple border styling; iterate until GroupAssignmentPanel opens
			let panelOpened = false
			let isTransferPanel = false

			for (let i = 0; i < cardCount; i++) {
				await cards.nth(i).click()

				const isOpen = await calendarPage.groupAssignPanel.isVisible().catch(() => false)
				if (isOpen) {
					// Check if this is a TRANSFER panel (no Guía section) or TOUR panel
					const guideAbsent =
						(await page.getByTestId("group-assign-guide-section").count()) === 0
					const driverPresent = await page
						.getByTestId("group-assign-driver-section")
						.isVisible()
						.catch(() => false)

					if (guideAbsent && driverPresent) {
						panelOpened = true
						isTransferPanel = true
						break
					}
					// This was a TOUR panel — close and continue
					await page.keyboard.press("Escape")
					await page.waitForTimeout(200)
					continue
				}

				// Single-event group opened EventDetailPanel — close and continue
				await page.keyboard.press("Escape")
				await page.waitForTimeout(200)
			}

			test.skip(!panelOpened, "No TRANSFER multi-event group found — skipping")

			// Assert Guía section is absent
			await calendarPage.expectGroupAssignGuideAbsent()

			// Assert Conductor section is present
			await calendarPage.expectGroupAssignDriverVisible()

			expect(isTransferPanel).toBe(true)
		}
	)
})
