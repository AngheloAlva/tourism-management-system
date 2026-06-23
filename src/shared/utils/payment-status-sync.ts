/**
 * Whether the "PENDING payment status" effect should clear the `payments` array.
 *
 * Returns `false` when there is nothing to clear. This guard is what prevents an
 * infinite render loop (React error #185 "Maximum update depth exceeded"):
 * TanStack Form's `setFieldValue` ALWAYS builds a new `values` object — even when
 * setting an equal value — and `@tanstack/react-store`'s `useStore` re-renders on
 * that new reference (shallow equality). An unconditional write inside an effect
 * whose dependencies change every render therefore loops forever.
 *
 * Keeping this decision in one pure function makes the regression testable without
 * rendering the form, and gives both the transfer and reception forms a single
 * source of truth.
 */
export function shouldClearPendingPayments(
	paymentStatus: string,
	payments: ReadonlyArray<unknown> | null | undefined
): boolean {
	return paymentStatus === "PENDING" && (payments?.length ?? 0) > 0
}
