import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
	getSaleRecords,
	getSalesSummary,
	createSaleRecord,
	updateSaleRecord,
	deleteSaleRecord,
	cancelSaleRecord,
	getSaleRecordById,
	type SalesSummary,
	type SaleRecordWithDetails,
	type SaleRecordFilters,
	type PaginatedSaleRecords,
	type SaleSort,
} from "../actions/sale-record.actions"
import type { SaleRecordFormSchema } from "../schemas/sale-record.schema"

export function useSaleRecords(
	filters?: SaleRecordFilters,
	page = 1,
	pageSize = 50,
	sort?: SaleSort | null
) {
	return useQuery<PaginatedSaleRecords>({
		queryKey: ["sale-records", filters, page, pageSize, sort],
		queryFn: () => getSaleRecords(filters, page, pageSize, sort),
		placeholderData: (previousData) => previousData,
	})
}

export function useSaleRecord(id: string) {
	return useQuery<SaleRecordWithDetails | null>({
		queryKey: ["sale-record", id],
		queryFn: () => getSaleRecordById(id),
		enabled: !!id,
	})
}

export function useSalesSummary(filters?: SaleRecordFilters) {
	return useQuery<SalesSummary>({
		queryKey: ["sales-summary", filters],
		queryFn: () => getSalesSummary(filters),
		placeholderData: (previousData) => previousData,
	})
}

export function useCreateSaleRecord() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: createSaleRecord,
		onSuccess: (result) => {
			if (result.success) {
				queryClient.invalidateQueries({ queryKey: ["sale-records"] })
				queryClient.invalidateQueries({ queryKey: ["sales-summary"] })
				toast.success("Registro creado exitosamente")
			} else {
				toast.error(result.error || "Error al crear el registro")
			}
		},
		onError: (error: Error) => {
			toast.error(error.message || "Error al crear el registro")
		},
	})
}

export function useUpdateSaleRecord() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: ({ id, data, reason }: { id: string; data: SaleRecordFormSchema; reason?: string }) =>
			updateSaleRecord(id, data, reason),
		onSuccess: (result, variables) => {
			if (result.success) {
				// approvalRequired cases are handled by the caller (edit-sale-wrapper)
				// — do not show generic toast here when approval is needed
				if ("approvalRequired" in result && result.approvalRequired) {
					return
				}
				queryClient.invalidateQueries({ queryKey: ["sale-records"] })
				queryClient.invalidateQueries({ queryKey: ["sale-record", variables.id] })
				queryClient.invalidateQueries({ queryKey: ["sales-summary"] })
				toast.success("Registro actualizado exitosamente")
			} else {
				toast.error(result.error || "Error al actualizar el registro")
			}
		},
		onError: (error: Error) => {
			toast.error(error.message || "Error al actualizar el registro")
		},
	})
}

export function useDeleteSaleRecord() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: ({ id, reason }: { id: string; reason: string }) =>
			deleteSaleRecord(id, reason),
		onSuccess: (result) => {
			if (result.success) {
				queryClient.invalidateQueries({ queryKey: ["sale-records"] })
				queryClient.invalidateQueries({ queryKey: ["sales-summary"] })
				toast.success(
					result.approvalRequired
						? "Solicitud enviada. Te avisamos cuando sea aprobada."
						: "Registro cancelado exitosamente."
				)
			} else {
				toast.error(result.error || "Error al solicitar la cancelación")
			}
		},
		onError: (error: Error) => {
			toast.error(error.message || "Error al solicitar la cancelación")
		},
	})
}

export function useCancelSaleRecord() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: ({ id, reason }: { id: string; reason: string }) =>
			cancelSaleRecord(id, reason),
		onSuccess: (result) => {
			if (result.success) {
				queryClient.invalidateQueries({ queryKey: ["sale-records"] })
				queryClient.invalidateQueries({ queryKey: ["sales-summary"] })
				toast.success(
					result.approvalRequired
						? "Solicitud de anulación enviada. Te avisamos cuando sea aprobada."
						: "Registro anulado exitosamente."
				)
			} else {
				toast.error(result.error || "Error al solicitar la anulación")
			}
		},
		onError: (error: Error) => {
			toast.error(error.message || "Error al solicitar la anulación")
		},
	})
}
