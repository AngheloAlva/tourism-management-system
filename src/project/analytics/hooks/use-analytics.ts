import { useQuery } from "@tanstack/react-query"

import {
	getTopTours,
	getSalesEvolution,
	getBookingLeadTime,
	getAnalyticsSummary,
	getTopToursByMonth,
	type AnalyticsFilters,
	getCustomersByNationality,
	getPaymentMethodsDistribution,
} from "../actions/analytics.actions"

export const analyticsKeys = {
	all: ["analytics"] as const,
	customersByNationality: (filters?: AnalyticsFilters) =>
		[...analyticsKeys.all, "customers-by-nationality", filters] as const,
	topTours: (filters?: AnalyticsFilters) => [...analyticsKeys.all, "top-tours", filters] as const,
	topToursByMonth: (filters?: AnalyticsFilters) =>
		[...analyticsKeys.all, "top-tours-by-month", filters] as const,
	summary: (filters?: AnalyticsFilters) => [...analyticsKeys.all, "summary", filters] as const,
	salesEvolution: (filters?: AnalyticsFilters, groupBy?: "day" | "month") =>
		[...analyticsKeys.all, "sales-evolution", filters, groupBy] as const,
	paymentMethods: (filters?: AnalyticsFilters) =>
		[...analyticsKeys.all, "payment-methods", filters] as const,
	bookingLeadTime: (filters?: AnalyticsFilters) =>
		[...analyticsKeys.all, "booking-lead-time", filters] as const,
}

export function useCustomersByNationality(filters?: AnalyticsFilters) {
	return useQuery({
		queryKey: analyticsKeys.customersByNationality(filters),
		queryFn: () => getCustomersByNationality(filters),
	})
}

export function useTopTours(filters?: AnalyticsFilters) {
	return useQuery({
		queryKey: analyticsKeys.topTours(filters),
		queryFn: () => getTopTours(filters),
	})
}

export function useAnalyticsSummary(filters?: AnalyticsFilters) {
	return useQuery({
		queryKey: analyticsKeys.summary(filters),
		queryFn: () => getAnalyticsSummary(filters),
	})
}

export function useSalesEvolution(filters?: AnalyticsFilters, groupBy: "day" | "month" = "day") {
	return useQuery({
		queryKey: analyticsKeys.salesEvolution(filters, groupBy),
		queryFn: () => getSalesEvolution(filters, groupBy),
	})
}

export function usePaymentMethods(filters?: AnalyticsFilters) {
	return useQuery({
		queryKey: analyticsKeys.paymentMethods(filters),
		queryFn: () => getPaymentMethodsDistribution(filters),
	})
}

export function useBookingLeadTime(filters?: AnalyticsFilters) {
	return useQuery({
		queryKey: analyticsKeys.bookingLeadTime(filters),
		queryFn: () => getBookingLeadTime(filters),
	})
}

export function useTopToursByMonth(filters?: AnalyticsFilters) {
	return useQuery({
		queryKey: analyticsKeys.topToursByMonth(filters),
		queryFn: () => getTopToursByMonth(filters),
	})
}
