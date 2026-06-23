/**
 * Demo seed entry point.
 *
 * Calls each domain seed module in FK-safe insertion order:
 *   roles → users → agencies → providers →
 *   tours → calendar → sales → bookings → cashFlow → invoices → misc
 *
 * Each module receives the PrismaClient instance so the seed runs inside
 * the same connection that already has the schema DDL applied.
 */

// Direct relative path — @generated/* alias is resolved by Next/tsc but not by tsx at runtime.
import type { PrismaClient } from "../../../src/generated/prisma/client"
import { seedRoles } from "./roles"
import { seedUsers } from "./users"
import { seedAgencies } from "./agencies"
import { seedProviders } from "./providers"
import { seedTours } from "./tours"
import { seedCalendar } from "./calendar"
import { seedSales } from "./sales"
import { seedBookings } from "./bookings"
import { seedCashFlow } from "./cashFlow"
import { seedInvoices } from "./invoices"
import { seedMisc } from "./misc"

export async function runSeed(prisma: PrismaClient): Promise<void> {
  console.log("Demo seed starting...")

  // 1. Roles + counters (no FKs)
  await seedRoles(prisma)

  // 2. Users (references: role key via string field, no FK on role table)
  const users = await seedUsers(prisma)

  // 3. Agencies + transfer agencies (no FKs to prior tables)
  const { agencyIds, transferAgencyIds } = await seedAgencies(prisma)

  // 4. Providers (may create catering options; no FKs to sales)
  const { guideIds, driverIds, vehicleIds } = await seedProviders(prisma)

  // 5. Tours + price categories + catering options (no FKs to sales)
  const { tourIds, defaultCategoryByTour } = await seedTours(prisma)

  // 6. Calendar events (FK: tours, providers)
  const eventIds = await seedCalendar(prisma, {
    tourIds,
    guideIds,
    driverIds,
    vehicleIds,
  })

  // 7. Sales records + passengers + payments (FK: users, agencies, tours)
  const sales = await seedSales(prisma, {
    sellerUserIds: users.sellerUserIds,
    agencyIds,
    tourIds,
    eventIds,
  })

  // 8. Event bookings + commissions (FK: events, sales, users)
  await seedBookings(prisma, {
    sales,
    adminUserId: users.adminUserId,
    defaultCategoryByTour,
  })

  // 9. Cash flow (FK: users; references sale cash amounts)
  await seedCashFlow(prisma, {
    sales,
    adminUserId: users.adminUserId,
  })

  // 10. Wholesale invoices + lines + payments (FK: agencies, sales)
  await seedInvoices(prisma, {
    agencyIds,
    sales,
  })

  // 11. Misc lighter domains: approvals, transfers, audit (FK: users, agencies)
  await seedMisc(prisma, {
    adminUserId: users.adminUserId,
    sellerUserIds: users.sellerUserIds,
    agencyIds,
    transferAgencyIds,
    sales,
    eventIds,
  })

  console.log("Demo seed complete.")
}
