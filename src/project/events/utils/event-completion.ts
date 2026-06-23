import { EVENT_STATUS } from "@/generated/prisma/enums"

/** Builds the Prisma where-clause that selects events eligible for auto-completion:
 *  events whose execution date is 7+ days in the past and not already finalized.
 *  Pure helper — kept out of the "use server" action file so it stays unit-testable
 *  and so the action module only exports async Server Actions (a Next.js requirement). */
export function buildElapsedEventWhere(today: Date) {
  // cutoff = today minus 7 days, via exact UTC arithmetic (no date-fns — avoids DST drift
  // on the UTC-midnight @db.Date values)
  const cutoff = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  return {
    date: { lte: cutoff },
    status: { in: [EVENT_STATUS.SCHEDULED, EVENT_STATUS.CONFIRMED, EVENT_STATUS.IN_PROGRESS] },
  }
}
