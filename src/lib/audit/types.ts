import { AUDIT_ACTION } from "@/generated/prisma/client"

export type AuditableEntity =
	| "SaleRecord"
	| "EventDetail"
	| "Event"
	| "EventBooking"
	| "Passenger"
	| "PaymentRecord"
	| "Agency"
	| "Tour"
	| "AgencyTransfer"
	| "User"
	| "ApprovalRequest"

export interface AuditUser {
	id?: string
	name: string
	email: string
}

// Tipos permitidos en los campos de auditoría
export type AuditFieldValue =
	| string
	| number
	| boolean
	| null
	| Date
	| string[]
	| number[]
	| Record<string, string | number | boolean | null>

export interface FieldChange {
	before: AuditFieldValue
	after: AuditFieldValue
}

export type ChangeMap = Record<string, FieldChange>

export interface AuditMetadata {
	ip?: string
	userAgent?: string
	requestId?: string
	[key: string]: string | number | boolean | null | undefined
}

export interface CreateAuditLogParams {
	action: AUDIT_ACTION
	entityType: AuditableEntity
	entityId: string
	user: AuditUser
	changes?: ChangeMap
	oldValues?: Record<string, AuditFieldValue>
	newValues?: Record<string, AuditFieldValue>
	metadata?: AuditMetadata
	description?: string
}

export interface AuditLogQueryOptions {
	entityType?: AuditableEntity
	entityId?: string
	userId?: string
	action?: AUDIT_ACTION
	startDate?: Date
	endDate?: Date
	limit?: number
	offset?: number
}

export const EXCLUDED_AUDIT_FIELDS = ["id", "createdAt", "updatedAt"] as const
