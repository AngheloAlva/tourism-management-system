"use server"

import { headers } from "next/headers"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

async function getAuthUser() {
	const session = await auth.api.getSession({
		headers: await headers(),
	})

	if (!session?.user) {
		throw new Error("No autenticado")
	}

	return session.user
}

export interface AuditLogEntry {
	id: string
	action: "CREATE" | "UPDATE" | "DELETE"
	entityType: string
	entityId: string
	userId: string | null
	userName: string
	userEmail: string
	changes: Record<string, unknown> | null
	oldValues: Record<string, unknown> | null
	newValues: Record<string, unknown> | null
	description: string | null
	metadata: Record<string, unknown> | null
	createdAt: Date
}

export async function getEventAuditLog(eventId: string): Promise<AuditLogEntry[]> {
	try {
		await getAuthUser()

		const entries = await prisma.auditLog.findMany({
			where: {
				entityType: "Event",
				entityId: eventId,
			},
			orderBy: {
				createdAt: "desc",
			},
			take: 50,
		})

		return entries.map((entry) => ({
			id: entry.id,
			action: entry.action as AuditLogEntry["action"],
			entityType: entry.entityType,
			entityId: entry.entityId,
			userId: entry.userId,
			userName: entry.userName,
			userEmail: entry.userEmail,
			changes: entry.changes as Record<string, unknown> | null,
			oldValues: entry.oldValues as Record<string, unknown> | null,
			newValues: entry.newValues as Record<string, unknown> | null,
			description: entry.description,
			metadata: entry.metadata as Record<string, unknown> | null,
			createdAt: entry.createdAt,
		}))
	} catch (error) {
		console.error("Error fetching event audit log:", error)
		throw new Error("Error al obtener historial de cambios")
	}
}
