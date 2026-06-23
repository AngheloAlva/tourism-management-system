import { expect, type Page } from "@playwright/test"
import { BasePage } from "./base-page"

/**
 * ProviderPage — Page Object for the providers module.
 *
 * List route:   /dashboard/control-de-proveedores
 * Create route: /dashboard/control-de-proveedores/nuevo (separate page)
 *
 * Testids added by PR6 retrofits:
 *   provider-button-create      — "Nuevo Proveedor" link/button on list page
 *   provider-input-name         — full name input on create form
 *   provider-button-form-submit — submit button on create form
 */
export class ProviderPage extends BasePage {
	readonly listPath = "/dashboard/control-de-proveedores"
	readonly createPath = "/dashboard/control-de-proveedores/nuevo"

	constructor(page: Page) {
		super(page)
	}

	/** Navigate to the providers list page. */
	async goto(): Promise<void> {
		await super.goto(this.listPath)
	}

	/** Navigate to the provider create form (separate page). */
	async gotoCreate(): Promise<void> {
		await super.goto(this.createPath)
	}

	/**
	 * Fill the provider create form.
	 * The create form is a full page (not a dialog).
	 * Minimum required: fullName. BirthDate is required for NATURAL type.
	 */
	async fillCreateForm(data: { name: string }): Promise<void> {
		await this.fillByTestId("provider-input-name", data.name)
	}

	/** Submit the provider create form. */
	async submitCreate(): Promise<void> {
		await this.clickByTestId("provider-button-form-submit")
		await this.page.waitForLoadState("networkidle")
	}

	/**
	 * Assert that a row matching the given provider name appears in the list.
	 */
	async expectRowByName(name: string): Promise<void> {
		await this.goto()
		await this.page.waitForLoadState("networkidle")
		await expect(
			this.page.getByText(name, { exact: false }).first()
		).toBeVisible({ timeout: 15_000 })
	}
}
