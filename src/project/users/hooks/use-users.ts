import { useQuery } from "@tanstack/react-query"

import {
	getUsers,
	getPaginatedUsers,
	getUserById,
	getUsersSummary,
	getCurrentUserRole,
	type PaginatedUsers,
	type UserSort,
} from "../actions/user.actions"

export function useUsers() {
	return useQuery({
		queryKey: ["users"],
		queryFn: getUsers,
		staleTime: 1000 * 60, // 1 minuto
		refetchOnWindowFocus: false,
	})
}

export function usePaginatedUsers(
	page = 1,
	pageSize = 50,
	search?: string,
	sort?: UserSort | null
) {
	return useQuery<PaginatedUsers>({
		queryKey: ["users", "paginated", page, pageSize, search, sort],
		queryFn: () => getPaginatedUsers(page, pageSize, search, sort),
		placeholderData: (previousData) => previousData,
		staleTime: 1000 * 60,
		refetchOnWindowFocus: false,
	})
}

export function useUser(id: string) {
	return useQuery({
		queryKey: ["users", id],
		queryFn: () => getUserById(id),
		enabled: !!id,
		staleTime: 1000 * 60, // 1 minuto
		refetchOnWindowFocus: false,
	})
}

export function useUsersSummary() {
	return useQuery({
		queryKey: ["users", "summary"],
		queryFn: getUsersSummary,
		staleTime: 1000 * 60, // 1 minuto
		refetchOnWindowFocus: false,
	})
}

export function useCurrentUserRole() {
	return useQuery({
		queryKey: ["users", "me", "role"],
		queryFn: getCurrentUserRole,
		staleTime: 1000 * 60,
		refetchOnWindowFocus: false,
	})
}
