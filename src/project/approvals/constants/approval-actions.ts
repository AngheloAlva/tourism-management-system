import { APPROVAL_ACTION, APPROVAL_STATUS } from "@/generated/prisma/enums"

export const APPROVAL_DOMAINS = [
  "events",
  "sales",
  "transfers",
  "receptions",
  "agencies",
  "providers",
  "users",
  "cash-flow",
  "commissions",
] as const

export type ApprovalDomain = (typeof APPROVAL_DOMAINS)[number]

export const ACTION_TO_DOMAIN: Record<APPROVAL_ACTION, ApprovalDomain> = {
  CANCEL_EVENT: "events",
  CANCEL_BOOKING: "events",
  LOCK_EVENT_EDIT: "events",
  CANCEL_TRANSFER: "transfers",
  DELETE_TRANSFER: "transfers",
  UPDATE_TRANSFER: "transfers",
  CANCEL_RECEPTION: "receptions",
  DELETE_RECEPTION: "receptions",
  DELETE_SALE_RECORD: "sales",
  CANCEL_SALE_RECORD: "sales",
  UPDATE_INVOICED_SALE: "sales",
  DELETE_AGENCY: "agencies",
  DELETE_PROVIDER: "providers",
  BAN_USER: "users",
  ANNUL_CASH_ENTRY: "cash-flow",
  CANCEL_COMMISSION_PAYMENT: "commissions",
}

export const APPROVAL_ACTION_LABELS: Record<APPROVAL_ACTION, string> = {
  CANCEL_EVENT: "Anular evento",
  CANCEL_BOOKING: "Anular reserva",
  LOCK_EVENT_EDIT: "Bloquear edición de evento",
  CANCEL_TRANSFER: "Anular traspaso",
  DELETE_TRANSFER: "Eliminar traspaso",
  UPDATE_TRANSFER: "Modificar traspaso",
  CANCEL_RECEPTION: "Anular recepción",
  DELETE_RECEPTION: "Eliminar recepción",
  DELETE_SALE_RECORD: "Eliminar venta",
  CANCEL_SALE_RECORD: "Anular venta",
  UPDATE_INVOICED_SALE: "Modificar venta facturada",
  DELETE_AGENCY: "Eliminar agencia",
  DELETE_PROVIDER: "Eliminar proveedor",
  BAN_USER: "Suspender usuario",
  ANNUL_CASH_ENTRY: "Anular entrada de caja",
  CANCEL_COMMISSION_PAYMENT: "Anular pago de comisión",
}

export const APPROVAL_STATUS_LABELS: Record<APPROVAL_STATUS, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  EXECUTED: "Ejecutada",
  REJECTED: "Rechazada",
  EXPIRED: "Expirada",
  INVALIDATED: "Anulada",
  FAILED: "Fallida",
}

export const APPROVAL_DOMAIN_LABELS: Record<ApprovalDomain, string> = {
  events: "Eventos",
  sales: "Ventas",
  transfers: "Traspasos",
  receptions: "Recepciones",
  agencies: "Agencias",
  providers: "Proveedores",
  users: "Usuarios",
  "cash-flow": "Flujo de Caja",
  commissions: "Comisiones",
}

/**
 * Feature flag por dominio.
 * PR2: activa events, sales, transfers, receptions.
 * PR3: agrega agencies, providers, users.
 * cash-flow y commissions quedan fuera hasta definición de negocio.
 */
export const APPROVAL_GATE_DOMAINS = new Set<ApprovalDomain>([
  "events",
  "sales",
  "transfers",
  "receptions",
  "agencies",
  "providers",
  "users",
])

export function isDomainGated(d: ApprovalDomain): boolean {
  return APPROVAL_GATE_DOMAINS.has(d)
}

export { APPROVAL_ACTION, APPROVAL_STATUS } from "@/generated/prisma/enums"
