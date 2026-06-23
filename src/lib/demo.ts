/**
 * Single source of truth for the DEMO_MODE flag.
 *
 * `IS_DEMO` is true only when the environment variable `DEMO_MODE` equals the
 * exact string "true" (case-sensitive). Any other value — including absence,
 * "false", "1", or "TRUE" — leaves this false, keeping production behavior
 * byte-identical.
 */
export const IS_DEMO = process.env.DEMO_MODE === "true"
