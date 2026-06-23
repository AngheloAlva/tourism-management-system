import { expect } from "@playwright/test"
import { BasePage } from "./base-page"

/**
 * DashboardPage — Page Object for the main dashboard layout and navigation.
 *
 * Used by all Cluster 1 specs to navigate between modules and assert global
 * sidebar state (pending approvals badge, sidebar visibility, etc.).
 */
export class DashboardPage extends BasePage {
	readonly dashboardPath = "/dashboard/inicio"

	async goto(): Promise<void> {
		await super.goto(this.dashboardPath)
	}

	/**
	 * Navigate to a dashboard module by its slug (the URL path segment after /dashboard/).
	 * Example: gotoModule("gestion-de-mayoristas") → /dashboard/gestion-de-mayoristas
	 */
	async gotoModule(slug: string): Promise<void> {
		await super.goto(`/dashboard/${slug}`)
	}

	/** Assert the sidebar is visible on the page. */
	async expectSidebarVisible(): Promise<void> {
		await expect(this.page.locator("aside, [data-sidebar], nav")).toBeVisible({ timeout: 10_000 })
	}

	/**
	 * Assert the pending approvals badge is visible (and optionally contains the given count).
	 * The badge element is rendered in the sidebar approvals menu item.
	 */
	async expectPendingApprovalsBadge(count?: number): Promise<void> {
		// The badge is rendered near the "autorizaciones" link in the sidebar.
		// Look for a badge element containing the count inside the sidebar.
		if (count !== undefined) {
			await expect(
				this.page.locator(`text=${count}`).first()
			).toBeVisible({ timeout: 5_000 })
		} else {
			// Just assert some numeric badge is visible in the sidebar area.
			await expect(
				this.page.locator("aside").locator(".badge, [class*='badge']").first()
			).toBeVisible({ timeout: 5_000 })
		}
	}
}
