"use client"

import { useQuery } from "@tanstack/react-query"
import {
	getDashboardStats,
	getOnboardingStatus,
	getRecentSales,
	getSalesChart,
	getTopTours,
	getUpcomingEvents,
} from "../actions/home.actions"

export function useDashboardStats() {
	return useQuery({
		queryKey: ["dashboard", "stats"],
		queryFn: () => getDashboardStats(),
		staleTime: 1000 * 60 * 5,
	})
}

export function useSalesChart() {
	return useQuery({
		queryKey: ["dashboard", "sales-chart"],
		queryFn: () => getSalesChart(),
		staleTime: 1000 * 60 * 5,
	})
}

export function useTopTours() {
	return useQuery({
		queryKey: ["dashboard", "top-tours"],
		queryFn: () => getTopTours(),
		staleTime: 1000 * 60 * 5,
	})
}

export function useUpcomingEvents() {
	return useQuery({
		queryKey: ["dashboard", "upcoming-events"],
		queryFn: () => getUpcomingEvents(),
		staleTime: 1000 * 60 * 5,
	})
}

export function useOnboardingStatus() {
	return useQuery({
		queryKey: ["dashboard", "onboarding-status"],
		queryFn: () => getOnboardingStatus(),
		staleTime: 1000 * 60 * 5,
	})
}

export function useRecentSales() {
	return useQuery({
		queryKey: ["dashboard", "recent-sales"],
		queryFn: () => getRecentSales(),
		staleTime: 1000 * 60 * 5,
	})
}
