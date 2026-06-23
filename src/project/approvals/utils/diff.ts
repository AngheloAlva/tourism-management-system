export interface DiffEntry {
  field: string
  before: unknown
  after: unknown
  changed: boolean
}

/**
 * Computa diff campo a campo entre snapshot al momento de pedir y estado actual.
 * Sin librería externa — comparación simple de valores primitivos.
 * Arrays y objects se comparan por JSON.stringify.
 */
export function computeDiff(
  snapshot: Record<string, unknown> | null | undefined,
  currentState: Record<string, unknown> | null | undefined
): DiffEntry[] {
  if (!snapshot && !currentState) return []

  const allKeys = new Set<string>([
    ...Object.keys(snapshot ?? {}),
    ...Object.keys(currentState ?? {}),
  ])

  const entries: DiffEntry[] = []

  for (const field of allKeys) {
    const before = snapshot?.[field]
    const after = currentState?.[field]
    const changed = !isEqual(before, after)

    entries.push({ field, before, after, changed })
  }

  return entries
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (a === undefined || b === undefined) return false
  if (typeof a !== typeof b) return false
  if (typeof a === "object") {
    return JSON.stringify(a) === JSON.stringify(b)
  }
  return false
}
