/**
 * Typed constants for audit event taxonomy.
 * Stored in `metadata.event` — no Prisma migration required.
 */
export const AUDIT_EVENT = {
	USER_PASSWORD_RESET_BY_ADMIN: "USER_PASSWORD_RESET_BY_ADMIN",
	USER_2FA_ENABLED: "USER_2FA_ENABLED",
	USER_2FA_DISABLED: "USER_2FA_DISABLED",
	USER_2FA_BACKUP_CODES_REGENERATED: "USER_2FA_BACKUP_CODES_REGENERATED",
} as const

export type AuditEvent = (typeof AUDIT_EVENT)[keyof typeof AUDIT_EVENT]
