/**
 * Seller-attribution helpers for the seed pipeline.
 *
 * These utilities resolve a seller user ID from the raw strings stored in the
 * historical CSV export ("Vendedor" / "Created By" columns). The attribution
 * rule is:
 *
 *   1. If Vendedor resolves to a known user → use that user (they are the
 *      REAL seller even if someone else entered the record).
 *   2. If Vendedor is not a known user (blank, agency name, "ANULADO", …) →
 *      fall back to Created By.
 *   3. If neither resolves → use the admin fallback ID.
 */

/** Known name aliases: maps a raw spelling → canonical spelling in the users map. */
const NAME_ALIASES: Record<string, string> = {
  "Griselle Torres": "Grisselle Torres",
}

/**
 * Normalises a person's name for map lookup.
 * - Trims whitespace.
 * - Applies known aliases.
 * - Lower-cases for comparison (the map key should also be lower-cased via this function).
 */
export function normalizeSellerName(raw: string): string {
  const trimmed = raw.trim()
  const aliased = NAME_ALIASES[trimmed] ?? trimmed
  return aliased.toLowerCase()
}

/**
 * Picks the seller user ID from the raw "Vendedor" and "Created By" values.
 *
 * @param users    Map of normalizeSellerName(name) → userId for all known users.
 * @param adminId  Fallback user ID when neither field resolves.
 * @param vendedor Raw value of the "Vendedor" field (may be an agency name, blank, or "ANULADO").
 * @param createdBy Raw value of the "Created By" field.
 */
export function pickSellerId(
  users: Map<string, string>,
  adminId: string,
  vendedor: string,
  createdBy: string,
): string {
  // 1. Try Vendedor first — real sellers are recorded here for direct sales.
  const vendedorKey = normalizeSellerName(vendedor)
  if (vendedorKey && users.has(vendedorKey)) {
    return users.get(vendedorKey)!
  }

  // 2. Fall back to Created By (wholesale/agency sales store the agency in Vendedor).
  const createdByKey = normalizeSellerName(createdBy)
  if (createdByKey && users.has(createdByKey)) {
    return users.get(createdByKey)!
  }

  // 3. Neither resolved → admin fallback.
  return adminId
}
