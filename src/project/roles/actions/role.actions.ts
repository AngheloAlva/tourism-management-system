"use server"

import { cache } from "react"
import { headers } from "next/headers"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { MODULE_DEFINITIONS, getModuleKeyFromPath } from "../constants/modules"
import {
	SYSTEM_ROLE_DEFINITIONS,
	SYSTEM_ROLE_KEY,
	getDefaultPermissionForRole,
} from "../constants/system-roles"

const SYSTEM_ROLE_KEYS = SYSTEM_ROLE_DEFINITIONS.map((role) => role.key)
const MODULE_KEYS = MODULE_DEFINITIONS.map((module) => module.key)

type RolePermissionInput = {
	moduleKey: string
	visible: boolean
	canInteract: boolean
}

async function getAuthUser() {
	const session = await auth.api.getSession({ headers: await headers() })
	if (!session?.user) throw new Error("No autenticado")
	return session.user
}

async function requireAdmin() {
	const user = await getAuthUser()
	if (user.role !== SYSTEM_ROLE_KEY.ADMIN) {
		throw new Error("No autorizado")
	}
	return user
}

export async function ensureSystemRoles() {
	const existingRoles = await prisma.role.findMany({
		where: {
			key: { in: SYSTEM_ROLE_KEYS },
		},
		select: {
			key: true,
		},
	})

	const existingRoleKeys = new Set(existingRoles.map((role) => role.key))
	const missingRoles = SYSTEM_ROLE_DEFINITIONS.filter(
		(role) => !existingRoleKeys.has(role.key)
	).map((role) => ({
		key: role.key,
		name: role.name,
		description: role.description,
		isSystem: true,
		isActive: true,
	}))

	if (missingRoles.length > 0) {
		await prisma.role.createMany({
			data: missingRoles,
			skipDuplicates: true,
		})
	}

	const systemRoles = await prisma.role.findMany({
		where: {
			key: { in: SYSTEM_ROLE_KEYS },
		},
		select: {
			id: true,
			key: true,
		},
	})

	if (systemRoles.length === 0) return

	const existingPermissions = await prisma.roleModulePermission.findMany({
		where: {
			roleId: { in: systemRoles.map((role) => role.id) },
			moduleKey: { in: MODULE_KEYS },
		},
		select: {
			roleId: true,
			moduleKey: true,
		},
	})

	const existingPermissionKeys = new Set(
		existingPermissions.map((permission) => `${permission.roleId}:${permission.moduleKey}`)
	)

	const missingPermissions = systemRoles.flatMap((role) =>
		MODULE_DEFINITIONS.flatMap((module) => {
			const permissionKey = `${role.id}:${module.key}`
			if (existingPermissionKeys.has(permissionKey)) return []

			const defaults = getDefaultPermissionForRole(role.key, module.key)
			return [
				{
					roleId: role.id,
					moduleKey: module.key,
					visible: defaults.visible,
					canInteract: defaults.canInteract,
				},
			]
		})
	)

	if (missingPermissions.length > 0) {
		await prisma.roleModulePermission.createMany({
			data: missingPermissions,
			skipDuplicates: true,
		})
	}
}

async function getUserRoleKey(userId: string, fallbackRole?: string | null) {
	const dbUser = await prisma.user.findUnique({
		where: { id: userId },
		select: { role: true },
	})

	return dbUser?.role || fallbackRole || SYSTEM_ROLE_KEY.USER
}

export const getCurrentUserAccess = cache(async () => {
	await ensureSystemRoles()
	const user = await getAuthUser()
	const roleKey = await getUserRoleKey(user.id, user.role)

	const role = await prisma.role.findUnique({
		where: { key: roleKey },
		include: {
			permissions: true,
		},
	})

	if (!role) {
		const fallback = await prisma.role.findUnique({
			where: { key: SYSTEM_ROLE_KEY.USER },
			include: { permissions: true },
		})

		return {
			roleKey: SYSTEM_ROLE_KEY.USER,
			isAdmin: false,
			permissions: Object.fromEntries(
				(fallback?.permissions || []).map((permission) => [
					permission.moduleKey,
					{ visible: permission.visible, canInteract: permission.canInteract },
				])
			),
		}
	}

	return {
		roleKey,
		isAdmin: roleKey === SYSTEM_ROLE_KEY.ADMIN,
		permissions: Object.fromEntries(
			role.permissions.map((permission) => [
				permission.moduleKey,
				{ visible: permission.visible, canInteract: permission.canInteract },
			])
		),
	}
})

export async function canCurrentUserAccessPath(pathname: string) {
	const access = await getCurrentUserAccess()
	if (access.isAdmin) return true

	const moduleKey = getModuleKeyFromPath(pathname)
	if (!moduleKey) return true

	return Boolean(access.permissions[moduleKey]?.visible)
}

export async function canCurrentUserInteractPath(pathname: string) {
	const access = await getCurrentUserAccess()
	if (access.isAdmin) return true

	const moduleKey = getModuleKeyFromPath(pathname)
	if (!moduleKey) return false

	return Boolean(access.permissions[moduleKey]?.canInteract)
}

export async function canCurrentUserInteractPaths(pathnames: string[]) {
	const access = await getCurrentUserAccess()
	if (access.isAdmin) return true

	for (const pathname of pathnames) {
		const moduleKey = getModuleKeyFromPath(pathname)
		if (moduleKey && access.permissions[moduleKey]?.canInteract) {
			return true
		}
	}

	return false
}

export async function getRolesWithPermissions() {
	await requireAdmin()
	await ensureSystemRoles()

	return prisma.role.findMany({
		include: {
			permissions: true,
		},
		orderBy: [{ isSystem: "desc" }, { name: "asc" }],
	})
}

export async function getAssignableRoles() {
	await requireAdmin()
	await ensureSystemRoles()

	return prisma.role.findMany({
		where: {
			isActive: true,
		},
		select: {
			key: true,
			name: true,
		},
		orderBy: [{ isSystem: "desc" }, { name: "asc" }],
	})
}

export async function createRole(input: { name: string; key: string; description?: string }) {
	await requireAdmin()

	const normalizedKey = input.key.trim().toLowerCase().replace(/\s+/g, "-")
	if (!normalizedKey) throw new Error("Debe indicar una clave válida")

	const role = await prisma.role.create({
		data: {
			name: input.name.trim(),
			key: normalizedKey,
			description: input.description?.trim() || null,
			isSystem: false,
			isActive: true,
		},
	})

	for (const module of MODULE_DEFINITIONS) {
		await prisma.roleModulePermission.create({
			data: {
				roleId: role.id,
				moduleKey: module.key,
				visible: false,
				canInteract: false,
			},
		})
	}

	return role
}

export async function updateRoleMeta(input: {
	roleId: string
	name: string
	description?: string
	isActive: boolean
}) {
	await requireAdmin()

	const existing = await prisma.role.findUnique({ where: { id: input.roleId } })
	if (!existing) throw new Error("Rol no encontrado")

	if (existing.isSystem && existing.key === SYSTEM_ROLE_KEY.ADMIN && !input.isActive) {
		throw new Error("No se puede desactivar el rol administrador")
	}

	return prisma.role.update({
		where: { id: input.roleId },
		data: {
			name: input.name.trim(),
			description: input.description?.trim() || null,
			isActive: input.isActive,
		},
	})
}

export async function updateRolePermissions(roleId: string, permissions: RolePermissionInput[]) {
	await requireAdmin()

	const role = await prisma.role.findUnique({ where: { id: roleId } })
	if (!role) throw new Error("Rol no encontrado")

	await prisma.$transaction(
		permissions.map((permission) =>
			prisma.roleModulePermission.upsert({
				where: {
					roleId_moduleKey: {
						roleId,
						moduleKey: permission.moduleKey,
					},
				},
				create: {
					roleId,
					moduleKey: permission.moduleKey,
					visible: permission.visible,
					canInteract: permission.visible ? permission.canInteract : false,
				},
				update: {
					visible: permission.visible,
					canInteract: permission.visible ? permission.canInteract : false,
				},
			})
		)
	)

	return { success: true }
}

export async function getRoleModuleDefinitions() {
	await requireAdmin()
	return MODULE_DEFINITIONS
}
