/**
 * E2E spec: sale-edit-auth-gating — PR1 page guards (REQ-1)
 *
 * Verifies that the server-side `canCurrentUserInteractPaths` guard on both
 * sale/quote edit routes redirects read-only users and allows authorized users.
 *
 * Routes under test:
 *   - /dashboard/registro-de-ventas/{id}   (sale edit)
 *   - /dashboard/navegacion-cotizacion/{id} (quote edit)
 *
 * Test cases:
 *   1. Read-only `user` role → redirected to /dashboard/registro-de-ventas
 *   2. Read-only `user` role → redirected to /dashboard/navegacion-cotizacion
 *   3. Admin role → NOT redirected, form renders (exercises isAdmin short-circuit)
 *   4. Operadora role → NOT redirected, form renders (exercises permission-lookup branch)
 *
 * Auth strategy:
 *   - Uses auth.setup.ts pre-authenticated sessions (admin.json, user.json, operadora.json).
 *   - The E2E `user` role has role="user" (read-only, no canInteract permissions).
 *   - The E2E admin has role="admin" (all permissions, isAdmin=true).
 *   - The E2E operadora has role="operadora" (canInteract on sales modules, non-admin).
 *
 * DB seeding:
 *   A minimal SaleRecord is created directly via Prisma (no browser interaction).
 *   Cleaned up in afterAll.
 *
 * NOTE: These tests require Docker + built app (pnpm test:e2e).
 *   Run: pnpm test:e2e --grep "sale-edit-auth-gating"
 */

// Point DATABASE_URL to the E2E container before importing prisma.
const E2E_DB_PORT = process.env.E2E_DB_PORT ?? "54320"
process.env.DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? `postgresql://e2e:e2e@localhost:${E2E_DB_PORT}/tct_e2e`

import { test, expect } from "@playwright/test"
import { prisma } from "@/lib/prisma"

// Matches the admin user registered by auth.setup.ts. Inlined (not imported) because
// Playwright forbids a spec file from importing another test file (auth.setup.ts).
const ADMIN_EMAIL = "e2e-admin@test.local"

const RUN_ID = Date.now()
const GUARD_TOUR_NAME = `E2E-GuardTour-${RUN_ID}`

let guardSaleId: string
let guardTourId: string

test.describe(
  "sale-edit-auth-gating — page guards",
  { tag: ["@critical", "@e2e", "@sale-edit-guard"] },
  () => {
    test.beforeAll(async () => {
      const adminUser = await prisma.user.findUniqueOrThrow({
        where: { email: ADMIN_EMAIL },
      })

      // Seed a minimal tour (required by SaleRecord data model constraints).
      const tour = await prisma.tour.create({
        data: {
          name: GUARD_TOUR_NAME,
          active: true,
          priceCategories: {
            create: [
              {
                name: "Adulto",
                price: 20000,
                receptionPrice: 0,
                isDefault: true,
                sortOrder: 0,
              },
            ],
          },
        },
      })
      guardTourId = tour.id

      // Seed a minimal SaleRecord — used by both test cases.
      // type=QUOTE so it applies to both edit routes.
      const GUARD_VOUCHER = 700_000 + (RUN_ID % 100_000)
      const sale = await prisma.saleRecord.create({
        data: {
          voucher: GUARD_VOUCHER,
          type: "QUOTE",
          channel: "PHYSICAL",
          status: "TO_BE_DONE",
          isWholesale: false,
          discount: 0,
          wholesaleMarkup: 0,
          contacted: false,
          sellerId: adminUser.id,
        },
      })
      guardSaleId = sale.id

      await prisma.$disconnect()
    })

    test.afterAll(async () => {
      await prisma.saleRecord.delete({ where: { id: guardSaleId } }).catch(() => null)
      await prisma.tour.delete({ where: { id: guardTourId } }).catch(() => null)
      await prisma.$disconnect()
    })

    // ─── REQ-1: read-only user is redirected from sale edit route ──────────────

    test(
      "read-only user navigating to sale edit URL is redirected to the sales list",
      { tag: ["@SALE-GUARD-E2E-001"] },
      async ({ browser }) => {
        // Use the pre-authenticated `user` storageState from auth.setup.ts.
        const context = await browser.newContext({
          storageState: "tests/e2e/.auth/user.json",
        })
        const page = await context.newPage()

        try {
          await page.goto(`/dashboard/registro-de-ventas/${guardSaleId}`)
          await page.waitForLoadState("networkidle")

          // The server guard must redirect to the list page — the edit form should NOT render.
          await expect(page).toHaveURL(/\/dashboard\/registro-de-ventas$/)

          // Confirm the edit form heading is absent — the guard prevented rendering.
          await expect(
            page.getByRole("heading", { name: /Editar/i }),
          ).not.toBeVisible()
        } finally {
          await context.close()
        }
      },
    )

    // ─── REQ-1: read-only user is redirected from quote edit route ─────────────

    test(
      "read-only user navigating to quote edit URL is redirected to the quotes list",
      { tag: ["@SALE-GUARD-E2E-002"] },
      async ({ browser }) => {
        const context = await browser.newContext({
          storageState: "tests/e2e/.auth/user.json",
        })
        const page = await context.newPage()

        try {
          await page.goto(`/dashboard/navegacion-cotizacion/${guardSaleId}`)
          await page.waitForLoadState("networkidle")

          // The server guard must redirect to the quotes list.
          await expect(page).toHaveURL(/\/dashboard\/navegacion-cotizacion$/)

          // Confirm the edit form heading is absent.
          await expect(
            page.getByRole("heading", { name: /Editar/i }),
          ).not.toBeVisible()
        } finally {
          await context.close()
        }
      },
    )

    // ─── REQ-1: admin user is NOT redirected ───────────────────────────────────

    test(
      "admin user navigating to sale edit URL reaches the edit form",
      { tag: ["@SALE-GUARD-E2E-003"] },
      async ({ browser }) => {
        const context = await browser.newContext({
          storageState: "tests/e2e/.auth/admin.json",
        })
        const page = await context.newPage()

        try {
          await page.goto(`/dashboard/registro-de-ventas/${guardSaleId}`)
          await page.waitForLoadState("networkidle")

          // Admin must NOT be redirected — URL stays on the edit route.
          await expect(page).toHaveURL(
            new RegExp(`/dashboard/registro-de-ventas/${guardSaleId}`),
          )

          // The edit form heading must be visible.
          await expect(page.getByRole("heading", { name: /Editar/i })).toBeVisible()
        } finally {
          await context.close()
        }
      },
    )

    // ─── REQ-1: operadora user is NOT redirected (permission-lookup branch) ────
    //
    // This test exercises the non-admin branch of canCurrentUserInteractPaths.
    // Unlike the admin test (which short-circuits via isAdmin=true), operadora
    // must pass through the permission-map lookup: canInteract for
    // /registro-de-ventas / /navegacion-ventas / /navegacion-cotizacion is true
    // for the operadora role (defined in OPERADORA_VISIBLE_MODULES).
    //
    // Both edit URLs are asserted to ensure both routes permit operadora access.

    test(
      "operadora user navigating to both edit URLs reaches the edit form without redirect",
      { tag: ["@SALE-GUARD-E2E-004"] },
      async ({ browser }) => {
        // ── sale edit URL ──────────────────────────────────────────────────────
        const saleContext = await browser.newContext({
          storageState: "tests/e2e/.auth/operadora.json",
        })
        const salePage = await saleContext.newPage()

        try {
          await salePage.goto(`/dashboard/registro-de-ventas/${guardSaleId}`)
          await salePage.waitForLoadState("networkidle")

          // Operadora must NOT be redirected from the sale edit route.
          await expect(salePage).toHaveURL(
            new RegExp(`/dashboard/registro-de-ventas/${guardSaleId}`),
          )

          // The edit form heading must be present — guard allowed through.
          await expect(salePage.getByRole("heading", { name: /Editar/i })).toBeVisible()
        } finally {
          await saleContext.close()
        }

        // ── quote edit URL ─────────────────────────────────────────────────────
        const quoteContext = await browser.newContext({
          storageState: "tests/e2e/.auth/operadora.json",
        })
        const quotePage = await quoteContext.newPage()

        try {
          await quotePage.goto(`/dashboard/navegacion-cotizacion/${guardSaleId}`)
          await quotePage.waitForLoadState("networkidle")

          // Operadora must NOT be redirected from the quote edit route either.
          await expect(quotePage).toHaveURL(
            new RegExp(`/dashboard/navegacion-cotizacion/${guardSaleId}`),
          )

          await expect(quotePage.getByRole("heading", { name: /Editar/i })).toBeVisible()
        } finally {
          await quoteContext.close()
        }
      },
    )
  },
)
