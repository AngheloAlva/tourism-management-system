import type { ApprovalDomain } from "../constants/approval-actions"

type SnapshotTarget = Record<string, unknown>

/**
 * Campos incluidos en el snapshot por dominio.
 * Limitado a campos clave para visualización en la bandeja — no serializar relaciones completas.
 */
const SNAPSHOT_FIELDS: Record<ApprovalDomain, string[]> = {
  events: ["id", "status", "date", "tourName", "capacity", "cancelledAt"],
  sales: ["id", "status", "voucher", "totalAmount", "customerName", "type", "channel"],
  transfers: ["id", "status", "date", "type", "passengerCount"],
  receptions: ["id", "status", "date", "passengerCount"],
  agencies: ["id", "name", "active", "contactEmail"],
  providers: ["id", "name", "active"],
  users: ["id", "name", "email", "role", "banned"],
  "cash-flow": ["id", "amount", "description", "date", "type"],
  commissions: ["id", "amount", "status", "paidAt"],
}

/**
 * Construye un snapshot reducido del target con solo los campos clave por dominio.
 * Si el target no tiene el campo, se omite silenciosamente.
 */
export function buildSnapshot(domain: ApprovalDomain, target: SnapshotTarget): Record<string, unknown> {
  const fields = SNAPSHOT_FIELDS[domain] ?? Object.keys(target)
  const snapshot: Record<string, unknown> = {}

  for (const field of fields) {
    if (field in target) {
      snapshot[field] = target[field]
    }
  }

  return snapshot
}
