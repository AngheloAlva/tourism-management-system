import { expect, type Page } from "@playwright/test"
import { BasePage } from "./base-page"

/**
 * ToursPage — Page Object for the tours module.
 *
 * List route:   /dashboard/tours
 * Create route: /dashboard/tours/nuevo (separate page)
 *
 * Testids added by PR6 retrofits:
 *   tours-button-create      — "Nuevo Tour" button on list page
 *   tour-input-name          — tour name input on create form
 *   tour-button-form-submit  — submit button on create form
 */
export class ToursPage extends BasePage {
	readonly listPath = "/dashboard/tours"
	readonly createPath = "/dashboard/tours/nuevo"

	constructor(page: Page) {
		super(page)
	}

	/** Navigate to the tours list page. */
	async goto(): Promise<void> {
		await super.goto(this.listPath)
	}

	/** Navigate to the tour create form page. */
	async gotoCreate(): Promise<void> {
		await super.goto(this.createPath)
	}

	/**
	 * Fill the tour create form with the given name.
	 * The name input is a styled inline field at the top of the form.
	 */
	async fillCreateForm(data: { name: string }): Promise<void> {
		await this.fillByTestId("tour-input-name", data.name)
	}

	/** Submit the tour create form. */
	async submitCreate(): Promise<void> {
		await this.clickByTestId("tour-button-form-submit")
		// Should navigate back to /dashboard/tours after success.
		await this.page.waitForURL("**/dashboard/tours", { timeout: 30_000 })
		await this.page.waitForLoadState("networkidle")
	}

	/**
	 * Assert that a row containing the given tour name is visible in the list.
	 */
	async expectRowByName(name: string): Promise<void> {
		await expect(
			this.page.getByText(name, { exact: false }).first()
		).toBeVisible({ timeout: 15_000 })
	}
}
