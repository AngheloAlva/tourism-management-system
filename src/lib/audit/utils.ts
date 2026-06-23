import { ChangeMap, EXCLUDED_AUDIT_FIELDS, AuditFieldValue } from "./types"
import { Prisma } from "@/generated/prisma/client"

export function detectChanges(
	oldData: Record<string, AuditFieldValue>,
	newData: Record<string, AuditFieldValue>,
	excludeFields: string[] = []
): ChangeMap {
	const changes: ChangeMap = {}
	const fieldsToExclude = [...EXCLUDED_AUDIT_FIELDS, ...excludeFields]

	const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)])

	for (const key of allKeys) {
		if (fieldsToExclude.includes(key)) {
			continue
		}

		const oldValue = oldData[key]
		const newValue = newData[key]

		if (!areValuesEqual(oldValue, newValue)) {
			changes[key] = {
				before: oldValue,
				after: newValue,
			}
		}
	}

	return changes
}

function areValuesEqual(a: AuditFieldValue, b: AuditFieldValue): boolean {
	if (a === b) return true
	if (a == null && b == null) return true
	if (a == null || b == null) return false

	if (a instanceof Date && b instanceof Date) {
		return a.getTime() === b.getTime()
	}

	if (typeof a === "object" && typeof b === "object") {
		return JSON.stringify(a) === JSON.stringify(b)
	}

	return false
}

export function generateChangeDescription(changes: ChangeMap, entityType: string): string {
	const changedFields = Object.keys(changes)

	if (changedFields.length === 0) {
		return `${entityType} sin cambios`
	}

	if (changedFields.length === 1) {
		const field = changedFields[0]
		return `Modificó el campo '${formatFieldName(field)}' de ${entityType}`
	}

	const fieldList = changedFields.map((f) => `'${formatFieldName(f)}'`).join(", ")

	return `Modificó ${changedFields.length} campos de ${entityType}: ${fieldList}`
}

function formatFieldName(field: string): string {
	return field
		.replace(/([A-Z])/g, " $1")
		.toLowerCase()
		.trim()
}

export function sanitizeValue(value: AuditFieldValue): AuditFieldValue {
	if (typeof value === "string") {
		if (value.includes("@")) {
			const [user, domain] = value.split("@")
			return `${user.slice(0, 2)}***@${domain}`
		}
	}
	return value
}

export function prepareForStorage(
	obj: Record<string, AuditFieldValue> | ChangeMap
): Prisma.InputJsonValue {
	const result: Record<string, Prisma.JsonValue> = {}

	for (const [key, value] of Object.entries(obj)) {
		if (value === null || value === undefined) {
			result[key] = null
		} else if (value instanceof Date) {
			result[key] = value.toISOString()
		} else if (Array.isArray(value)) {
			result[key] = value
		} else if (typeof value === "object" && "before" in value && "after" in value) {
			// Es un FieldChange
			result[key] = {
				before: convertToJsonValue(value.before),
				after: convertToJsonValue(value.after),
			}
		} else if (typeof value === "object") {
			result[key] = value as Record<string, Prisma.JsonValue>
		} else {
			result[key] = value
		}
	}

	return result
}

function convertToJsonValue(value: AuditFieldValue): Prisma.JsonValue {
	if (value === null) return null
	if (value instanceof Date) return value.toISOString()
	if (Array.isArray(value)) return value
	if (typeof value === "object") return value as Record<string, Prisma.JsonValue>
	return value
}
