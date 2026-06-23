/**
 * Pure classifier for transfer change size.
 *
 * LARGE = eventIds set changed OR passengerIds set changed
 * SMALL = only scalar fields changed (agencyId, date, comments, payments) —
 *         the structural sets (eventIds, passengerIds) are identical.
 *
 * Design ref: R3 in transfer-edit-unlock spec. Pure function, no DB/IO — fully unit-testable.
 */

export interface TransferSnapshot {
  /** The set of event IDs linked to this transfer (from transferEventBooking rows). */
  eventIds: Set<string>
  /** The set of source passenger IDs selected in this transfer (from transferPriceDetail.sourcePassengerId). */
  passengerIds: Set<string>
}

/**
 * Returns true if the two sets have identical elements (order-independent).
 */
function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false
  for (const item of a) {
    if (!b.has(item)) return false
  }
  return true
}

/**
 * Classifies a transfer change as "large" or "small".
 *
 * @param current - Snapshot of the transfer as it currently exists in the DB.
 * @param next    - Snapshot derived from the incoming payload (new eventIds + passengerIds).
 * @returns "large" if the structural identity (events or passengers) changed; "small" otherwise.
 */
export function classifyTransferChange(
  current: TransferSnapshot,
  next: TransferSnapshot
): "large" | "small" {
  if (!setsEqual(current.eventIds, next.eventIds)) return "large"
  if (!setsEqual(current.passengerIds, next.passengerIds)) return "large"
  return "small"
}

/**
 * Boolean shorthand for classifyTransferChange — returns true when LARGE.
 */
export function isLargeTransferChange(
  current: TransferSnapshot,
  next: TransferSnapshot
): boolean {
  return classifyTransferChange(current, next) === "large"
}
