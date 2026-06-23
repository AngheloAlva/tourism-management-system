import { type Page, expect } from "@playwright/test"
import { BasePage } from "./base-page"

/**
 * AuthPage — Page Object for the login form (/) and the change-password form (/cambiar-contrasena).
 *
 * Selector notes:
 *   - Login form inputs use name="email" and name="password" attributes (see login-form.tsx).
 *   - Change-password form inputs use name="currentPassword", name="newPassword",
 *     name="confirmPassword" attributes (see change-password-form.tsx).
 *   - The submit button in both forms is a <button type="submit"> inside form.AppForm.
 *
 *   TODO (PR6): Add data-testid attributes to login-form.tsx and change-password-form.tsx
 *   and replace the name-based selectors below with getByTestId calls:
 *     auth-input-email, auth-input-password, auth-button-submit
 *     auth-input-current-password, auth-input-new-password, auth-input-confirm-password
 *     auth-button-change-password
 */
export class AuthPage extends BasePage {
  readonly loginPath = "/"
  readonly changePasswordPath = "/cambiar-contrasena"
  readonly dashboardPath = "/dashboard/inicio"

  constructor(page: Page) {
    super(page)
  }

  // ─── Login ───────────────────────────────────────────────────────────────────

  async gotoLogin(): Promise<void> {
    await this.goto(this.loginPath)
  }

  async signIn(email: string, password: string): Promise<void> {
    // TODO (PR6): replace with getByTestId("auth-input-email") etc.
    const emailInput = this.page.locator('input[name="email"]')
    const passwordInput = this.page.locator('input[name="password"]')
    const submitBtn = this.page.locator('button[type="submit"]')

    await emailInput.fill(email)
    await passwordInput.fill(password)
    // Wait for submit button to be visible and stable before clicking.
    // TanStack Form uses onDynamicAsyncDebounceMs: 300 — allow it to settle.
    await submitBtn.waitFor({ state: "visible" })
    await this.page.waitForTimeout(400)
    await submitBtn.click()
  }

  async expectOnLogin(): Promise<void> {
    await expect(this.page).toHaveURL("/")
  }

  async expectOnDashboard(): Promise<void> {
    await this.page.waitForURL("**/dashboard/**", { timeout: 60_000 })
  }

  // ─── Change Password ──────────────────────────────────────────────────────────

  async expectOnChangePassword(): Promise<void> {
    await this.page.waitForURL("**/cambiar-contrasena**", { timeout: 10_000 })
  }

  async gotoChangePassword(): Promise<void> {
    await this.goto(this.changePasswordPath)
  }

  async setNewPassword(opts: {
    currentPassword: string
    newPassword: string
    confirmPassword: string
  }): Promise<void> {
    // TODO (PR6): replace with getByTestId selectors once data-testid attrs are added.
    await this.page.locator('input[name="currentPassword"]').fill(opts.currentPassword)
    await this.page.locator('input[name="newPassword"]').fill(opts.newPassword)
    await this.page.locator('input[name="confirmPassword"]').fill(opts.confirmPassword)
    await this.page.locator('button[type="submit"]').click()
  }

  async expectHeadingVisible(text: string): Promise<void> {
    await expect(this.page.getByRole("heading", { name: text })).toBeVisible()
  }

  // ─── Sign Out ─────────────────────────────────────────────────────────────────

  /**
   * Signs the current user out via the sidebar user menu.
   * Clicks the nav-user-button-signout element and waits for redirect to /.
   */
  async signOut(): Promise<void> {
    // Open the user dropdown in the sidebar first.
    // The sidebar menu button triggers the dropdown — click it then click sign-out.
    const trigger = this.page
      .locator("[data-sidebar='menu-button'], button[data-slot='avatar'], button")
      .filter({ hasText: /[A-Z]{2}/ })
      .first()

    // Try to open the dropdown by clicking a triggering element that reveals the sign-out item.
    // The nav-user dropdown trigger is a SidebarMenuButton wrapping an Avatar.
    const dropdownTrigger = this.page.locator("button").filter({ has: this.page.locator("span.truncate") }).first()
    await dropdownTrigger.click()

    // Now click the sign-out menu item by its testid.
    await this.page.getByTestId("nav-user-button-signout").click()

    // Wait for redirect to the login page.
    await this.page.waitForURL("/", { timeout: 10_000 })
  }
}
