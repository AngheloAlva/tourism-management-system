import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
	getReceptions,
	getReceptionById,
	createReception,
	updateReception,
	deleteReception,
	cancelReception,
	type ReceptionWithDetails,
	type ReceptionFilters,
	type PaginatedReceptions,
	type ReceptionSort,
} from "../actions/reception.actions"

import type { ReceptionFormData } from "../schemas/reception.schema"

export function useReceptions(
	filters?: ReceptionFilters,
	page = 1,
	pageSize = 50,
	sort?: ReceptionSort | null
) {
	return useQuery<PaginatedReceptions>({
		queryKey: ["receptions", filters, page, pageSize, sort],
		queryFn: () => getReceptions(filters, page, pageSize, sort),
		placeholderData: (previousData) => previousData,
	})
}

export function useReception(id: string) {
	return useQuery<ReceptionWithDetails | null>({
		queryKey: ["reception", id],
		queryFn: () => getReceptionById(id),
		enabled: !!id,
	})
}

export function useCreateReception() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: createReception,
		onSuccess: (result) => {
			if (result.success) {
				queryClient.invalidateQueries({ queryKey: ["receptions"] })
				toast.success("Recepción creada exitosamente")
			} else {
				toast.error(result.error || "Error al crear la recepción")
			}
		},
		onError: (error: Error) => {
			toast.error(error.message || "Error al crear la recepción")
		},
	})
}

export function useUpdateReception() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: ReceptionFormData }) =>
			updateReception(id, data),
		onSuccess: (result, variables) => {
			if (result.success) {
				queryClient.invalidateQueries({ queryKey: ["receptions"] })
				queryClient.invalidateQueries({ queryKey: ["reception", variables.id] })
				toast.success("Recepción actualizada exitosamente")
			} else {
				toast.error(result.error || "Error al actualizar la recepción")
			}
		},
		onError: (error: Error) => {
			toast.error(error.message || "Error al actualizar la recepción")
		},
	})
}

export function useDeleteReception() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: ({ id, reason }: { id: string; reason: string }) => deleteReception(id, reason),
		onSuccess: (result) => {
			if (result.success) {
				queryClient.invalidateQueries({ queryKey: ["receptions"] })
				toast.success(
					result.approvalRequired
						? "Solicitud de eliminación enviada."
						: "Recepción eliminada exitosamente."
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

export function useCancelReception() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ id, reason }: { id: string; reason?: string }) => cancelReception(id, reason),
		onSuccess: (result) => {
			if (result.success) {
				toast.success(
					result.approvalRequired
						? "Solicitud de cancelación enviada."
						: "Recepción cancelada correctamente."
				)
				queryClient.invalidateQueries({ queryKey: ["receptions"] })
			} else {
				toast.error(result.error || "Error al cancelar la recepción")
			}
		},
		onError: () => toast.error("Error al cancelar la recepción"),
	})
}
