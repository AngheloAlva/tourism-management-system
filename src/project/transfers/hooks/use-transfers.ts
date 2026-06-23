import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
	getTransfers,
	createTransfer,
	deleteTransfer,
	getTransferById,
	getEventsForTransfer,
	cancelTransfer,
	updateTransfer,
	type TransferWithDetails,
	type EventForTransfer,
	type TransferFilters,
	type PaginatedTransfers,
	type TransferSort,
} from "../actions/transfer.actions"
import type { TransferFormData } from "../schemas/transfer.schema"

export function useTransfers(
	filters?: TransferFilters,
	page = 1,
	pageSize = 50,
	sort?: TransferSort | null
) {
	return useQuery<PaginatedTransfers>({
		queryKey: ["transfers", filters, page, pageSize, sort],
		queryFn: () => getTransfers(filters, page, pageSize, sort),
		placeholderData: (previousData) => previousData,
	})
}

export function useTransfer(id: string) {
	return useQuery<TransferWithDetails | null>({
		queryKey: ["transfer", id],
		queryFn: () => getTransferById(id),
		enabled: !!id,
	})
}

export function useCreateTransfer() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: createTransfer,
		onSuccess: (result) => {
			if (result.success) {
				queryClient.invalidateQueries({ queryKey: ["transfers"] })
				toast.success("Traspaso creado exitosamente")
			} else {
				toast.error(result.error || "Error al crear el traspaso")
			}
		},
		onError: (error: Error) => {
			toast.error(error.message || "Error al crear el traspaso")
		},
	})
}

export function useDeleteTransfer() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: ({ id, reason }: { id: string; reason: string }) => deleteTransfer(id, reason),
		onSuccess: (result) => {
			if (result.success) {
				queryClient.invalidateQueries({ queryKey: ["transfers"] })
				toast.success(
					result.approvalRequired
						? "Solicitud de eliminación enviada."
						: "Traspaso eliminado exitosamente."
				)
			} else {
				toast.error(result.error || "Error al solicitar la eliminación")
			}
		},
		onError: (error: Error) => {
			toast.error(error.message || "Error al solicitar la eliminación")
		},
	})
}

export function useCancelTransfer() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ id, reason }: { id: string; reason?: string }) => cancelTransfer(id, reason),
		onSuccess: (result) => {
			if (result.success) {
				toast.success(
					result.approvalRequired
						? "Solicitud de cancelación enviada."
						: "Traspaso cancelado correctamente."
				)
				queryClient.invalidateQueries({ queryKey: ["transfers"] })
			} else {
				toast.error(result.error || "Error al cancelar el traspaso")
			}
		},
		onError: () => toast.error("Error al cancelar el traspaso"),
	})
}

export function useEventsForTransfer(excludeTransferId?: string) {
	return useQuery<EventForTransfer[]>({
		queryKey: ["events-for-transfer", excludeTransferId],
		queryFn: () => getEventsForTransfer(excludeTransferId),
	})
}

export function useUpdateTransfer() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ id, data, reason }: { id: string; data: TransferFormData; reason?: string }) =>
			updateTransfer(id, data, reason),
		onSuccess: (result) => {
			if (!result.success) {
				toast.error(result.error || "Error al actualizar el traspaso")
				return
			}
			// Always invalidate so the list refreshes regardless of approval path.
			queryClient.invalidateQueries({ queryKey: ["transfers"] })
			// approvalRequired: approval request was submitted — toast/dialog handled
			// by the caller (form). Skip the success toast here.
			if ("approvalRequired" in result) return
			toast.success("Traspaso actualizado correctamente")
		},
	})
}
