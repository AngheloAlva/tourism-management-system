import { format as dfFormat } from "date-fns"

const SANTIAGO_TZ = "America/Santiago"

// Build a Date at UTC midnight from y/m/d integer components.
// This is the canonical form for @db.Date values: server and client both
// produce identical Date objects regardless of their runtime local timezone.
function utcMidnight(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
}

// Returns a Date representing the start of the current calendar day in Santiago,
// normalized to UTC midnight. Uses Intl.DateTimeFormat with the IANA tz database
// so DST transitions (April fall-back, September spring-forward) are handled correctly
// and the result is identical on a UTC server and on any client timezone.
export function todayInSantiago(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SANTIAGO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const y = Number(parts.find((p) => p.type === "year")!.value)
  const m = Number(parts.find((p) => p.type === "month")!.value)
  const d = Number(parts.find((p) => p.type === "day")!.value)
  return utcMidnight(y, m, d)
}

// Formats a Date sourced from a @db.Date field (i.e. UTC midnight) as a human-readable
// string using the given date-fns pattern. Reads UTC components to avoid runtime-tz
// interpretation, which would shift the displayed day on non-UTC machines.
export function formatCalendarDay(date: Date | null | undefined, pattern: string): string {
  if (!date) return ""
  // Reconstruct a "local-looking" Date from UTC components so that date-fns format
  // prints those exact components, independent of the process's local timezone.
  const local = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
  return dfFormat(local, pattern)
}

// Converts a @db.Date value (UTC midnight) into a Date at LOCAL midnight carrying the
// same calendar Y/M/D. Use this to HYDRATE date-picker form fields for editing.
// Pickers (react-day-picker, date-fns `format`) read LOCAL components, so feeding them
// a raw UTC-midnight Date shifts the displayed day backwards on negative-offset
// timezones (e.g. America/Santiago shows the previous day). This is the inverse of
// `formatCalendarDay`, which reads UTC components for read-only display.
export function calendarDayToLocalDate(date: Date | null | undefined): Date | undefined {
  if (!date) return undefined
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
}

// Parses a yyyy-MM-dd string (e.g. from an HTML date input) to a Date at UTC midnight.
// The returned Date is safe to pass directly to Prisma for a @db.Date field.
// Throws on any input that is not a valid yyyy-MM-dd calendar date.
export function parseCalendarDay(yyyyMMdd: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMMdd)
  if (!match) throw new Error(`Invalid calendar day: ${yyyyMMdd}`)
  const [, y, m, d] = match
  const date = utcMidnight(Number(y), Number(m), Number(d))
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid calendar day: ${yyyyMMdd}`)
  // Validate calendar overflow (e.g. month 13, day 32) by round-tripping components
  if (
    date.getUTCFullYear() !== Number(y) ||
    date.getUTCMonth() + 1 !== Number(m) ||
    date.getUTCDate() !== Number(d)
  ) {
    throw new Error(`Invalid calendar day: ${yyyyMMdd}`)
  }
  return date
}

// Returns a Prisma-compatible range clause covering exactly the given calendar day
// in UTC instants: { gte: UTC midnight, lt: next UTC midnight }.
// Used for legacy DateTime columns during the transition window before they are
// migrated to @db.Date. For DATE columns, prefer exact equality: { date: day }.
export function calendarDayRange(day: Date): { gte: Date; lt: Date } {
  const gte = utcMidnight(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate())
  const lt = new Date(gte.getTime() + 24 * 60 * 60 * 1000)
  return { gte, lt }
}

// Returns true if and only if both Dates represent the same UTC calendar day
// (year, month, date components). Returns false for any null/undefined input.
export function isSameCalendarDay(
  a: Date | null | undefined,
  b: Date | null | undefined,
): boolean {
  if (!a || !b) return false
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  )
}

// Returns true iff `date` is strictly BEFORE `today` (both compared as UTC calendar
// days). Today (inclusive) and future = false. Null/undefined date = false.
// Uses Date.UTC component comparison — never raw < (avoids TZ/instant pitfalls).
// Default `today` is todayInSantiago() so callers in the UI stay terse.
export function isPastEventDate(
  date: Date | null | undefined,
  today: Date = todayInSantiago(),
): boolean {
  if (!date) return false
  const d = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  return d < t
}

// Returns the canonical yyyy-MM-dd string key for a calendar day.
// Suitable for Map keys and grouping logic (e.g. calendar-month-view event buckets).
// Returns "" for null/undefined.
export function calendarDayKey(date: Date | null | undefined): string {
  if (!date) return ""
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}
