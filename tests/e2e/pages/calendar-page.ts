import { expect, type Page } from "@playwright/test"
import { BasePage } from "./base-page"

/**
 * CalendarPage — Page Object for the calendar operations module.
 *
 * Route: /dashboard/calendario
 *
 * The calendar defaults to month view with the grouped toggle ON.
 *
 * Selector strategy:
 *   - Grouped toggle: shadcn Switch rendered with data-testid="grouped-toggle-switch".
 *     When checked, aria-checked="true".
 *   - View switcher: ToggleGroup renders ToggleGroupItem as <button> elements.
 *     The active item carries data-state="on".
 *   - Group cards: outer clickable div with role="button" data-testid="group-card".
 *     Compact cell variant (month/week) has data-variant="cell".
 *     Day-list variant has data-variant="list" and an expand chevron with
 *     aria-label="Expandir grupo" / aria-label="Colapsar grupo" (found by aria-label).
 *   - GroupAssignmentPanel: Dialog rendered as data-testid="group-assignment-panel".
 *     Guía section: data-testid="group-assign-guide-section" (absent for TRANSFER).
 *     Driver section: data-testid="group-assign-driver-section".
 *     Save button: data-testid="group-assign-save".
 *   - Export: Button aria-label="Exportar datos" opens a DropdownMenu.
 *     "Día actual" section > "PDF" / "Excel" DropdownMenuItems.
 */
export class CalendarPage extends BasePage {
	readonly path = "/dashboard/calendario"

	constructor(page: Page) {
		super(page)
	}

	async goto(): Promise<void> {
		await super.goto(this.path)
	}

	// ---------------------------------------------------------------------------
	// Grouped toggle
	// ---------------------------------------------------------------------------

	/** Returns the grouped toggle Switch element. */
	get groupedToggleSwitch() {
		return this.page.getByTestId("grouped-toggle-switch")
	}

	/** Assert the grouped toggle is checked (grouped ON). */
	async expectGroupedToggleOn(): Promise<void> {
		await expect(this.groupedToggleSwitch).toHaveAttribute("aria-checked", "true", {
			timeout: 15_000,
		})
	}

	/** Assert the grouped toggle is NOT checked (grouped OFF). */
	async expectGroupedToggleOff(): Promise<void> {
		await expect(this.groupedToggleSwitch).toHaveAttribute("aria-checked", "false", {
			timeout: 10_000,
		})
	}

	/** Click the grouped toggle to switch its state. */
	async clickGroupedToggle(): Promise<void> {
		await this.groupedToggleSwitch.click()
	}

	// ---------------------------------------------------------------------------
	// View switcher
	// ---------------------------------------------------------------------------

	/** Switch to month view. */
	async switchToMonthView(): Promise<void> {
		await this.page.getByRole("button", { name: "Mes" }).click()
		// Wait for the view to settle
		await this.page.waitForTimeout(300)
	}

	/** Switch to week view. */
	async switchToWeekView(): Promise<void> {
		await this.page.getByRole("button", { name: "Semana" }).click()
		await this.page.waitForTimeout(300)
	}

	/** Switch to day view. */
	async switchToDayView(): Promise<void> {
		await this.page.getByRole("button", { name: "Día" }).click()
		await this.page.waitForTimeout(300)
	}

	// ---------------------------------------------------------------------------
	// Group cards (TourSummaryGroupCard with role="button" data-testid="group-card")
	// ---------------------------------------------------------------------------

	/** Returns all visible group cards. */
	get groupCards() {
		return this.page.getByTestId("group-card")
	}

	/** Returns group cards with variant="cell" (compact month/week). */
	get compactGroupCards() {
		return this.page.locator('[data-testid="group-card"][data-variant="cell"]')
	}

	/** Returns group cards with variant="list" (day view). */
	get listGroupCards() {
		return this.page.locator('[data-testid="group-card"][data-variant="list"]')
	}

	/** Assert at least one group card is visible on the page. */
	async expectGroupCardsVisible(): Promise<void> {
		await expect(this.groupCards.first()).toBeVisible({ timeout: 15_000 })
	}

	/** Assert no group cards are visible (ungrouped state). */
	async expectNoGroupCards(): Promise<void> {
		await expect(this.groupCards).toHaveCount(0, { timeout: 10_000 })
	}

	/** Click the nth group card (0-indexed) to trigger assignment. */
	async clickGroupCard(index = 0): Promise<void> {
		await this.groupCards.nth(index).click()
	}

	/** Click the nth compact (cell variant) group card. */
	async clickCompactGroupCard(index = 0): Promise<void> {
		await this.compactGroupCards.nth(index).click()
	}

	// ---------------------------------------------------------------------------
	// Day-view expand/collapse (allowExpand=true, data-expand-trigger chevron)
	// ---------------------------------------------------------------------------

	/** Click the expand trigger on the nth list group row (0-indexed, default=0). */
	async expandListGroupRow(index = 0): Promise<void> {
		await this.page
			.getByRole("button", { name: /expandir grupo/i })
			.nth(index)
			.click()
	}

	/** Click the collapse trigger on the nth expanded list group row (0-indexed, default=0). */
	async collapseListGroupRow(index = 0): Promise<void> {
		await this.page
			.getByRole("button", { name: /colapsar grupo/i })
			.nth(index)
			.click()
	}

	/** Assert at least one Collapsible is in open state (expanded). */
	async expectCollapsibleOpen(): Promise<void> {
		await expect(
			this.page.locator("[data-radix-collapsible-root][data-state='open']").first()
		).toBeVisible({ timeout: 10_000 })
	}

	/** Assert no Collapsible is in open state (all collapsed / hidden). */
	async expectNoCollapsibleOpen(): Promise<void> {
		await expect(
			this.page.locator("[data-radix-collapsible-root][data-state='open']")
		).toHaveCount(0, { timeout: 10_000 })
	}

	// ---------------------------------------------------------------------------
	// GroupAssignmentPanel
	// ---------------------------------------------------------------------------

	/** Returns the GroupAssignmentPanel dialog content. */
	get groupAssignPanel() {
		return this.page.getByTestId("group-assignment-panel")
	}

	/** Assert the GroupAssignmentPanel is open. */
	async expectGroupAssignPanelOpen(): Promise<void> {
		await expect(this.groupAssignPanel).toBeVisible({ timeout: 10_000 })
	}

	/** Assert the Guía section is visible inside the GroupAssignmentPanel. */
	async expectGroupAssignGuideVisible(): Promise<void> {
		await expect(this.page.getByTestId("group-assign-guide-section")).toBeVisible({
			timeout: 5_000,
		})
	}

	/** Assert the Guía section is NOT present inside the GroupAssignmentPanel. */
	async expectGroupAssignGuideAbsent(): Promise<void> {
		await expect(this.page.getByTestId("group-assign-guide-section")).toHaveCount(0, {
			timeout: 5_000,
		})
	}

	/** Assert the Driver section is visible inside the GroupAssignmentPanel. */
	async expectGroupAssignDriverVisible(): Promise<void> {
		await expect(this.page.getByTestId("group-assign-driver-section")).toBeVisible({
			timeout: 5_000,
		})
	}

	/** Click the "Guardar" button inside GroupAssignmentPanel. */
	async clickGroupAssignSave(): Promise<void> {
		await this.page.getByTestId("group-assign-save").click()
	}

	// ---------------------------------------------------------------------------
	// EventDetailPanel (opened by single-event group click)
	// ---------------------------------------------------------------------------

	/**
	 * Assert EventDetailPanel is open.
	 * EventDetailPanel renders as a sheet (Radix Sheet) with role="dialog".
	 * The panel content has a heading that contains the event name / tour name.
	 */
	async expectEventDetailPanelOpen(): Promise<void> {
		// EventDetailPanel is a Sheet (aside role="dialog" or role="complementary")
		// Look for a dialog that is NOT the group-assignment-panel
		await expect(
			this.page.getByRole("dialog").filter({ hasNot: this.page.getByTestId("group-assignment-panel") }).first()
		).toBeVisible({ timeout: 10_000 })
	}

	// ---------------------------------------------------------------------------
	// Export
	// ---------------------------------------------------------------------------

	/** Open the export dropdown (aria-label "Exportar datos"). */
	async openExportDropdown(): Promise<void> {
		await this.page.getByRole("button", { name: /exportar datos/i }).click()
	}

	/** Click "PDF" under "Día actual" in the open export dropdown. */
	async clickExportPdf(): Promise<void> {
		await this.page.getByRole("menuitem", { name: /^pdf$/i }).first().click()
	}

	/** Click "Excel" under "Día actual" in the open export dropdown. */
	async clickExportExcel(): Promise<void> {
		await this.page.getByRole("menuitem", { name: /^excel$/i }).first().click()
	}
}
