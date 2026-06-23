/**
 * Pure utility for deriving a stable primitive key from the transfer form's
 * eventTransfers state. Used as a useStore selector to avoid the React #185
 * infinite-loop hazard with TanStack Form (immutable values object).
 *
 * The key changes if and only if:
 *   - the selectedEventId changes, OR
 *   - the set of eventIds with transferEvent=true changes, OR
 *   - the set of selected passengerIds changes, OR
 *   - transferFullEvent (bool) changes, OR
 *   - selectedVoucherId changes
 *
 * It does NOT change when:
 *   - scalar fields (agencyId, date, comments, payments) change
 *   - the passengerPrices array is rewritten with identical content
 *
 * This means the effect that reads this key will not re-fire when the form
 * rewrites eventTransfers with identical content → no loop.
 *
 * transferFullEvent and selectedVoucherId are included so that in CREATE mode,
 * switching between "full event" and a specific voucher (without changing the
 * event or passenger set) still triggers passenger reconciliation.
 */

type PassengerPriceInput = {
  passengerId?: string
  isSelected?: boolean
  [key: string]: unknown
}

type EventTransferInput = {
  eventId?: string
  transferEvent?: boolean
  passengerPrices?: PassengerPriceInput[]
  [key: string]: unknown
}

export function deriveReconcileKey(
  eventTransfers: EventTransferInput[],
  selectedEventId: string,
  transferFullEvent: boolean,
  selectedVoucherId: string
): string {
  const ets = eventTransfers ?? []

  const eventKey = ets
    .filter((e) => e.transferEvent)
    .map((e) => e.eventId ?? "")
    .sort()
    .join(",")

  const paxKey = ets
    .filter((e) => e.transferEvent)
    .flatMap((e) => (e.passengerPrices ?? []).filter((p) => p.isSelected).map((p) => p.passengerId ?? ""))
    .sort()
    .join(",")

  return `${selectedEventId}|${String(transferFullEvent)}|${selectedVoucherId}|${eventKey}|${paxKey}`
}
