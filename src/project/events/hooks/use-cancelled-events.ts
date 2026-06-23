import { useQuery } from "@tanstack/react-query"

import { getCancelledEvents } from "../actions/event.actions"

export function useCancelledEvents(startDate: Date, endDate: Date) {
	return useQuery({
		queryKey: ["events", "cancelled", startDate.toISOString(), endDate.toISOString()],
		queryFn: () => getCancelledEvents({ startDate, endDate }),
	})
}
