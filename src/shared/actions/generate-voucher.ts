"use server"

import { prisma } from "@/lib/prisma"

export const generateVoucherNumber = async () => {
	const counter = await prisma.voucherCounter.upsert({
		where: { id: "counter" },
		update: { code: { increment: 1 } },
		create: { id: "counter", code: 1 },
	})

	return counter.code
}

/**
 * Reads the voucher counter WITHOUT incrementing it and returns the number the
 * next created voucher would most likely get (current code + 1).
 *
 * This is a projection only: the definitive number is assigned at save time by
 * {@link generateVoucherNumber} and may differ if another sale/quote is created
 * first, or if the uniqueness-collision loop skips a value.
 */
export const peekNextVoucherNumber = async () => {
	const counter = await prisma.voucherCounter.findUnique({
		where: { id: "counter" },
	})

	return (counter?.code ?? 0) + 1
}
