import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
	getAgenciesWithSales,
	getPaymentStatementSales,
	getPaymentStatementSummary,
	registerWholesaleInvoicePayment,
} from "../actions/payment-statement.actions"

import type { PaymentStatementFilters } from "../types/payment-statement.types"

export const paymentStatementKeys = {
	all: ["payment-statements"] as const,
	agencies: () => [...paymentStatementKeys.all, "agencies"] as const,
	sales: (filters: PaymentStatementFilters) =>
		[...paymentStatementKeys.all, "sales", filters] as const,
	summary: (filters: PaymentStatementFilters) =>
		[...paymentStatementKeys.all, "summary", filters] as const,
}

export function useAgenciesWithSales() {
	return useQuery({
		queryKey: paymentStatementKeys.agencies(),
		queryFn: getAgenciesWithSales,
	})
}

export function usePaymentStatementSales(filters: PaymentStatementFilters) {
	return useQuery({
		queryKey: paymentStatementKeys.sales(filters),
		queryFn: () => getPaymentStatementSales(filters),
		enabled: !!filters.agencyIds && filters.agencyIds.length > 0,
	})
}

export function usePaymentStatementSummary(filters: PaymentStatementFilters) {
	return useQuery({
		queryKey: paymentStatementKeys.summary(filters),
		queryFn: () => getPaymentStatementSummary(filters),
		enabled: !!filters.agencyIds && filters.agencyIds.length > 0,
	})
}

export function useRegisterWholesaleInvoicePayment() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: registerWholesaleInvoicePayment,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: paymentStatementKeys.all })
		},
	})
}
