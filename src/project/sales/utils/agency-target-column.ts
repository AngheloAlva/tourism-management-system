/**
 * Agency resolution matrix — client-safe pure function.
 *
 * This duplicates the logic from `server/inline-edit-helpers.ts` so that
 * client components can determine editability without importing the server
 * file (which pulls in Prisma and is Node-only).
 *
 * The authoritative matrix lives in `inline-edit-helpers.ts` (used by server
 * actions). This file is the client-side mirror. Keep them in sync.
 *
 * | channel   | isWholesale | result              |
 * |-----------|-------------|---------------------|
 * | WHOLESALE | any         | "agencyId"          |
 * | ONLINE    | true        | "wholesaleAgencyId" |
 * | PHYSICAL  | true        | "wholesaleAgencyId" |
 * | AGENCY    | any         | null                |
 * | ONLINE    | false       | null                |
 * | PHYSICAL  | false       | null                |
 */
export function resolveAgencyTargetColumnClient(sale: {
	channel: string
	isWholesale: boolean
}): "agencyId" | "wholesaleAgencyId" | null {
	if (sale.channel === "WHOLESALE") {
		return "agencyId"
	}

	if (
		(sale.channel === "ONLINE" || sale.channel === "PHYSICAL") &&
		sale.isWholesale === true
	) {
		return "wholesaleAgencyId"
	}

	return null
}
