import { useQuery } from "@tanstack/react-query"

import { getEventsByDate } from "../actions/departure.actions"

export function useDepartureEvents(date: Date) {
	return useQuery({
		queryKey: ["departure-events", date.toISOString()],
		queryFn: () => getEventsByDate(date),
		staleTime: 1000 * 60 * 5, // 5 minutos
	})
}
