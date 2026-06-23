import { prisma } from "@/lib/prisma"

// Order matters: leaves first, roots last.
// CASCADE handles FK violations but explicit ordering is safer and faster.
// POLICY: when a new Prisma model is added, append it here. Document in TESTING.md.
const TRUNCATE_ORDER: ReadonlyArray<string> = [
  // Deep leaves (no outbound FKs to other entities)
  "audit_log",
  "voucher_counter",
  "agency_transfer_counter",
  // Booking / pricing snapshots (depend on bookings)
  "booking_entry_snapshot",
  "booking_price_entry",
  "booking_passenger",
  // Commissions (depend on event_booking + user)
  "event_booking_commission",
  // Transfer price details (depend on agency_transfer + passenger)
  "transfer_price_detail",
  // Transfer event bookings (depend on agency_transfer + event)
  "transfer_event_booking",
  // Event bookings (depend on event + sale_record)
  "event_booking",
  // Wholesale invoice lines/payments (depend on wholesale_invoice)
  "wholesale_invoice_line",
  "wholesale_invoice_payment",
  // Approval requests (depend on user)
  "approval_request",
  // Passenger hotels (depend on passenger)
  "passenger_hotel",
  // Passengers (depend on sale_record or agency_transfer)
  "passenger",
  // Payment records (depend on sale_record or agency_transfer)
  "payment_record",
  // Agency tour pricing overrides (depend on agency_tour_pricing)
  "agency_entry_override",
  "agency_price_category_override",
  "agency_tour_private_pricing_tier",
  // Agency tour pricing (depend on agency + tour)
  "agency_tour_pricing",
  // Sale records (depend on user + agency + tour via event)
  "sale_record",
  // Agency transfers (depend on user + transfer_agency + sale_record)
  "agency_transfer",
  // Wholesale invoices (depend on agency)
  "wholesale_invoice",
  // Cash box children (depend on cash_box + user)
  "cash_box_entry",
  "cash_count",
  "cash_deposit",
  "supplier_payment",
  // Cash box
  "cash_box",
  // Tour pricing (depend on tour)
  "tour_entry",
  "tour_price_category",
  "tour_private_pricing_tier",
  // Events (depend on tour + provider + transfer_service)
  "event",
  // Provider catering (depend on provider + catering_option)
  "provider_catering",
  // Tours, providers, transfer services
  "catering_option",
  "transfer_service",
  "tour",
  "provider",
  // Agencies
  "agency",
  "transfer_agency",
  // Roles
  "role_module_permission",
  "role",
  // Auth leaf tables (depend on user)
  "session",
  "account",
  "verification",
  // User (root)
  "user",
]

export async function truncateAll(): Promise<void> {
  // Single statement, CASCADE, RESTART IDENTITY. FK-safe in one round-trip.
  const tables = TRUNCATE_ORDER.map((t) => `"${t}"`).join(", ")
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`,
  )
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect()
}

export { prisma }
