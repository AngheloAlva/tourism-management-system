import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query"

import {
	getCommissionOperators,
	getCommissionSales,
	getCommissionSummary,
	getCommissionPdfData,
	markCommissionsAsPaid,
} from "../actions/commission.actions"

import type { CommissionFilters, CommissionPdfFilters } from "../types/commission.types"
import type { CommissionKind } from "../types/commission.types"

export type { CommissionKind }

export const commissionKeys = {
	all: ["commissions"] as const,
	/** Structural key for a given kind — used for scoped invalidation (excludes pdf). */
	byKind: (kind: CommissionKind) => [...commissionKeys.all, "kind", kind] as const,
	operators: (kind: CommissionKind, dateRange: { startDate: Date; endDate: Date }) =>
		[...commissionKeys.byKind(kind), "commission-operators", dateRange] as const,
	sales: (kind: CommissionKind, filters: CommissionFilters) =>
		[...commissionKeys.byKind(kind), "commission-sales", filters] as const,
	summary: (kind: CommissionKind, filters: CommissionFilters) =>
		[...commissionKeys.byKind(kind), "commission-summary", filters] as const,
	/** pdf is intentionally NOT nested under byKind — it is on-demand and should NOT be
	 *  invalidated on mark-as-paid. The user downloads it explicitly. */
	pdf: (kind: CommissionKind, filters: CommissionPdfFilters) =>
		[...commissionKeys.all, "commission-pdf", kind, filters] as const,
}

export function useCommissionOperators(
	kind: CommissionKind,
	dateRange: { startDate: Date; endDate: Date },
	options?: { enabled?: boolean }
) {
	return useQuery({
		queryKey: commissionKeys.operators(kind, dateRange),
		queryFn: () => getCommissionOperators(kind, dateRange),
		enabled: options?.enabled ?? true,
		placeholderData: keepPreviousData,
	})
}

export function useCommissionSales(kind: CommissionKind, filters: CommissionFilters) {
	return useQuery({
		queryKey: commissionKeys.sales(kind, filters),
		queryFn: () => getCommissionSales(filters, kind),
		enabled: !!filters.operatorId,
		placeholderData: keepPreviousData,
	})
}

export function useCommissionSummary(kind: CommissionKind, filters: CommissionFilters) {
	return useQuery({
		queryKey: commissionKeys.summary(kind, filters),
		queryFn: () => getCommissionSummary(filters, kind),
		enabled: !!filters.operatorId,
		placeholderData: keepPreviousData,
	})
}

export function useCommissionPdfData(filters: CommissionPdfFilters) {
	return useQuery({
		queryKey: commissionKeys.pdf(filters.kind, filters),
		queryFn: () => getCommissionPdfData(filters),
		enabled: !!filters.operatorId,
	})
}

export function useMarkCommissionsAsPaid() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: markCommissionsAsPaid,
		onSuccess: (_data, variables) => {
			// Invalidate operators, sales, and summary for this kind only.
			// pdf is intentionally excluded — it is on-demand and not stale after mark-as-paid.
			queryClient.invalidateQueries({
				queryKey: commissionKeys.byKind(variables.kind),
			})
		},
	})
}
