/**
 * Computa el fingerprint de un target a partir de su updatedAt.
 * Se usa al crear la solicitud para detectar modificaciones posteriores.
 */
export function computeFingerprint(target: { updatedAt: Date }): string {
  return target.updatedAt.toISOString()
}

/**
 * Verifica si el fingerprint guardado coincide con el updatedAt actual del target.
 * - Si expected es null/undefined (legacy sin fingerprint): no validar → retorna true.
 * - Si actual es null/undefined: target no encontrado → retorna false.
 */
export function fingerprintMatches(
  expected: string | null | undefined,
  actual: Date | null | undefined
): boolean {
  if (!expected) return true // legacy sin fingerprint → no validar
  if (!actual) return false
  return expected === actual.toISOString()
}
