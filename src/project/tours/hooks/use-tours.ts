import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
	getAllTours,
	getTourById,
	getActiveTours,
	createTour,
	updateTour,
	deleteTour,
	toggleTourStatus,
	getToursSummary,
	getTransferServices,
	updateTransferServicePricing,
	type TransferServiceItem,
	type ActiveTour,
} from "../actions/tour.actions"
import type { CreateTour, UpdateTour } from "../schemas/tour.schema"

// Re-exportar tipos para uso en componentes
export type {
	TourSummary,
	ActiveTour,
	ActiveTourPriceCategory,
	ActiveTourPriceCategorySource,
	ActiveTourEntry,
} from "../actions/tour.actions"
export type { TransferServiceItem } from "../actions/tour.actions"

// Query Keys
export const tourKeys = {
	all: ["tours"] as const,
	lists: () => [...tourKeys.all, "list"] as const,
	list: () => [...tourKeys.lists()] as const,
	active: () => [...tourKeys.all, "active"] as const,
	details: () => [...tourKeys.all, "detail"] as const,
	detail: (id: string) => [...tourKeys.details(), id] as const,
	summary: () => [...tourKeys.all, "summary"] as const,
	transferServices: () => [...tourKeys.all, "transfer-services"] as const,
}

/**
 * Hook para obtener todos los tours
 */
export function useTours() {
	return useQuery({
		queryKey: tourKeys.list(),
		queryFn: async () => {
			const result = await getAllTours()
			if (!result.success) throw new Error(result.error)
			return result.data
		},
	})
}

/**
 * Hook para obtener un tour por ID
 */
export function useTour(id: string) {
	return useQuery({
		queryKey: tourKeys.detail(id),
		queryFn: async () => {
			const result = await getTourById(id)
			if (!result.success) throw new Error(result.error)
			return result.data
		},
		enabled: !!id,
	})
}

/**
 * Hook para obtener tours activos
 */
export function useActiveTours() {
	return useQuery<ActiveTour[]>({
		queryKey: tourKeys.active(),
		queryFn: async () => {
			const result = await getActiveTours()
			if (!result.success) throw new Error(result.error)
			return result.data as ActiveTour[]
		},
	})
}

/**
 * Hook para obtener resumen de tours
 */
export function useToursSummary() {
	return useQuery({
		queryKey: tourKeys.summary(),
		queryFn: async () => {
			const result = await getToursSummary()
			if (!result.success) throw new Error(result.error)
			return result.data
		},
	})
}

export function useTransferServices() {
	return useQuery<TransferServiceItem[]>({
		queryKey: tourKeys.transferServices(),
		queryFn: async () => {
			const result = await getTransferServices()
			if (!result.success) throw new Error(result.error)
			return result.data as TransferServiceItem[]
		},
	})
}

export function useUpdateTransferServicePricing() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (data: {
			id: string
			pricePerPassenger: number
			receptionPricePerPassenger: number
			active?: boolean
		}) => {
			const result = await updateTransferServicePricing(data)
			if (!result.success) throw new Error(result.error)
			return result.data
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: tourKeys.transferServices() })
			queryClient.invalidateQueries({ queryKey: tourKeys.active() })
			queryClient.invalidateQueries({ queryKey: tourKeys.summary() })
		},
	})
}

/**
 * Hook para crear un tour
 */
export function useCreateTour() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (data: CreateTour) => {
			const result = await createTour(data)
			if (!result.success) throw new Error(result.error)
			return result.data
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: tourKeys.lists() })
			queryClient.invalidateQueries({ queryKey: tourKeys.active() })
			queryClient.invalidateQueries({ queryKey: tourKeys.summary() })
			toast.success("Tour creado exitosamente")
		},
		onError: (error: Error) => {
			toast.error(error.message || "Error al crear el tour")
		},
	})
}

/**
 * Hook para actualizar un tour
 */
export function useUpdateTour() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (data: UpdateTour) => {
			const result = await updateTour(data)
			if (!result.success) throw new Error(result.error)
			return result.data
		},
		onSuccess: (data: { id: string } | null | undefined) => {
			queryClient.invalidateQueries({ queryKey: tourKeys.lists() })
			queryClient.invalidateQueries({ queryKey: tourKeys.active() })
			queryClient.invalidateQueries({ queryKey: tourKeys.detail(data!.id) })
			queryClient.invalidateQueries({ queryKey: tourKeys.summary() })
			toast.success("Tour actualizado exitosamente")
		},
		onError: (error: Error) => {
			toast.error(error.message || "Error al actualizar el tour")
		},
	})
}

/**
 * Hook para eliminar un tour
 */
export function useDeleteTour() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (id: string) => {
			const result = await deleteTour(id)
			if (!result.success) throw new Error(result.error)
			return result
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: tourKeys.lists() })
			queryClient.invalidateQueries({ queryKey: tourKeys.active() })
			queryClient.invalidateQueries({ queryKey: tourKeys.summary() })
		},
	})
}

/**
 * Hook para cambiar el estado de un tour
 */
export function useToggleTourStatus() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
			const result = await toggleTourStatus(id, active)
			if (!result.success) throw new Error(result.error)
			return result.data
		},
		onSuccess: (data: { id: string } | null | undefined) => {
			queryClient.invalidateQueries({ queryKey: tourKeys.lists() })
			queryClient.invalidateQueries({ queryKey: tourKeys.active() })
			queryClient.invalidateQueries({ queryKey: tourKeys.detail(data!.id) })
			queryClient.invalidateQueries({ queryKey: tourKeys.summary() })
		},
	})
}
