"use server"

import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { AuditLog } from "@/generated/prisma/client"
import { USER_ROLE } from "@/project/users/constants/roles"

async function requireAuthUser() {
	const session = await auth.api.getSession({ headers: await headers() })
	if (!session?.user) throw new Error("No autenticado")
	return session.user
}

async function requireAdminUser() {
	const user = await requireAuthUser()
	if (user.role !== USER_ROLE.ADMIN) {
		throw new Error("No autorizado")
	}
	return user
}

export async function getAuditLogsByEntity(
	entityType: string,
	entityId: string
): Promise<{ logs: AuditLog[]; createdBy?: { name?: string; createdAt?: Date } }> {
	try {
		await requireAuthUser()

		const logs = await prisma.auditLog.findMany({
			where: {
				entityType,
				entityId,
			},
			orderBy: {
				createdAt: "desc",
			},
		})

		const sale = await prisma.saleRecord.findUnique({
			where: {
				id: entityId,
			},
			select: {
				createdAt: true,
				seller: {
					select: {
						name: true,
					},
				},
			},
		})

		return { logs, createdBy: { name: sale?.seller?.name, createdAt: sale?.createdAt } }
	} catch (error) {
		console.error("Error fetching audit logs:", error)
		throw new Error("Error al obtener los registros de auditoría")
	}
}

export async function getAuditLogsByUser(userId: string): Promise<AuditLog[]> {
	try {
		await requireAdminUser()

		const logs = await prisma.auditLog.findMany({
			where: {
				userId,
			},
			orderBy: {
				createdAt: "desc",
			},
			take: 100,
		})

		return logs
	} catch (error) {
		console.error("Error fetching user audit logs:", error)
		throw new Error("Error al obtener los registros de auditoría del usuario")
	}
}

export async function getRecentAuditLogs(limit: number = 50): Promise<AuditLog[]> {
	try {
		await requireAdminUser()

		const logs = await prisma.auditLog.findMany({
			orderBy: {
				createdAt: "desc",
			},
			take: limit,
		})

		return logs
	} catch (error) {
		console.error("Error fetching recent audit logs:", error)
		throw new Error("Error al obtener los registros recientes de auditoría")
	}
}
