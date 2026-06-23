import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { getTransferAgencyById } from "../actions/get-transfer-agency-by-id"
import { getActiveTransferAgencies } from "../actions/get-active-transfer-agencies"
import { getAllTransferAgencies } from "../actions/get-all-transfer-agencies"
import { createTransferAgency } from "../actions/create-transfer-agency"
import { updateTransferAgency } from "../actions/update-transfer-agency"
import { deleteTransferAgency } from "../actions/delete-transfer-agency"
import { toggleTransferAgencyStatus } from "../actions/toggle-transfer-agency-status"
import { transferAgencyKeys } from "../utils/transfer-agency-keys"

import type { CreateTransferAgency, UpdateTransferAgency } from "../schemas/transfer-agency.schema"
import type { TransferAgency } from "../types/transfer-agency"

export function useActiveTransferAgencies() {
	return useQuery<TransferAgency[]>({
		queryKey: transferAgencyKeys.useActiveTransferAgencies(),
		queryFn: getActiveTransferAgencies,
	})
}

export function useAllTransferAgencies() {
	return useQuery<TransferAgency[]>({
		queryKey: transferAgencyKeys.useAllTransferAgencies(),
		queryFn: getAllTransferAgencies,
	})
}

export function useTransferAgency(id: string) {
	return useQuery<TransferAgency | null>({
		queryKey: transferAgencyKeys.useTransferAgency(id),
		queryFn: () => getTransferAgencyById(id),
		enabled: !!id,
	})
}

export function useCreateTransferAgency() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (data: CreateTransferAgency) => createTransferAgency(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: transferAgencyKeys.useAllTransferAgencies() })
			queryClient.invalidateQueries({ queryKey: transferAgencyKeys.useActiveTransferAgencies() })
			toast.success("Agencia de transfer creada exitosamente")
		},
		onError: (error: Error) => {
			toast.error(error.message || "Error al crear la agencia de transfer")
		},
	})
}

export function useUpdateTransferAgency() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (data: UpdateTransferAgency) => updateTransferAgency(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: transferAgencyKeys.useAllTransferAgencies() })
			queryClient.invalidateQueries({ queryKey: transferAgencyKeys.useActiveTransferAgencies() })
			toast.success("Agencia de transfer actualizada exitosamente")
		},
		onError: (error: Error) => {
			toast.error(error.message || "Error al actualizar la agencia de transfer")
		},
	})
}

export function useDeleteTransferAgency() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (id: string) => deleteTransferAgency(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: transferAgencyKeys.useAllTransferAgencies() })
			queryClient.invalidateQueries({ queryKey: transferAgencyKeys.useActiveTransferAgencies() })
			toast.success("Agencia de transfer eliminada exitosamente")
		},
		onError: (error: Error) => {
			toast.error(error.message || "Error al eliminar la agencia de transfer")
		},
	})
}

export function useToggleTransferAgencyStatus() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (id: string) => toggleTransferAgencyStatus(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: transferAgencyKeys.useAllTransferAgencies() })
			queryClient.invalidateQueries({ queryKey: transferAgencyKeys.useActiveTransferAgencies() })
			toast.success("Estado de la agencia de transfer actualizado")
		},
		onError: (error: Error) => {
			toast.error(error.message || "Error al cambiar el estado")
		},
	})
}
