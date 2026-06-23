import { type Page, expect } from "@playwright/test"

/**
 * BasePage — abstract base class for all Page Object Models.
 *
 * data-testid convention used in this project:
 *   {domain}-{element}-{action}
 *
 * Examples:
 *   sales-table-row        — a row in the sales table
 *   sales-form-submit      — the submit button of the create-sale form
 *   auth-input-email       — the email input on the login form
 *   auth-input-password    — the password input on the login form
 *   users-button-create    — the "Create user" button on the users page
 *
 * When data-testid attributes are not yet present on a component, fallback selectors
 * (getByLabel, getByRole, getByPlaceholder, locator by name attribute) are used temporarily.
 * Each fallback is marked with a TODO comment indicating it should be replaced in PR6.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /**
   * Navigates to the given path and waits for the network to be idle.
   * Prefer `goto` over direct `page.goto` in POMs for consistent wait behavior.
   */
  async goto(path: string): Promise<void> {
    await this.page.goto(path)
    await this.page.waitForLoadState("networkidle")
  }

  /**
   * Clicks the element identified by the given data-testid value.
   */
  async clickByTestId(id: string): Promise<void> {
    await this.page.getByTestId(id).click()
  }

  /**
   * Fills an input identified by the given data-testid value.
   */
  async fillByTestId(id: string, value: string): Promise<void> {
    await this.page.getByTestId(id).fill(value)
  }

  /**
   * Asserts that the element with the given data-testid is visible on the page.
   */
  async expectVisibleByTestId(id: string): Promise<void> {
    await expect(this.page.getByTestId(id)).toBeVisible()
  }
}
