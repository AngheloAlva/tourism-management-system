/**
 * Utilidad para detectar si los pagos que afectan al flujo de caja cambiaron
 * entre la versión anterior y la nueva versión de una venta.
 *
 * Solo se consideran "cash-affecting" los pagos con refund=false y amount > 0,
 * que es el mismo filtro que usa createSaleRecord al registrar entradas.
 */

export type CashRelevantPayment = {
  amount: number
  method: string
  currency: string
  refund: boolean
}

/**
 * Filtra los pagos que efectivamente generan una entrada de ingreso en caja
 * (mirrors the filter in createSaleRecord: !refund && amount > 0).
 */
function toCashAffecting(payments: CashRelevantPayment[]): CashRelevantPayment[] {
  return payments.filter((p) => !p.refund && p.amount > 0)
}

/**
 * Normaliza un pago a una clave canónica para comparación.
 * Incluye amount, method y currency — suficiente para detectar cambios de ingreso.
 */
function toCanonicalKey(p: CashRelevantPayment): string {
  return `${p.amount}|${p.method}|${p.currency}`
}

/**
 * Compara dos listas de pagos y retorna true si el conjunto de pagos que afectan
 * al flujo de caja cambió entre ambas listas.
 *
 * La comparación es insensible al orden (multiset), es decir, reordenar pagos
 * idénticos devuelve false.
 *
 * Casos que retornan false (no requieren recálculo):
 * - Ninguna lista tiene pagos cash-affecting
 * - Los pagos cash-affecting son idénticos (mismo monto/método/moneda, mismo conteo)
 * - Solo cambia el estado refund de un pago que ya no era cash-affecting
 * - Se agrega/elimina un pago con amount=0
 *
 * Casos que retornan true (requieren recálculo):
 * - Cambio en amount, method o currency de cualquier pago cash-affecting
 * - Se agrega o elimina un pago cash-affecting
 * - Un pago pasa de refund=false a refund=true (se elimina del conjunto cash-affecting)
 */
export function paymentsAffectingCashChanged(
  oldPayments: CashRelevantPayment[],
  newPayments: CashRelevantPayment[]
): boolean {
  const oldAffecting = toCashAffecting(oldPayments)
  const newAffecting = toCashAffecting(newPayments)

  if (oldAffecting.length !== newAffecting.length) return true

  // Construir multisets (Map<clave, conteo>)
  const buildMultiset = (payments: CashRelevantPayment[]): Map<string, number> => {
    const map = new Map<string, number>()
    for (const p of payments) {
      const key = toCanonicalKey(p)
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }

  const oldSet = buildMultiset(oldAffecting)
  const newSet = buildMultiset(newAffecting)

  // Verificar que oldSet === newSet
  for (const [key, count] of oldSet) {
    if ((newSet.get(key) ?? 0) !== count) return true
  }
  for (const [key, count] of newSet) {
    if ((oldSet.get(key) ?? 0) !== count) return true
  }

  return false
}
