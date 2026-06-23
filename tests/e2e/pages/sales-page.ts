import { expect, type Page } from "@playwright/test"
import { BasePage } from "./base-page"

/**
 * SalesPage — Page Object for sales-related routes.
 *
 * - Create route: /dashboard/registro-de-ventas (multi-step form)
 * - List route:   /dashboard/navegacion-ventas (table view)
 *
 * The create form is a 4-step wizard. Steps:
 *   1. Información General (channel, type, etc.)
 *   2. Detalle de Evento/Tour
 *   3. Detalle de Pasajeros  ← sales-input-passenger-name is here
 *   4. Registro de Pago
 *
 * For Cluster 1 specs, we only navigate to step 3 (passenger name) since
 * steps 2 and 4 require complex entity selectors. The spec uses the QUOTE type
 * which skips step 4, and step 2 can be passed with defaults.
 *
 * Testids added by PR6 retrofits:
 *   sales-input-passenger-name  — first passenger name field (step 3)
 *   sales-button-form-submit    — final submit button
 *   sales-button-step-next      — "Siguiente" button between steps
 */
export class SalesPage extends BasePage {
	readonly createPath = "/dashboard/registro-de-ventas"
	readonly listPath = "/dashboard/navegacion-ventas"

	constructor(page: Page) {
		super(page)
	}

	/** Navigate to the sales list page. */
	async goto(): Promise<void> {
		await super.goto(this.listPath)
	}

	/** Navigate to the sales create form. */
	async gotoCreate(): Promise<void> {
		await super.goto(this.createPath)
	}

	/**
	 * Advance through the multi-step form.
	 * Clicks the "Siguiente" step button and waits for network idle.
	 */
	async goToNextStep(): Promise<void> {
		await this.clickByTestId("sales-button-step-next")
		await this.page.waitForLoadState("networkidle")
	}

	/**
	 * Fill the passenger name field (step 3 of the wizard).
	 * Must be called after navigating to step 3.
	 */
	async fillPassengerName(name: string): Promise<void> {
		await this.fillByTestId("sales-input-passenger-name", name)
	}

	/**
	 * Click the final submit button.
	 * The form type must be QUOTE (or step 4 payment must be skipped) for this to be
	 * the last-step submit.
	 */
	async submitCreate(): Promise<void> {
		await this.clickByTestId("sales-button-form-submit")
		// Wait for the success state — form resets or navigation occurs.
		await this.page.waitForLoadState("networkidle")
	}

	/**
	 * Assert that a passenger name text appears anywhere in the sales list page.
	 * Used to verify the created record appears after form submission.
	 */
	async expectPassengerVisible(name: string): Promise<void> {
		await expect(this.page.getByText(name).first()).toBeVisible({ timeout: 15_000 })
	}

	/**
	 * Assert the page contains a sale record row matching the given text.
	 * Since the list paginates and filters, navigate to the list first.
	 */
	async expectRowByClient(name: string): Promise<void> {
		await this.goto()
		await this.page.waitForLoadState("networkidle")
		await expect(this.page.getByText(name).first()).toBeVisible({ timeout: 15_000 })
	}

	// ─── Edit-mode helpers (T-08) ────────────────────────────────────────────

	/**
	 * Click a step circle by step number.
	 * In edit mode circles are interactive buttons — clicking navigates directly.
	 * In create mode circles are disabled (no-op).
	 */
	async clickStepCircle(stepNumber: number): Promise<void> {
		await this.page.getByTestId(`sales-step-circle-${stepNumber}`).click()
		await this.page.waitForLoadState("networkidle")
	}

	/**
	 * Assert that the step circle for stepNumber is disabled (create mode).
	 */
	async expectStepCircleDisabled(stepNumber: number): Promise<void> {
		const circle = this.page.getByTestId(`sales-step-circle-${stepNumber}`)
		await expect(circle).toBeDisabled()
	}

	/**
	 * Assert that the step circle for stepNumber is enabled (edit mode).
	 */
	async expectStepCircleEnabled(stepNumber: number): Promise<void> {
		const circle = this.page.getByTestId(`sales-step-circle-${stepNumber}`)
		await expect(circle).toBeEnabled()
	}

	/**
	 * Assert that "Guardar cambios" submit button is visible.
	 * Only present in edit mode on every step.
	 */
	async expectGuardarCambiosVisible(): Promise<void> {
		await expect(
			this.page.getByTestId("sales-button-form-submit")
		).toBeVisible()
	}

	/**
	 * Assert that the "Continuar" step button is NOT present.
	 * Expected on the last visible step, where there is no next step.
	 */
	async expectNextButtonAbsent(): Promise<void> {
		await expect(
			this.page.getByTestId("sales-button-step-next")
		).not.toBeVisible()
	}

	/**
	 * Assert that the "Continuar" step button is visible.
	 * Expected in edit mode on every non-last step (alongside "Guardar cambios").
	 */
	async expectNextButtonVisible(): Promise<void> {
		await expect(
			this.page.getByTestId("sales-button-step-next")
		).toBeVisible()
	}

	/**
	 * Click the "Guardar cambios" submit button in edit mode.
	 */
	async submitEdit(): Promise<void> {
		await this.clickByTestId("sales-button-form-submit")
		await this.page.waitForLoadState("networkidle")
	}
}
