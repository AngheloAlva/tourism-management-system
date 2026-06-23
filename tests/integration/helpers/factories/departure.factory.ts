/**
 * Departure factory.
 * In this project "departures" is a view/read-model over Event rows — there is no
 * separate Departure model. This factory creates an Event in a state relevant to the
 * departures domain (CONFIRMED or IN_PROGRESS status, required bookings included).
 */
import type { Event } from "@/generated/prisma"
import { createEvent } from "./event.factory"

type CreateDepartureOpts = {
  tourId?: string
  date?: Date
  status?: "SCHEDULED" | "CONFIRMED" | "IN_PROGRESS"
}

export async function createDeparture(
  opts?: CreateDepartureOpts,
): Promise<Event> {
  return createEvent({
    tourId: opts?.tourId,
    date: opts?.date ?? new Date(),
    status: opts?.status ?? "CONFIRMED",
  })
}
