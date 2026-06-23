import { expect, type Page } from "@playwright/test"
import { BasePage } from "./base-page"

/**
 * TransfersPage — Page Object for the transfers (traspasos) module.
 *
 * Create route: /dashboard/traspasos            (multi-step form page)
 * List route:   /dashboard/navegacion-traspasos
 *
 * Testids added by PR6 retrofits:
 *   transfers-button-form-submit — submit button on create form
 *
 * NOTE: Transfers are tightly coupled to sale records (event bookings) — the
 * transfer form requires selecting an existing event from a sale record. This
 * makes full E2E creation impractical without seeding data. The spec for D-N5
 * uses prisma to seed required data and asserts at the DB level.
 */
export class TransfersPage extends BasePage {
	readonly createPath = "/dashboard/traspasos"
	readonly listPath = "/dashboard/navegacion-traspasos"

	constructor(page: Page) {
		super(page)
	}

	/** Navigate to the transfers list page. */
	async goto(): Promise<void> {
		await super.goto(this.listPath)
	}

	/** Navigate to the transfer create form page. */
	async gotoCreate(): Promise<void> {
		await super.goto(this.createPath)
	}

	/** Submit the transfer form (last step). */
	async submitCreate(): Promise<void> {
		await this.clickByTestId("transfers-button-form-submit")
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
