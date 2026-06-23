"use server"

import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { startOfMonth, endOfMonth, subMonths, subYears, addDays, format } from "date-fns"
import { es } from "date-fns/locale"
import { getEventDisplayName } from "@/project/events/utils/event-display"

async function getAuthUser() {
	const session = await auth.api.getSession({ headers: await headers() })
	if (!session?.user) throw new Error("No autenticado")
	return session.user
}

export async function getDashboardStats() {
	await getAuthUser()
	const now = new Date()
	const startOfCurrentMonth = startOfMonth(now)
	const endOfCurrentMonth = endOfMonth(now)
	const startOfLastMonth = startOfMonth(subMonths(now, 1))
	const endOfLastMonth = endOfMonth(subMonths(now, 1))
	const startOfSameMonthLastYear = startOfMonth(subYears(now, 1))
	const endOfSameMonthLastYear = endOfMonth(subYears(now, 1))

	const [
		salesThisMonth,
		salesLastMonth,
		salesSameMonthLastYear,
		incomeThisMonth,
		incomeLastMonth,
		incomeSameMonthLastYear,
		pendingQuotes,
		activeServices,
		passengersThisMonth,
		activeTours,
		activeAgencies,
		pendingTransfers,
		pendingReceptions,
	] = await Promise.all([
		prisma.saleRecord.count({
			where: {
				type: "SALE",
				createdAt: { gte: startOfCurrentMonth, lte: endOfCurrentMonth },
			},
		}),
		prisma.saleRecord.count({
			where: {
				type: "SALE",
				createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
			},
		}),
		prisma.saleRecord.count({
			where: {
				type: "SALE",
				createdAt: { gte: startOfSameMonthLastYear, lte: endOfSameMonthLastYear },
			},
		}),
		prisma.paymentRecord.aggregate({
			where: {
				refund: false,
				date: { gte: startOfCurrentMonth, lte: endOfCurrentMonth },
			},
			_sum: { amount: true },
		}),
		prisma.paymentRecord.aggregate({
			where: {
				refund: false,
				date: { gte: startOfLastMonth, lte: endOfLastMonth },
			},
			_sum: { amount: true },
		}),
		prisma.paymentRecord.aggregate({
			where: {
				refund: false,
				date: { gte: startOfSameMonthLastYear, lte: endOfSameMonthLastYear },
			},
			_sum: { amount: true },
		}),
		prisma.saleRecord.count({
			where: { type: "QUOTE", status: "TO_BE_DONE" },
		}),
		prisma.saleRecord.count({
			where: { status: { in: ["TO_BE_DONE", "IN_PROGRESS"] } },
		}),
		prisma.passenger.count({
			where: {
				saleRecord: {
					createdAt: { gte: startOfCurrentMonth, lte: endOfCurrentMonth },
				},
			},
		}),
		prisma.tour.count({ where: { active: true } }),
		prisma.agency.count({ where: { active: true } }),
		prisma.agencyTransfer.count({
			where: { type: "OUTGOING", paymentStatus: "PENDING" },
		}),
		prisma.agencyTransfer.count({
			where: { type: "INCOMING", paymentStatus: "PENDING" },
		}),
	])

	const incomeCurrent = incomeThisMonth._sum.amount || 0
	const incomeLast = incomeLastMonth._sum.amount || 0
	const incomeLastYear = incomeSameMonthLastYear._sum.amount || 0

	return {
		sales: {
			current: salesThisMonth,
			last: salesLastMonth,
			lastYear: salesSameMonthLastYear,
			trend: salesLastMonth > 0 ? ((salesThisMonth - salesLastMonth) / salesLastMonth) * 100 : 0,
			trendYoY:
				salesSameMonthLastYear > 0
					? ((salesThisMonth - salesSameMonthLastYear) / salesSameMonthLastYear) * 100
					: null,
		},
		income: {
			current: incomeCurrent,
			last: incomeLast,
			lastYear: incomeLastYear,
			trend: incomeLast > 0 ? ((incomeCurrent - incomeLast) / incomeLast) * 100 : 0,
			trendYoY: incomeLastYear > 0 ? ((incomeCurrent - incomeLastYear) / incomeLastYear) * 100 : null,
		},
		quotes: {
			pending: pendingQuotes,
		},
		services: {
			active: activeServices,
		},
		passengers: {
			current: passengersThisMonth,
		},
		tours: {
			active: activeTours,
		},
		agencies: {
			active: activeAgencies,
		},
		payments: {
			pending: pendingTransfers + pendingReceptions,
		},
	}
}

export async function getSalesChart() {
	await getAuthUser()
	const now = new Date()
	const start = startOfMonth(subMonths(now, 11))
	const end = endOfMonth(now)

	// Una sola query para obtener todos los registros del rango
	const records = await prisma.saleRecord.findMany({
		where: {
			type: { in: ["SALE", "QUOTE"] },
			createdAt: {
				gte: start,
				lte: end,
			},
		},
		select: {
			createdAt: true,
			type: true,
		},
	})

	// Agregamos por mes en JS
	const monthlyData = new Map<string, { sales: number; quotes: number }>()

	// Inicializamos los 12 meses para garantizar orden y completitud
	for (let i = 11; i >= 0; i--) {
		const date = subMonths(now, i)
		const key = format(date, "yyyy-MM")
		monthlyData.set(key, { sales: 0, quotes: 0 })
	}

	// Contamos registros por mes y tipo
	for (const record of records) {
		const key = format(record.createdAt, "yyyy-MM")
		const entry = monthlyData.get(key)
		if (entry) {
			if (record.type === "SALE") {
				entry.sales++
			} else {
				entry.quotes++
			}
		}
	}

	// Construimos el resultado con el mismo formato
	const months = []
	for (let i = 11; i >= 0; i--) {
		const date = subMonths(now, i)
		const key = format(date, "yyyy-MM")
		const data = monthlyData.get(key)!
		months.push({
			name: format(date, "MMM", { locale: es }),
			fullDate: format(date, "MMMM yyyy", { locale: es }),
			sales: data.sales,
			quotes: data.quotes,
		})
	}

	return months
}

export async function getTopTours() {
	await getAuthUser()
	// Obtenemos los tours más frecuentes a través de EventBooking
	const topBookings = await prisma.eventBooking.groupBy({
		by: ["eventId"],
		_count: {
			id: true,
		},
		orderBy: {
			_count: {
				id: "desc",
			},
		},
		take: 5,
	})

	// Obtenemos los detalles de los eventos y tours en una sola query
	const eventIds = topBookings.map((booking) => booking.eventId)
	const events = await prisma.event.findMany({
		where: { id: { in: eventIds } },
		include: {
			tour: {
				select: { name: true },
			},
			transferService: { select: { id: true, name: true } },
		},
	})

	const eventMap = new Map(events.map((event) => [event.id, event]))

	const tours = topBookings.map((booking) => {
		const event = eventMap.get(booking.eventId)
		return {
			name: event ? getEventDisplayName(event) : "Desconocido",
			count: booking._count.id,
		}
	})

	return tours
}

export async function getUpcomingEvents() {
	await getAuthUser()
	const now = new Date()
	const next15Days = addDays(now, 15)

	const events = await prisma.event.findMany({
		where: {
			date: {
				gte: now,
				lte: next15Days,
			},
			bookings: {
				some: {
					saleRecord: {
						status: { in: ["TO_BE_DONE", "IN_PROGRESS"] },
					},
				},
			},
		},
		include: {
			tour: {
				select: { name: true },
			},
			transferService: { select: { id: true, name: true } },
			bookings: {
				where: {
					saleRecord: {
						status: { in: ["TO_BE_DONE", "IN_PROGRESS"] },
					},
				},
				include: {
					saleRecord: {
						select: {
							voucher: true,
							passengers: {
								select: { id: true },
							},
						},
					},
				},
				take: 1,
			},
		},
		orderBy: {
			date: "asc",
		},
		take: 10,
	})

	return events.map((event) => {
		const booking = event.bookings[0]
		return {
			id: event.id,
			date: event.date,
			tourName: getEventDisplayName(event),
			voucher: booking?.saleRecord?.voucher || 0,
			passengers: booking?.passengerCount || 0,
			startTime: event.startTime,
		}
	})
}

export async function getOnboardingStatus() {
	await getAuthUser()

	const [tourCount, providerCount, agencyCount, saleCount, userCount] = await Promise.all([
		prisma.tour.count(),
		prisma.provider.count(),
		prisma.agency.count(),
		prisma.saleRecord.count(),
		prisma.user.count(),
	])

	return {
		hasTour: tourCount > 0,
		hasProvider: providerCount > 0,
		hasAgency: agencyCount > 0,
		hasSale: saleCount > 0,
		hasExtraUser: userCount > 1,
	}
}

export async function getRecentSales() {
	await getAuthUser()
	const sales = await prisma.saleRecord.findMany({
		where: {
			type: "SALE",
		},
		orderBy: {
			createdAt: "desc",
		},
		take: 5,
		include: {
			seller: {
				select: { name: true },
			},
			passengers: {
				take: 1,
				select: { name: true },
			},
			paymentRecords: true,
		},
	})

	return sales.map((sale) => {
		const total = sale.paymentRecords.reduce((acc, curr) => acc + curr.amount, 0)
		return {
			id: sale.id,
			voucher: sale.voucher,
			client: sale.passengers[0]?.name || "Cliente",
			seller: sale.seller.name,
			total,
			status: sale.status,
			date: sale.createdAt,
		}
	})
}
