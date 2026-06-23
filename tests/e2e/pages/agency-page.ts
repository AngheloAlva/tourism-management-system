import { expect, type Page } from "@playwright/test"
import { BasePage } from "./base-page"

/**
 * AgencyPage — Page Object for the agencies (mayoristas) module.
 *
 * Route: /dashboard/gestion-de-mayoristas
 *
 * Testids added by PR6 retrofits:
 *   agency-button-create      — "Nuevo Mayorista" button (opens create dialog)
 *   agency-input-name         — agency name input in the form
 *   agency-button-form-submit — form submit button
 */
export class AgencyPage extends BasePage {
	readonly path = "/dashboard/gestion-de-mayoristas"

	constructor(page: Page) {
		super(page)
	}

	async goto(): Promise<void> {
		await super.goto(this.path)
	}

	/** Click the "Nuevo Mayorista" button to open the create dialog. */
	async openCreateDialog(): Promise<void> {
		await this.clickByTestId("agency-button-create")
		// Wait for dialog to be visible.
		await expect(
			this.page.getByRole("dialog")
		).toBeVisible({ timeout: 5_000 })
	}

	/**
	 * Fill the agency create/edit form with the given name (and optional email).
	 * Call after openCreateDialog().
	 *
	 * NOTE: the agency schema requires at least one valid contact email. If the
	 * caller does not provide an email, the form validation will fail silently on
	 * submission.
	 */
	async fillCreateForm(data: { name: string; email?: string }): Promise<void> {
		await this.fillByTestId("agency-input-name", data.name)
		if (data.email) {
			// The first contact email input uses placeholder "name@example.com".
			const emailInput = this.page.getByPlaceholder("name@example.com").first()
			await emailInput.fill(data.email)
		}
	}

	/** Submit the agency form. */
	async submitCreate(): Promise<void> {
		await this.clickByTestId("agency-button-form-submit")
		// Dialog should close after success.
		await this.page.waitForLoadState("networkidle")
	}

	/**
	 * Assert that a row matching the given agency name is visible in the table.
	 */
	async expectRowByName(name: string): Promise<void> {
		await expect(
			this.page.getByText(name, { exact: false }).first()
		).toBeVisible({ timeout: 15_000 })
	}

	/**
	 * Open the row dropdown menu for the given agency name.
	 * Looks for a row containing the name and clicks its action button.
	 */
	async openRowMenu(name: string): Promise<void> {
		// Find the row containing this agency name, then click the action button.
		const row = this.page.getByRole("row").filter({ hasText: name }).first()
		await row.getByRole("button").last().click()
	}

	/** Click the delete option from the open row dropdown. */
	async clickDelete(): Promise<void> {
		await this.page.getByRole("menuitem").filter({ hasText: /eliminar/i }).click()
	}
}
