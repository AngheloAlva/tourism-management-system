import { expect, type Page } from "@playwright/test"
import { BasePage } from "./base-page"

/**
 * EventsPage — Page Object for event-related operations.
 *
 * Events in this application are not created independently — they are created
 * as part of sale records (event bookings in the sales form). The calendar
 * at /dashboard/calendario displays existing events.
 *
 * This POM covers:
 * 1. Navigating to the calendar to find an event.
 * 2. Opening the event detail dialog (for Cluster 2 approvals specs).
 *
 * NOTE (PR6): Standalone event creation is OUT OF SCOPE for Cluster 1 since
 * events are coupled to sale records. The tour-event-crud spec creates a tour
 * via UI and then seeds an event via prisma for DB assertions.
 *
 * Testids for PR7 (Cluster 2):
 *   events-button-detail-cancel-event — cancel button inside event detail dialog
 *   (added by T-D7-R5, not T-D6)
 */
export class EventsPage extends BasePage {
	readonly calendarPath = "/dashboard/calendario"

	constructor(page: Page) {
		super(page)
	}

	/** Navigate to the calendar page. */
	async goto(): Promise<void> {
		await super.goto(this.calendarPath)
	}

	/**
	 * Open the event detail dialog for an event with the given title.
	 * Looks for a calendar card or list item containing the title and clicks it.
	 */
	async openEventDetail(title: string): Promise<void> {
		await this.page.getByText(title, { exact: false }).first().click()
		await this.page.waitForLoadState("networkidle")
		// Wait for the dialog to appear.
		await expect(this.page.getByRole("dialog")).toBeVisible({ timeout: 10_000 })
	}

	/**
	 * Click the "Cancelar evento" button inside the open event detail dialog.
	 * Requires T-D7-R5 retrofit (events-button-detail-cancel-event testid) — for PR7.
	 */
	async clickCancelEvent(): Promise<void> {
		await this.clickByTestId("events-button-detail-cancel-event")
	}
}
