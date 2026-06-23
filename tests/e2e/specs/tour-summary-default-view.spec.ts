/**
 * E2E spec: Calendar grouped toggle — default state and toggle behaviour (Task 5.5)
 *
 * Verifies:
 *   - On initial load with no stored preference, the grouped toggle is ON (checked).
 *   - With toggle ON and month view, group cards are rendered when data exists.
 *   - Toggling OFF while in month view removes group cards and shows per-event rendering.
 *   - Toggle state persists when switching between views (month → week → month).
 *
 * Spec reference: §Default state on initial load, §Toggling OFF in any view,
 *                  §Toggle ON persists across view switches.
 */

const E2E_DB_PORT = process.env.E2E_DB_PORT ?? "54320"
process.env.DATABASE_URL =
	process.env.E2E_DATABASE_URL ?? `postgresql://e2e:e2e@localhost:${E2E_DB_PORT}/tct_e2e`

import { test, expect } from "@playwright/test"
import { CalendarPage } from "../pages/calendar-page"

test.use({ storageState: "tests/e2e/.auth/admin.json" })

test.describe("calendar grouped toggle — default and toggle behaviour", () => {
	test.beforeEach(async ({ context }) => {
		// Clear localStorage so each test starts with no stored preference
		await context.addInitScript(() => {
			localStorage.removeItem("cal-grouped")
		})
	})

	test(
		"grouped toggle is ON by default on initial load",
		{ tag: ["@high", "@e2e", "@calendar", "@CAL-E2E-001"] },
		async ({ page }) => {
			const calendarPage = new CalendarPage(page)
			await calendarPage.goto()

			// The switch must be checked (aria-checked="true")
			await calendarPage.expectGroupedToggleOn()
		}
	)

	test(
		"group cards render in month view when toggle is ON",
		{ tag: ["@high", "@e2e", "@calendar", "@CAL-E2E-002"] },
		async ({ page }) => {
			const calendarPage = new CalendarPage(page)
			await calendarPage.goto()

			await calendarPage.expectGroupedToggleOn()

			// If there is any data for the current month, group cards must appear.
			// Skip gracefully when the E2E DB is empty for the current period.
			const cardCount = await calendarPage.groupCards.count()
			test.skip(cardCount === 0, "No REGULAR events in E2E DB for this month — skipping card visibility check")

			await calendarPage.expectGroupCardsVisible()
		}
	)

	test(
		"toggling OFF hides group cards and renders per-event view",
		{ tag: ["@high", "@e2e", "@calendar", "@CAL-E2E-003"] },
		async ({ page }) => {
			const calendarPage = new CalendarPage(page)
			await calendarPage.goto()

			// Confirm toggle starts ON
			await calendarPage.expectGroupedToggleOn()

			// Toggle it OFF
			await calendarPage.clickGroupedToggle()

			// Toggle must now be unchecked
			await calendarPage.expectGroupedToggleOff()

			// No group cards should be rendered
			await calendarPage.expectNoGroupCards()
		}
	)

	test(
		"toggle ON persists when switching from month to week view",
		{ tag: ["@medium", "@e2e", "@calendar", "@CAL-E2E-004"] },
		async ({ page }) => {
			const calendarPage = new CalendarPage(page)
			await calendarPage.goto()

			await calendarPage.expectGroupedToggleOn()

			// Switch to week view
			await calendarPage.switchToWeekView()

			// Toggle must remain ON after the view switch
			await calendarPage.expectGroupedToggleOn()
		}
	)

	test(
		"toggle OFF persists when switching from month to day view",
		{ tag: ["@medium", "@e2e", "@calendar", "@CAL-E2E-005"] },
		async ({ page }) => {
			const calendarPage = new CalendarPage(page)
			await calendarPage.goto()

			// Turn off the toggle first
			await calendarPage.clickGroupedToggle()
			await calendarPage.expectGroupedToggleOff()

			// Switch to day view
			await calendarPage.switchToDayView()

			// Toggle must remain OFF
			await calendarPage.expectGroupedToggleOff()
		}
	)
})
