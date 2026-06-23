"use server"

import { prisma } from "@/lib/prisma"
import { todayInSantiago } from "@/shared/utils/calendar-day"
import { buildElapsedEventWhere } from "@/project/events/utils/event-completion"

/** Marks every event whose execution date is 7+ days past as COMPLETED.
 *  Run nightly by the complete-events cron. Single updateMany — no per-row audit
 *  (bulk system-derived transition; the first run sweeps the historical backlog). */
export async function completeElapsedEvents(): Promise<{ completed: number }> {
  const result = await prisma.event.updateMany({
    where: buildElapsedEventWhere(todayInSantiago()),
    data: { status: "COMPLETED" },
  })
  return { completed: result.count }
}
