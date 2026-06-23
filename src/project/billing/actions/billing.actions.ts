"use server"

import { startOfDay, endOfDay, startOfWeek, startOfMonth, format } from "date-fns"
import { headers } from "next/headers"
import { es } from "date-fns/locale"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { calculateBookingRevenue } from "@/project/sales/utils/booking-revenue"
import { getEventDisplayName } from "@/project/events/utils/event-display"

export type BillingSummary = {
	totalSales: number
	totalRevenue: number
	averageTicket: number
	totalQuotes: number
	conversionRate: number
}

export type SalesBySeller = {
	sellerId: string
	sellerName: string
	salesCount: number
	quotesCount: number
	revenue: number
	passengers: number
}

export type SalesByDate = {
	date: string
	salesCount: number
	revenue: number
	passengers: number
}

export type SalesByChannel = {
	channel: string
	salesCount: number
	revenue: number
	percentage: number
}

export type SalesByTour = {
	tourId: string
	tourName: string
	bookingsCount: number
	passengers: number
	revenue: number
}

export type BillingFilters = {
	startDate?: Date
	endDate?: Date
	sellerId?: string
	channel?: string
	tourId?: string
}

type ChannelType = "ONLINE" | "AGENCY" | "PHYSICAL" | "WHOLESALE"
type SaleType = "SALE" | "QUOTE"

async function getAuthUser() {
	const session = await auth.api.getSession({ headers: await headers() })
	if (!session) {
		throw new Error("No autorizado")
	}
	return session.user
}

export async function getBillingSummary(filters?: BillingFilters): Promise<BillingSummary> {
	await getAuthUser()

	const dateFilter: { gte?: Date; lte?: Date } = {}
	if (filters?.startDate) dateFilter.gte = startOfDay(filters.startDate)
	if (filters?.endDate) dateFilter.lte = endOfDay(filters.endDate)

	const [salesData, quotesData] = await Promise.all([
		prisma.saleRecord.findMany({
			where: {
				type: "SALE" as SaleType,
				...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
				...(filters?.sellerId ? { sellerId: filters.sellerId } : {}),
				...(filters?.channel ? { channel: filters.channel as ChannelType } : {}),
			},
			include: {
				paymentRecords: true,
			},
		}),
		prisma.saleRecord.count({
			where: {
				type: "QUOTE" as SaleType,
				...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
				...(filters?.sellerId ? { sellerId: filters.sellerId } : {}),
				...(filters?.channel ? { channel: filters.channel as ChannelType } : {}),
			},
		}),
	])

	const totalSales = salesData.length
	const totalQuotes = quotesData
	const totalRevenue = salesData.reduce(
		(sum, sale) =>
			sum + sale.paymentRecords.filter((p) => !p.refund).reduce((s, p) => s + p.amount, 0),
		0
	)
	const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0
	const conversionRate = totalQuotes > 0 ? (totalSales / (totalSales + totalQuotes)) * 100 : 0

	return {
		totalSales,
		totalRevenue,
		averageTicket,
		totalQuotes,
		conversionRate,
	}
}

export async function getSalesBySeller(filters?: BillingFilters): Promise<SalesBySeller[]> {
	await getAuthUser()

	const dateFilter: { gte?: Date; lte?: Date } = {}
	if (filters?.startDate) dateFilter.gte = startOfDay(filters.startDate)
	if (filters?.endDate) dateFilter.lte = endOfDay(filters.endDate)

	const sales = await prisma.saleRecord.findMany({
		where: {
			...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
		},
		include: {
			seller: { select: { id: true, name: true } },
			paymentRecords: true,
			passengers: true,
		},
	})

	const sellerMap = new Map<string, SalesBySeller>()

	for (const sale of sales) {
		const existing = sellerMap.get(sale.sellerId) || {
			sellerId: sale.sellerId,
			sellerName: sale.seller.name,
			salesCount: 0,
			quotesCount: 0,
			revenue: 0,
			passengers: 0,
		}

		if (sale.type === "SALE") {
			existing.salesCount++
			existing.revenue += sale.paymentRecords
				.filter((p) => !p.refund)
				.reduce((s, p) => s + p.amount, 0)
		} else {
			existing.quotesCount++
		}

		existing.passengers += sale.passengers.length

		sellerMap.set(sale.sellerId, existing)
	}

	return Array.from(sellerMap.values()).sort((a, b) => b.revenue - a.revenue)
}

export async function getSalesByDate(
	filters?: BillingFilters,
	groupBy: "day" | "week" | "month" = "day"
): Promise<SalesByDate[]> {
	await getAuthUser()

	const dateFilter: { gte?: Date; lte?: Date } = {}
	if (filters?.startDate) dateFilter.gte = startOfDay(filters.startDate)
	if (filters?.endDate) dateFilter.lte = endOfDay(filters.endDate)

	const sales = await prisma.saleRecord.findMany({
		where: {
			type: "SALE" as SaleType,
			...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
			...(filters?.sellerId ? { sellerId: filters.sellerId } : {}),
			...(filters?.channel ? { channel: filters.channel as ChannelType } : {}),
		},
		include: {
			paymentRecords: true,
			passengers: true,
		},
		orderBy: { createdAt: "asc" },
	})

	const dateMap = new Map<string, SalesByDate>()

	for (const sale of sales) {
		let dateKey: string

		switch (groupBy) {
			case "week":
				dateKey = format(startOfWeek(sale.createdAt, { weekStartsOn: 1 }), "yyyy-MM-dd", {
					locale: es,
				})
				break
			case "month":
				dateKey = format(startOfMonth(sale.createdAt), "yyyy-MM", { locale: es })
				break
			default:
				dateKey = format(sale.createdAt, "yyyy-MM-dd", { locale: es })
		}

		const existing = dateMap.get(dateKey) || {
			date: dateKey,
			salesCount: 0,
			revenue: 0,
			passengers: 0,
		}

		existing.salesCount++
		existing.revenue += sale.paymentRecords
			.filter((p) => !p.refund)
			.reduce((s, p) => s + p.amount, 0)
		existing.passengers += sale.passengers.length

		dateMap.set(dateKey, existing)
	}

	return Array.from(dateMap.values())
}

export async function getSalesByChannel(filters?: BillingFilters): Promise<SalesByChannel[]> {
	await getAuthUser()

	const dateFilter: { gte?: Date; lte?: Date } = {}
	if (filters?.startDate) dateFilter.gte = startOfDay(filters.startDate)
	if (filters?.endDate) dateFilter.lte = endOfDay(filters.endDate)

	const sales = await prisma.saleRecord.findMany({
		where: {
			type: "SALE" as SaleType,
			...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
			...(filters?.sellerId ? { sellerId: filters.sellerId } : {}),
		},
		include: {
			paymentRecords: true,
		},
	})

	const channelMap = new Map<string, { count: number; revenue: number }>()
	let totalRevenue = 0

	for (const sale of sales) {
		const existing = channelMap.get(sale.channel) || { count: 0, revenue: 0 }
		const saleRevenue = sale.paymentRecords
			.filter((p) => !p.refund)
			.reduce((s, p) => s + p.amount, 0)

		existing.count++
		existing.revenue += saleRevenue
		totalRevenue += saleRevenue

		channelMap.set(sale.channel, existing)
	}

	const channelLabels: Record<string, string> = {
		ONLINE: "Online",
		AGENCY: "Agencia",
		PHYSICAL: "Presencial",
		WHOLESALE: "Mayorista",
	}

	return Array.from(channelMap.entries()).map(([channel, data]) => ({
		channel: channelLabels[channel] || channel,
		salesCount: data.count,
		revenue: data.revenue,
		percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
	}))
}

export async function getSalesByTour(filters?: BillingFilters): Promise<SalesByTour[]> {
	await getAuthUser()

	const dateFilter: { gte?: Date; lte?: Date } = {}
	if (filters?.startDate) dateFilter.gte = startOfDay(filters.startDate)
	if (filters?.endDate) dateFilter.lte = endOfDay(filters.endDate)

	const bookings = await prisma.eventBooking.findMany({
		where: {
			saleRecord: {
				type: "SALE" as SaleType,
				...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
				...(filters?.sellerId ? { sellerId: filters.sellerId } : {}),
				...(filters?.channel ? { channel: filters.channel as ChannelType } : {}),
			},
		},
		include: {
			priceEntries: {
				select: { count: true, priceSnapshot: true, receptionSnapshot: true },
			},
			entrySnapshots: {
				select: { count: true, priceSnapshot: true },
			},
			event: {
				include: {
					tour: { select: { id: true, name: true } },
					transferService: { select: { id: true, name: true } },
				},
			},
		},
	})

	const tourMap = new Map<string, SalesByTour>()

	for (const booking of bookings) {
		const tourId = booking.event.tourId
		const tourName = booking.event.tour?.name

		if (!tourId || !tourName) {
			continue
		}

		const existing = tourMap.get(tourId) || {
			tourId,
			tourName,
			bookingsCount: 0,
			passengers: 0,
			revenue: 0,
		}

		existing.bookingsCount++
		existing.passengers += booking.passengerCount

		const revenue = calculateBookingRevenue(booking.priceEntries || [], booking.entrySnapshots || [])
		existing.revenue += revenue.grandTotal

		tourMap.set(tourId, existing)
	}

	return Array.from(tourMap.values()).sort((a, b) => b.revenue - a.revenue)
}

export async function getSellers() {
	await getAuthUser()

	const sellers = await prisma.user.findMany({
		where: {
			sales: {
				some: {},
			},
		},
		select: {
			id: true,
			name: true,
		},
		orderBy: { name: "asc" },
	})

	return sellers
}

export async function getRecentSales(filters?: BillingFilters, limit = 20) {
	await getAuthUser()

	const dateFilter: { gte?: Date; lte?: Date } = {}
	if (filters?.startDate) dateFilter.gte = startOfDay(filters.startDate)
	if (filters?.endDate) dateFilter.lte = endOfDay(filters.endDate)

	const sales = await prisma.saleRecord.findMany({
		where: {
			type: "SALE" as SaleType,
			...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
			...(filters?.sellerId ? { sellerId: filters.sellerId } : {}),
			...(filters?.channel ? { channel: filters.channel as ChannelType } : {}),
		},
		include: {
			seller: { select: { id: true, name: true } },
			paymentRecords: true,
			passengers: true,
			eventBookings: {
				include: {
					event: {
						include: {
							tour: { select: { id: true, name: true } },
							transferService: { select: { id: true, name: true } },
						},
					},
				},
			},
		},
		orderBy: { createdAt: "desc" },
		take: limit,
	})

	return sales.map((sale) => ({
		id: sale.id,
		voucher: sale.voucher,
		date: sale.createdAt,
		seller: sale.seller.name,
		channel: sale.channel,
		tours: sale.eventBookings.map((b) => getEventDisplayName(b.event)).join(", "),
		passengers: sale.passengers.length,
		revenue: sale.paymentRecords.filter((p) => !p.refund).reduce((s, p) => s + p.amount, 0),
	}))
}
