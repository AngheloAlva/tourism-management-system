import { expect, type Page } from "@playwright/test"
import { BasePage } from "./base-page"

/**
 * ReceptionsPage — Page Object for the receptions module.
 *
 * Create route: /dashboard/recepcion     (multi-step form page)
 * List route:   /dashboard/navegacion-recepciones
 *
 * Testids added by PR6 retrofits:
 *   receptions-button-form-submit — submit button on create form
 *
 * NOTE: Receptions use an AgencySearchSelect component for the agency field.
 * To avoid complex combobox interactions in E2E, this POM provides a method
 * to fill the agency by its visible label text after opening the dropdown.
 */
export class ReceptionsPage extends BasePage {
	readonly createPath = "/dashboard/recepcion"
	readonly listPath = "/dashboard/navegacion-recepciones"

	constructor(page: Page) {
		super(page)
	}

	/** Navigate to the reception list page. */
	async goto(): Promise<void> {
		await super.goto(this.listPath)
	}

	/** Navigate to the reception create form page. */
	async gotoCreate(): Promise<void> {
		await super.goto(this.createPath)
	}

	/**
	 * Select an agency in the agency combobox by typing and selecting the matching option.
	 * The AgencySearchSelect renders a combobox that filters by text input.
	 */
	async selectAgency(agencyName: string): Promise<void> {
		// The combobox is a button-like trigger. Click it to open the dropdown.
		const combobox = this.page.getByRole("combobox").first()
		await combobox.click()
		// Type to filter options.
		await this.page.keyboard.type(agencyName)
		// Wait for option to appear and click it.
		await this.page.getByRole("option", { name: agencyName, exact: false }).first().click()
		await this.page.waitForLoadState("networkidle")
	}

	/** Submit the reception create form (final step). */
	async submitCreate(): Promise<void> {
		await this.clickByTestId("receptions-button-form-submit")
		await this.page.waitForLoadState("networkidle")
	}

	/**
	 * Assert that a row containing the given agency name appears in the list.
	 */
	async expectRowByAgency(agencyName: string): Promise<void> {
		await this.goto()
		await this.page.waitForLoadState("networkidle")
		await expect(
			this.page.getByText(agencyName, { exact: false }).first()
		).toBeVisible({ timeout: 15_000 })
	}
}
