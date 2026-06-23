import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { toggleAgencyStatus } from "../actions/toggle-agency-status"
import { getActiveAgencies } from "../actions/get-active-agencies"
import { getAllAgencies } from "../actions/get-all-agencies"
import { getAgencyById } from "../actions/get-agency-by-id"
import { createAgency } from "../actions/create-agency"
import { updateAgency } from "../actions/update-agency"
import { deleteAgency } from "../actions/delete-agency"
import { agencyKeys } from "../utils/agency-keys"

import type { CreateAgency, UpdateAgency } from "../schemas/agency.schema"
import type { Agency } from "../types/agency"

export function useActiveAgencies() {
	return useQuery<Agency[]>({
		queryKey: agencyKeys.useActiveAgencies(),
		queryFn: getActiveAgencies,
	})
}

export function useAllAgencies() {
	return useQuery<Agency[]>({
		queryKey: agencyKeys.useAllAgencies(),
		queryFn: getAllAgencies,
	})
}

export function useAgency(id: string) {
	return useQuery<Agency | null>({
		queryKey: agencyKeys.useAgency(id),
		queryFn: () => getAgencyById(id),
		enabled: !!id,
	})
}

export function useCreateAgency() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (data: CreateAgency) => createAgency(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: agencyKeys.useAllAgencies() })
			toast.success("Agencia creada exitosamente")
		},
		onError: (error: Error) => {
			toast.error(error.message || "Error al crear la agencia")
		},
	})
}

export function useUpdateAgency() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (data: UpdateAgency) => updateAgency(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: agencyKeys.useAllAgencies() })
			toast.success("Agencia actualizada exitosamente")
		},
		onError: (error: Error) => {
			toast.error(error.message || "Error al actualizar la agencia")
		},
	})
}

export function useDeleteAgency() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: ({ id, reason }: { id: string; reason: string }) => deleteAgency(id, reason),
		onSuccess: (result) => {
			if (!result.success) {
				toast.error(result.error)
				return
			}
			queryClient.invalidateQueries({ queryKey: agencyKeys.useAllAgencies() })
			if (result.approvalRequired) {
				toast.success("Solicitud enviada. Te avisamos por email cuando se resuelva.")
			} else {
				toast.success("Agencia eliminada exitosamente")
			}
		},
		onError: (error: Error) => {
			toast.error(error.message || "Error al eliminar la agencia")
		},
	})
}

export function useToggleAgencyStatus() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (id: string) => toggleAgencyStatus(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: agencyKeys.useAllAgencies() })
			toast.success("Estado de la agencia actualizado")
		},
		onError: (error: Error) => {
			toast.error(error.message || "Error al cambiar el estado")
		},
	})
}
