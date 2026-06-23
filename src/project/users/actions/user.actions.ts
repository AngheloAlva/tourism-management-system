"use server"

import { headers } from "next/headers"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { canCurrentUserInteractPath } from "@/project/roles/actions/role.actions"
import { USER_ROLE } from "../constants/roles"
import { parseCalendarDay, formatCalendarDay } from "@/shared/utils/calendar-day"

import type { User, Prisma } from "@/generated/prisma/client"

export type UserWithStats = User & {
	_count: {
		sales: number
		sessions: number
	}
}

export interface PaginatedUsers {
	data: UserWithStats[]
	total: number
	page: number
	pageSize: number
}

const USER_SORTABLE_FIELDS = ["name", "role", "emailVerified", "banned", "createdAt"] as const
export type UserSortField = (typeof USER_SORTABLE_FIELDS)[number]
export type UserSort = { field: string; order: "asc" | "desc" }

async function getAuthUser() {
	const session = await auth.api.getSession({
		headers: await headers(),
	})

	if (!session?.user) {
		throw new Error("No autorizado")
	}

	return session.user
}

export async function getUsers(): Promise<UserWithStats[]> {
	await getAuthUser()

	const users = await prisma.user.findMany({
		include: {
			_count: {
				select: {
					sales: true,
					sessions: true,
				},
			},
		},
		orderBy: {
			createdAt: "desc",
		},
	})

	return users
}

export async function getPaginatedUsers(
	page = 1,
	pageSize = 50,
	search?: string,
	sort?: UserSort | null
): Promise<PaginatedUsers> {
	await getAuthUser()

	const where: Prisma.UserWhereInput = {}

	if (search?.trim()) {
		const term = search.trim()
		where.OR = [
			{ name: { contains: term, mode: "insensitive" } },
			{ email: { contains: term, mode: "insensitive" } },
		]
	}

	const isValidSort =
		sort && (USER_SORTABLE_FIELDS as readonly string[]).includes(sort.field)
	const orderBy: Prisma.UserOrderByWithRelationInput = isValidSort
		? { [sort.field]: sort.order }
		: { createdAt: "desc" }

	const [users, total] = await Promise.all([
		prisma.user.findMany({
			where,
			include: {
				_count: {
					select: {
						sales: true,
						sessions: true,
					},
				},
			},
			orderBy,
			skip: (page - 1) * pageSize,
			take: pageSize,
		}),
		prisma.user.count({ where }),
	])

	return {
		data: users,
		total,
		page,
		pageSize,
	}
}

export async function getUserById(id: string): Promise<UserWithStats | null> {
	await getAuthUser()

	const user = await prisma.user.findUnique({
		where: { id },
		include: {
			_count: {
				select: {
					sales: true,
					sessions: true,
				},
			},
		},
	})

	return user
}

export async function getUsersSummary() {
	await getAuthUser()

	const [totalUsers, activeUsers, bannedUsers] = await Promise.all([
		prisma.user.count(),

		prisma.user.count({
			where: {
				sessions: {
					some: {
						createdAt: {
							gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
						},
					},
				},
			},
		}),

		prisma.user.count({
			where: {
				banned: true,
			},
		}),
	])

	const startOfMonth = new Date()
	startOfMonth.setDate(1)
	startOfMonth.setHours(0, 0, 0, 0)

	const newUsersThisMonth = await prisma.user.count({
		where: {
			createdAt: {
				gte: startOfMonth,
			},
		},
	})

	return {
		totalUsers,
		activeUsers,
		bannedUsers,
		newUsersThisMonth,
	}
}

export async function getCurrentUserRole() {
	const user = await getAuthUser()
	return user.role || USER_ROLE.USER
}

export async function setUserRole(params: { userId: string; role: string }) {
	const [currentUser, canInteract] = await Promise.all([
		getAuthUser(),
		canCurrentUserInteractPath("/dashboard/usuarios"),
	])

	if (currentUser.role !== USER_ROLE.ADMIN || !canInteract) {
		throw new Error("No autorizado para asignar roles")
	}

	await prisma.user.update({
		where: {
			id: params.userId,
		},
		data: {
			role: params.role,
		},
	})

	return { success: true }
}

export async function updateUserAdditionalData(params: {
	userId: string
	rut: string
	phone: string
	birthDate: string
	workSchedule: string
}) {
	const [currentUser, canInteract] = await Promise.all([
		getAuthUser(),
		canCurrentUserInteractPath("/dashboard/usuarios"),
	])
	if (currentUser.role !== USER_ROLE.ADMIN || !canInteract) {
		throw new Error("No autorizado para actualizar datos de usuario")
	}

	const updatedUser = await prisma.user.update({
		where: { id: params.userId },
		data: {
			rut: params.rut,
			phone: params.phone,
			birthDate: parseCalendarDay(params.birthDate.slice(0, 10)),
			workSchedule: params.workSchedule,
		},
	})

	return updatedUser
}
