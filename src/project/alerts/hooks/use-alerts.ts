"use client"

import { useQuery } from "@tanstack/react-query"

import { getAlertsDashboardData } from "../actions/alert.actions"

export function useAlertsDashboard() {
	return useQuery({
		queryKey: ["alerts", "dashboard"],
		queryFn: getAlertsDashboardData,
		staleTime: 1000 * 60 * 3,
		refetchOnWindowFocus: true,
	})
}
