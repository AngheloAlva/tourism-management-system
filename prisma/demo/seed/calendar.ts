/**
 * Seed: events + departures calendar (star domain — ≥30 records).
 *
 * Creates events centered on 2026-06-23 spanning:
 *   - Past: 30 days before
 *   - Present: current week
 *   - Future: 30 days ahead
 *
 * Events reference tours, guides, drivers, vehicles.
 * Must run after tours and providers.
 */

import { faker } from "@faker-js/faker"
// Direct relative path — @generated/* alias is resolved by Next/tsc but not by tsx at runtime.
import type { PrismaClient } from "../../../src/generated/prisma/client"

faker.seed(45)

/** Center date for the demo dataset */
const CENTER = new Date("2026-06-23")

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Create a UTC midnight Date from a YYYY-MM-DD string.
 * @db.Date fields in Prisma 7 require a Date object (the time component is ignored).
 */
function toDate(d: Date): Date {
  return new Date(`${d.toISOString().substring(0, 10)}T00:00:00.000Z`)
}

interface CalendarInput {
  tourIds: string[]
  guideIds: string[]
  driverIds: string[]
  vehicleIds: string[]
}

export async function seedCalendar(
  prisma: PrismaClient,
  input: CalendarInput,
): Promise<string[]> {
  console.log("  Seeding calendar events...")

  const { tourIds, guideIds, driverIds, vehicleIds } = input
  const eventIds: string[] = []

  // Generate 35 event records spread across past/present/future
  // Past: days -30 to -1 (15 events)
  // Present: days 0 to +6 (10 events)
  // Future: days +7 to +30 (10 events)
  const SCHEDULE: { dayOffset: number; status: string }[] = []

  for (let i = 0; i < 15; i++) {
    SCHEDULE.push({ dayOffset: -30 + i * 2, status: i < 12 ? "COMPLETED" : "CANCELLED" })
  }
  for (let i = 0; i < 10; i++) {
    SCHEDULE.push({ dayOffset: i, status: i < 5 ? "CONFIRMED" : "SCHEDULED" })
  }
  for (let i = 0; i < 10; i++) {
    SCHEDULE.push({ dayOffset: 7 + i * 2, status: "SCHEDULED" })
  }

  for (let idx = 0; idx < SCHEDULE.length; idx++) {
    const { dayOffset, status } = SCHEDULE[idx]
    const eventDate = addDays(CENTER, dayOffset)
    const tourId = tourIds[idx % tourIds.length]
    const guideId = guideIds[idx % guideIds.length]
    const driverId = driverIds[idx % driverIds.length]
    const vehicleId = vehicleIds[idx % vehicleIds.length]

    const guideCost = faker.number.int({ min: 35000, max: 75000 })
    const driverCost = faker.number.int({ min: 40000, max: 90000 })
    const vehicleCost = faker.number.int({ min: 50000, max: 100000 })
    const cateringCost = faker.number.int({ min: 15000, max: 40000 })

    const event = await prisma.event.create({
      data: {
        serviceKind: "TOUR",
        mode: idx % 4 === 0 ? "PRIVATE" : "REGULAR",
        date: toDate(eventDate),
        startTime: faker.helpers.arrayElement(["08:00", "09:00", "10:00"]),
        endTime: faker.helpers.arrayElement(["13:00", "14:00", "18:00"]),
        maxCapacity: 12,
        currentBookings: faker.number.int({ min: 0, max: 10 }),
        status: status as "SCHEDULED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
        tourId,
        guideId,
        driverId,
        vehicleId,
        guideCost,
        driverCost,
        vehicleCost,
        cateringCost,
        cancelledAt: status === "CANCELLED" ? eventDate : null,
        cancelReason: status === "CANCELLED" ? "Condiciones climáticas adversas" : null,
      },
    })
    eventIds.push(event.id)
  }

  console.log(`    Created ${eventIds.length} events (past + present + future).`)
  return eventIds
}
