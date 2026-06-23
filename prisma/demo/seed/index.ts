/**
 * Demo seed entry point.
 *
 * Calls each domain seed module in FK-safe insertion order.
 * Each module receives the PrismaClient instance so the seed
 * runs inside the same connection that built the schema DDL.
 *
 * Insertion order (respects foreign-key dependencies):
 *   roles → users → agencies → transferAgencies → providers →
 *   tours → calendar → sales → bookings → cashFlow → invoices → misc
 *
 * This file is a scaffold for Slice 1 (Infra).
 * Real seed modules are wired in Slice 2 (Seed Data).
 */

import type { PrismaClient } from "@generated/prisma/client"

// Slice 2 imports — uncomment as each domain module is created:
// import { seedRoles } from "./roles"
// import { seedUsers } from "./users"
// import { seedAgencies } from "./agencies"
// import { seedTransferAgencies } from "./transferAgencies"
// import { seedProviders } from "./providers"
// import { seedTours } from "./tours"
// import { seedCalendar } from "./calendar"
// import { seedSales } from "./sales"
// import { seedBookings } from "./bookings"
// import { seedCashFlow } from "./cashFlow"
// import { seedInvoices } from "./invoices"
// import { seedMisc } from "./misc"

export async function runSeed(prisma: PrismaClient): Promise<void> {
  console.log("Demo seed starting...")

  // Slice 2: uncomment and call each module in FK-safe order:
  // await seedRoles(prisma)
  // await seedUsers(prisma)
  // await seedAgencies(prisma)
  // await seedTransferAgencies(prisma)
  // await seedProviders(prisma)
  // await seedTours(prisma)
  // await seedCalendar(prisma)
  // await seedSales(prisma)
  // await seedBookings(prisma)
  // await seedCashFlow(prisma)
  // await seedInvoices(prisma)
  // await seedMisc(prisma)

  console.log("Demo seed complete (scaffold — no data inserted yet).")
}
