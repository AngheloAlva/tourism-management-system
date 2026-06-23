import type { Executor } from "./types"

/**
 * Stub executor usado en PR1 para todos los actions del registry.
 * PR2/PR3 reemplazan los stubs con executors reales importados de cada dominio.
 */
export const notImplementedExecutor: Executor = async (_ctx) => {
  return {
    ok: false,
    error: "Executor no implementado — activo en PR2/PR3",
    retryable: false,
  }
}

/**
 * Stub específico para cash-flow y commissions: flag OFF en v1.
 * Requiere definición de negocio antes de activar.
 */
export const deferredExecutor: Executor = async (_ctx) => {
  return {
    ok: false,
    error: "No implementado en v1 — requiere definición de negocio",
    retryable: false,
  }
}
