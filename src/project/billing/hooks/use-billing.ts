import { useQuery } from "@tanstack/react-query"

import {
	getSellers,
	getSalesByDate,
	getSalesByTour,
	getRecentSales,
	getSalesBySeller,
	getBillingSummary,
	getSalesByChannel,
} from "../actions/billing.actions"

import type { BillingFilters } from "../actions/billing.actions"

export const billingKeys = {
	all: ["billing"] as const,
	summary: (filters?: BillingFilters) => [...billingKeys.all, "summary", filters] as const,
	bySeller: (filters?: BillingFilters) => [...billingKeys.all, "by-seller", filters] as const,
	byDate: (filters?: BillingFilters, groupBy?: string) =>
		[...billingKeys.all, "by-date", filters, groupBy] as const,
	byChannel: (filters?: BillingFilters) => [...billingKeys.all, "by-channel", filters] as const,
	byTour: (filters?: BillingFilters) => [...billingKeys.all, "by-tour", filters] as const,
	sellers: () => [...billingKeys.all, "sellers"] as const,
	recentSales: (filters?: BillingFilters, limit?: number) =>
		[...billingKeys.all, "recent-sales", filters, limit] as const,
}

export function useBillingSummary(filters?: BillingFilters) {
	return useQuery({
		queryKey: billingKeys.summary(filters),
		queryFn: () => getBillingSummary(filters),
	})
}

export function useSalesBySeller(filters?: BillingFilters) {
	return useQuery({
		queryKey: billingKeys.bySeller(filters),
		queryFn: () => getSalesBySeller(filters),
	})
}

export function useSalesByDate(
	filters?: BillingFilters,
	groupBy: "day" | "week" | "month" = "day"
) {
	return useQuery({
		queryKey: billingKeys.byDate(filters, groupBy),
		queryFn: () => getSalesByDate(filters, groupBy),
	})
}

export function useSalesByChannel(filters?: BillingFilters) {
	return useQuery({
		queryKey: billingKeys.byChannel(filters),
		queryFn: () => getSalesByChannel(filters),
	})
}

export function useSalesByTour(filters?: BillingFilters) {
	return useQuery({
		queryKey: billingKeys.byTour(filters),
		queryFn: () => getSalesByTour(filters),
	})
}

export function useSellers() {
	return useQuery({
		queryKey: billingKeys.sellers(),
		queryFn: getSellers,
	})
}

export function useRecentSales(filters?: BillingFilters, limit = 20) {
	return useQuery({
		queryKey: billingKeys.recentSales(filters, limit),
		queryFn: () => getRecentSales(filters, limit),
	})
}
