"use server"

import { headers } from "next/headers"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export interface VoucherSearchResult {
	id: string
	voucher: number
	type: "SALE" | "QUOTE"
	clientEmail: string | null
	passengerNames: string[]
	eventCount: number
	createdAt: Date
}

async function getAuthUser() {
	const session = await auth.api.getSession({
		headers: await headers(),
	})

	if (!session?.user) {
		throw new Error("No autenticado")
	}

	return session.user
}

export async function searchVouchers(
	query: string,
	type?: "SALE" | "QUOTE"
): Promise<VoucherSearchResult[]> {
	try {
		await getAuthUser()

		const searchQuery = query.trim()

		if (!searchQuery) {
			const records = await prisma.saleRecord.findMany({
				where: type ? { type } : undefined,
				include: {
					passengers: {
						select: {
							name: true,
						},
					},
					eventBookings: {
						select: {
							id: true,
						},
					},
				},
				orderBy: {
					createdAt: "desc",
				},
				take: 20,
			})

			return records.map((record) => ({
				id: record.id,
				voucher: record.voucher,
				type: record.type as "SALE" | "QUOTE",
				clientEmail: record.clientEmail,
				passengerNames: record.passengers.map((p) => p.name || "Sin nombre"),
				eventCount: record.eventBookings.length,
				createdAt: record.createdAt,
			}))
		}

		const voucherNumber = parseInt(searchQuery)
		const isNumericSearch = !isNaN(voucherNumber)

		const records = await prisma.saleRecord.findMany({
			where: {
				AND: [
					type ? { type } : {},
					{
						OR: [
							isNumericSearch
								? {
										voucher: {
											equals: voucherNumber,
										},
									}
								: {},

							{
								clientEmail: {
									contains: searchQuery,
									mode: "insensitive",
								},
							},

							{
								passengers: {
									some: {
										name: {
											contains: searchQuery,
											mode: "insensitive",
										},
									},
								},
							},
						],
					},
				],
			},
			include: {
				passengers: {
					select: {
						name: true,
					},
				},
				eventBookings: {
					select: {
						id: true,
					},
				},
			},
			orderBy: {
				createdAt: "desc",
			},
			take: 50,
		})

		return records.map((record) => ({
			id: record.id,
			voucher: record.voucher,
			type: record.type as "SALE" | "QUOTE",
			clientEmail: record.clientEmail,
			passengerNames: record.passengers.map((p) => p.name || "Sin nombre"),
			eventCount: record.eventBookings.length,
			createdAt: record.createdAt,
		}))
	} catch (error) {
		console.error("Error searching vouchers:", error)
		throw new Error("Error al buscar vouchers")
	}
}
