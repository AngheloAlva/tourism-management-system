/**
 * E2E spec: Calendar grouped exports — PDF and Excel triggered by toggle state (Task 5.7)
 *
 * Verifies:
 *   - With grouped toggle ON, triggering PDF export initiates a download.
 *   - With grouped toggle ON, triggering Excel export initiates a download.
 *   - The download is initiated regardless of whether there is event data
 *     (even an empty grouped PDF/Excel will trigger a download event).
 *
 * Spec reference: §Grouped PDF and Excel Exports Follow Toggle State.
 *
 * NOTE: Playwright's waitForEvent("download") verifies a download was initiated
 * at the browser level; it does not inspect file content.
 */

const E2E_DB_PORT = process.env.E2E_DB_PORT ?? "54320"
process.env.DATABASE_URL =
	process.env.E2E_DATABASE_URL ?? `postgresql://e2e:e2e@localhost:${E2E_DB_PORT}/tct_e2e`

import { test, expect } from "@playwright/test"
import { CalendarPage } from "../pages/calendar-page"

test.use({ storageState: "tests/e2e/.auth/admin.json" })

test.describe("calendar grouped exports — PDF and Excel", () => {
	test.beforeEach(async ({ context }) => {
		// Ensure grouped toggle is ON so exports run the grouped code path
		await context.addInitScript(() => {
			localStorage.setItem("cal-grouped", "true")
		})
	})

	test(
		"PDF export with grouped toggle ON triggers a download",
		{ tag: ["@high", "@e2e", "@calendar", "@CAL-E2E-050"] },
		async ({ page }) => {
			const calendarPage = new CalendarPage(page)
			await calendarPage.goto()

			await calendarPage.expectGroupedToggleOn()

			// Listen for the download BEFORE clicking
			const downloadPromise = page.waitForEvent("download", { timeout: 30_000 })

			await calendarPage.openExportDropdown()
			await calendarPage.clickExportPdf()

			const download = await downloadPromise
			expect(download.suggestedFilename()).toMatch(/\.pdf$/)
		}
	)

	test(
		"Excel export with grouped toggle ON triggers a download",
		{ tag: ["@high", "@e2e", "@calendar", "@CAL-E2E-051"] },
		async ({ page }) => {
			const calendarPage = new CalendarPage(page)
			await calendarPage.goto()

			await calendarPage.expectGroupedToggleOn()

			const downloadPromise = page.waitForEvent("download", { timeout: 30_000 })

			await calendarPage.openExportDropdown()
			await calendarPage.clickExportExcel()

			const download = await downloadPromise
			expect(download.suggestedFilename()).toMatch(/\.xlsx$/)
		}
	)

	test(
		"PDF export with grouped toggle OFF also triggers a download (ungrouped path)",
		{ tag: ["@medium", "@e2e", "@calendar", "@CAL-E2E-052"] },
		async ({ page }) => {
			const calendarPage = new CalendarPage(page)
			await calendarPage.goto()

			// Turn off the grouped toggle — exports should still work (ungrouped path)
			await calendarPage.clickGroupedToggle()
			await calendarPage.expectGroupedToggleOff()

			const downloadPromise = page.waitForEvent("download", { timeout: 30_000 })

			await calendarPage.openExportDropdown()
			await calendarPage.clickExportPdf()

			const download = await downloadPromise
			expect(download.suggestedFilename()).toMatch(/\.pdf$/)
		}
	)
})
