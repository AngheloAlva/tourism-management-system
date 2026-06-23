import { useQuery } from "@tanstack/react-query"

import { peekNextVoucherNumber } from "@/shared/actions/generate-voucher"

/**
 * Projects the voucher number a new sale/quote would most likely receive.
 *
 * Only meant for create mode (in edit mode the real voucher already exists).
 * The value is a best-effort estimate — see {@link peekNextVoucherNumber}.
 */
export function useNextVoucherNumber(enabled = true) {
	return useQuery({
		queryKey: ["sales", "next-voucher"],
		queryFn: () => peekNextVoucherNumber(),
		enabled,
		staleTime: 0,
		refetchOnWindowFocus: false,
	})
}
