import { APPROVAL_ACTION } from "@/generated/prisma/enums"
import type { Executor } from "./types"
import { notImplementedExecutor, deferredExecutor } from "./stubs"
import { cancelEventExecutor, cancelBookingExecutor } from "@/project/events/executors"
import {
  deleteSaleRecordExecutor,
  cancelSaleRecordExecutor,
  updateInvoicedSaleExecutor,
} from "@/project/sales/executors"
import {
  cancelTransferExecutor,
  deleteTransferExecutor,
  updateTransferExecutor,
} from "@/project/transfers/executors"
import { cancelReceptionExecutor, deleteReceptionExecutor } from "@/project/receptions/executors"
import { deleteAgencyExecutor } from "@/project/agency/executors"
import { deleteProviderExecutor } from "@/project/providers/executors"
import { banUserExecutor } from "@/project/users/executors"

/**
 * Registry estático de executors por action.
 * En PR1 todos los values apuntan a stubs.
 * PR2/PR3 importan executors reales de cada dominio y los reemplazan aquí.
 *
 * El tipo Record<APPROVAL_ACTION, Executor> garantiza exhaustividad en compilación:
 * si falta una key del enum, TypeScript rompe el build.
 */
export const APPROVAL_EXECUTORS: Record<APPROVAL_ACTION, Executor> = {
  // Events — implementado en PR2
  // Cast to Executor (= Executor<unknown>) is safe: the payload arrives as unknown
  // at runtime and each executor casts it internally.
  [APPROVAL_ACTION.CANCEL_EVENT]: cancelEventExecutor as Executor,
  [APPROVAL_ACTION.CANCEL_BOOKING]: cancelBookingExecutor as Executor,
  // LOCK_EVENT_EDIT deferred to v2 — semántica no definida con el cliente
  [APPROVAL_ACTION.LOCK_EVENT_EDIT]: notImplementedExecutor,

  // Transfers — implementado en PR2
  [APPROVAL_ACTION.CANCEL_TRANSFER]: cancelTransferExecutor as Executor,
  [APPROVAL_ACTION.DELETE_TRANSFER]: deleteTransferExecutor as Executor,
  [APPROVAL_ACTION.UPDATE_TRANSFER]: updateTransferExecutor as Executor,

  // Receptions — implementado en PR2
  [APPROVAL_ACTION.CANCEL_RECEPTION]: cancelReceptionExecutor as Executor,
  [APPROVAL_ACTION.DELETE_RECEPTION]: deleteReceptionExecutor as Executor,

  // Sales — implementado en PR2
  [APPROVAL_ACTION.DELETE_SALE_RECORD]: deleteSaleRecordExecutor as Executor,
  [APPROVAL_ACTION.CANCEL_SALE_RECORD]: cancelSaleRecordExecutor as Executor,
  [APPROVAL_ACTION.UPDATE_INVOICED_SALE]: updateInvoicedSaleExecutor as Executor,

  // Agencies — implementado en PR3
  [APPROVAL_ACTION.DELETE_AGENCY]: deleteAgencyExecutor as Executor,

  // Providers — implementado en PR3
  [APPROVAL_ACTION.DELETE_PROVIDER]: deleteProviderExecutor as Executor,

  // Users — implementado en PR3
  [APPROVAL_ACTION.BAN_USER]: banUserExecutor as Executor,

  // Cash-flow — deferred: flag OFF en v1, requiere definición de negocio
  // TODO: definir semántica de anulación con el cliente antes de activar flag
  [APPROVAL_ACTION.ANNUL_CASH_ENTRY]: deferredExecutor,

  // Commissions — deferred: flag OFF en v1, requiere definición de negocio
  // TODO: definir semántica de anulación con el cliente antes de activar flag
  [APPROVAL_ACTION.CANCEL_COMMISSION_PAYMENT]: deferredExecutor,
}

export function getExecutor(action: APPROVAL_ACTION): Executor {
  const fn = APPROVAL_EXECUTORS[action]
  if (!fn) throw new Error(`No hay executor registrado para la acción ${action}`)
  return fn
}
