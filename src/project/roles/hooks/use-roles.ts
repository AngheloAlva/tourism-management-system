import { useQuery } from "@tanstack/react-query"

import {
	getRolesWithPermissions,
	getRoleModuleDefinitions,
	getCurrentUserAccess,
	getAssignableRoles,
} from "../actions/role.actions"

export interface AssignableRole {
	key: string
	name: string
}

export function useRolesWithPermissions() {
	return useQuery({
		queryKey: ["roles", "with-permissions"],
		queryFn: getRolesWithPermissions,
	})
}

export function useRoleModuleDefinitions() {
	return useQuery({
		queryKey: ["roles", "module-definitions"],
		queryFn: getRoleModuleDefinitions,
	})
}

export function useCurrentUserAccess() {
	return useQuery({
		queryKey: ["roles", "current-access"],
		queryFn: getCurrentUserAccess,
	})
}

export function useAssignableRoles(enabled = true) {
	return useQuery({
		queryKey: ["roles", "assignable"],
		queryFn: () => getAssignableRoles() as Promise<AssignableRole[]>,
		enabled,
		refetchOnWindowFocus: false,
	})
}
