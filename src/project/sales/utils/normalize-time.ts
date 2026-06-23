/**
 * Normalizes a free-form time string into the canonical `HH:mm` (24-hour) form.
 *
 * Tour/event times are stored as free `String?` columns and many were migrated
 * straight from Excel, so they arrive in inconsistent shapes: with seconds or
 * fractional seconds (`"14:30:00.000"`), single-digit hours (`"9:30"`), a 12h
 * meridiem (`"2:30 p.m."`), surrounding whitespace, or even several times in one
 * cell (`"14:00/14:30"`). A native `<input type="time">` happily renders some of
 * these, but the strict `HH:mm` validator rejects them, surfacing a false
 * "invalid format" error until the user re-types the very same time.
 *
 * This extracts the first valid time it finds and returns it as `HH:mm`.
 * Empty, null, or unparseable input (and out-of-range times) yield `""`, which
 * the optional schema fields treat as "no time set".
 */
export function toHHmm(value: string | null | undefined): string {
	if (value == null) return ""

	const source = String(value).trim()
	if (source === "") return ""

	// hour:minute, optional :seconds(.fraction), optional am/pm meridiem (dots ok).
	const match = source.match(/(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:\s*([ap])\.?\s?m\.?)?/i)
	if (!match) return ""

	let hour = Number(match[1])
	const minute = Number(match[2])
	const meridiem = match[3]?.toLowerCase()

	if (meridiem === "p" && hour < 12) hour += 12
	if (meridiem === "a" && hour === 12) hour = 0

	if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return ""

	return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}
