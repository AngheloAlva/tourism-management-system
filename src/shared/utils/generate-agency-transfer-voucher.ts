import { prisma } from "@/lib/prisma"

/**
 * Internal helper — increments and returns the agency transfer voucher counter.
 * NOT a server action. Must only be called from already-authenticated server code.
 */
export async function generateAgencyTransferVoucherNumber() {
	const counter = await prisma.agencyTransferCounter.upsert({
		where: { id: "agency_transfer_counter" },
		update: { code: { increment: 1 } },
		create: { id: "agency_transfer_counter", code: 1 },
	})

	return counter.code
}
