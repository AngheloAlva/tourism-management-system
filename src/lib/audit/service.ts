import { prisma } from "@/lib/prisma"
import { AUDIT_ACTION, Prisma } from "@/generated/prisma/client"
import { CreateAuditLogParams, AuditLogQueryOptions, AuditFieldValue } from "./types"
import { detectChanges, generateChangeDescription, prepareForStorage } from "./utils"

export class AuditService {
	static async createLog(params: CreateAuditLogParams) {
		const {
			action,
			entityType,
			entityId,
			user,
			changes,
			oldValues,
			newValues,
			metadata,
			description,
		} = params

		const finalDescription =
			description ||
			(changes ? generateChangeDescription(changes, entityType) : `${action} en ${entityType}`)

		return await prisma.auditLog.create({
			data: {
				action,
				entityType,
				entityId,
				userId: user.id,
				userName: user.name,
				userEmail: user.email,
				changes: changes ? prepareForStorage(changes) : undefined,
				oldValues: oldValues ? prepareForStorage(oldValues) : undefined,
				newValues: newValues ? prepareForStorage(newValues) : undefined,
				metadata: metadata || undefined,
				description: finalDescription,
			},
		})
	}

	static async logCreate(
		entityType: CreateAuditLogParams["entityType"],
		entityId: string,
		user: CreateAuditLogParams["user"],
		data: Record<string, AuditFieldValue>,
		metadata?: CreateAuditLogParams["metadata"]
	) {
		return await this.createLog({
			action: AUDIT_ACTION.CREATE,
			entityType,
			entityId,
			user,
			newValues: data,
			metadata,
			description: `Creó un nuevo registro de ${entityType}`,
		})
	}

	/**
	 * Registra la actualización de una entidad detectando cambios automáticamente
	 */
	static async logUpdate(
		entityType: CreateAuditLogParams["entityType"],
		entityId: string,
		user: CreateAuditLogParams["user"],
		oldData: Record<string, AuditFieldValue>,
		newData: Record<string, AuditFieldValue>,
		metadata?: CreateAuditLogParams["metadata"]
	) {
		const changes = detectChanges(oldData, newData)

		// No crear log si no hay cambios significativos
		if (Object.keys(changes).length === 0) {
			return null
		}

		return await this.createLog({
			action: AUDIT_ACTION.UPDATE,
			entityType,
			entityId,
			user,
			changes,
			oldValues: oldData,
			newValues: newData,
			metadata,
		})
	}

	/**
	 * Registra la eliminación de una entidad
	 */
	static async logDelete(
		entityType: CreateAuditLogParams["entityType"],
		entityId: string,
		user: CreateAuditLogParams["user"],
		data: Record<string, AuditFieldValue>,
		metadata?: CreateAuditLogParams["metadata"]
	) {
		return await this.createLog({
			action: AUDIT_ACTION.DELETE,
			entityType,
			entityId,
			user,
			oldValues: data,
			metadata,
			description: `Eliminó un registro de ${entityType}`,
		})
	}

	/**
	 * Obtiene el historial de auditoría con filtros
	 */
	static async getAuditLogs(options: AuditLogQueryOptions = {}) {
		const {
			entityType,
			entityId,
			userId,
			action,
			startDate,
			endDate,
			limit = 50,
			offset = 0,
		} = options

		const where: Prisma.AuditLogWhereInput = {}

		if (entityType) where.entityType = entityType
		if (entityId) where.entityId = entityId
		if (userId) where.userId = userId
		if (action) where.action = action
		if (startDate || endDate) {
			where.createdAt = {}
			if (startDate) where.createdAt.gte = startDate
			if (endDate) where.createdAt.lte = endDate
		}

		const [logs, total] = await Promise.all([
			prisma.auditLog.findMany({
				where,
				orderBy: { createdAt: "desc" },
				take: limit,
				skip: offset,
			}),
			prisma.auditLog.count({ where }),
		])

		return {
			logs,
			total,
			hasMore: offset + logs.length < total,
		}
	}

	/**
	 * Obtiene el historial de una entidad específica
	 */
	static async getEntityHistory(
		entityType: CreateAuditLogParams["entityType"],
		entityId: string,
		limit = 50
	) {
		return await this.getAuditLogs({
			entityType,
			entityId,
			limit,
		})
	}

	/**
	 * Obtiene estadísticas de auditoría
	 */
	static async getAuditStats(
		entityType?: CreateAuditLogParams["entityType"],
		startDate?: Date,
		endDate?: Date
	) {
		const where: Prisma.AuditLogWhereInput = {}
		if (entityType) where.entityType = entityType
		if (startDate || endDate) {
			where.createdAt = {}
			if (startDate) where.createdAt.gte = startDate
			if (endDate) where.createdAt.lte = endDate
		}

		const [total, byAction, byUser] = await Promise.all([
			prisma.auditLog.count({ where }),
			prisma.auditLog.groupBy({
				by: ["action"],
				where,
				_count: { action: true },
			}),
			prisma.auditLog.groupBy({
				by: ["userId"],
				where,
				_count: { userId: true },
				orderBy: { _count: { userId: "desc" } },
				take: 10,
			}),
		])

		return {
			total,
			byAction,
			byUser,
		}
	}
}
