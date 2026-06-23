import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
	getProviders,
	createProvider,
	updateProvider,
	deleteProvider,
	getProviderById,
	getCateringOptions,
	getProvidersSummary,
	toggleProviderStatus,
	createCateringOption,
	type ProviderWithCatering,
} from "../actions/provider.actions"

import type { ProviderFormData } from "../schemas/provider.schema"
import { toast } from "sonner"

export const providerKeys = {
	all: ["providers"] as const,
	lists: () => [...providerKeys.all, "list"] as const,
	list: () => [...providerKeys.lists()] as const,
	details: () => [...providerKeys.all, "detail"] as const,
	detail: (id: string) => [...providerKeys.details(), id] as const,
	summary: () => [...providerKeys.all, "summary"] as const,
}

export function useProviders() {
	return useQuery<ProviderWithCatering[]>({
		queryKey: providerKeys.list(),
		queryFn: async () => {
			const result = await getProviders()
			if (!result.success) throw new Error(result.error)
			return result.data || []
		},
	})
}

export function useProvider(id: string | undefined) {
	return useQuery({
		queryKey: providerKeys.detail(id || ""),
		queryFn: async () => {
			if (!id) throw new Error("ID no proporcionado")
			const result = await getProviderById(id)
			if (!result.success) throw new Error(result.error)
			return result.data
		},
		enabled: !!id,
	})
}

export function useProvidersSummary() {
	return useQuery({
		queryKey: providerKeys.summary(),
		queryFn: async () => {
			const result = await getProvidersSummary()
			if (!result.success) throw new Error(result.error)
			return result.data
		},
	})
}

export function useCreateProvider() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (data: ProviderFormData) => {
			const result = await createProvider(data)
			if (!result.success) throw new Error(result.error)
			return result.data
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: providerKeys.lists() })
			queryClient.invalidateQueries({ queryKey: providerKeys.summary() })
		},
	})
}

export function useUpdateProvider() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({ id, data }: { id: string; data: ProviderFormData }) => {
			const result = await updateProvider(id, data)
			if (!result.success) throw new Error(result.error)
			return result.data
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: providerKeys.lists() })
			queryClient.invalidateQueries({ queryKey: providerKeys.detail(data!.id) })
			queryClient.invalidateQueries({ queryKey: providerKeys.summary() })
		},
	})
}

export function useDeleteProvider() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
			const result = await deleteProvider(id, reason)
			if (!result.success) throw new Error(result.error)
			return result
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: providerKeys.lists() })
			queryClient.invalidateQueries({ queryKey: providerKeys.summary() })
		},
	})
}

export function useToggleProviderStatus() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
			const result = await toggleProviderStatus(id, active)
			if (!result.success) throw new Error(result.error)
			return result.data
		},
		onSuccess: (data) => {
			toast.success("Estado actualizado correctamente")

			queryClient.invalidateQueries({ queryKey: providerKeys.lists() })
			queryClient.invalidateQueries({ queryKey: providerKeys.detail(data!.id) })
			queryClient.invalidateQueries({ queryKey: providerKeys.summary() })
		},
	})
}

export function useCateringOptions() {
	return useQuery({
		queryKey: ["catering-options"],
		queryFn: async () => {
			const result = await getCateringOptions()
			if (!result.success) throw new Error(result.error)
			return result.data
		},
	})
}

export function useCreateCateringOption() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (name: string) => {
			const result = await createCateringOption(name)
			if (!result.success) throw new Error(result.error)
			return result.data
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["catering-options"] })
			toast.success("Opción de catering creada correctamente")
		},
	})
}
