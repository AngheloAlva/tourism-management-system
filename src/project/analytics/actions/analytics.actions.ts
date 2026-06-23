"use server"

import { headers } from "next/headers"
import { startOfMonth, endOfMonth, subMonths, format, differenceInDays } from "date-fns"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { getEventDisplayName } from "@/project/events/utils/event-display"

export interface AnalyticsFilters {
	sellerId?: string
	channel?: "ONLINE" | "AGENCY" | "PHYSICAL" | "WHOLESALE"
	mode?: "REGULAR" | "PRIVATE"
	startDate?: Date
	endDate?: Date
	tourIds?: string[]
}

export interface RevenueByTourData {
	tourId: string
	tourName: string
	monthlyData: {
		month: string
		revenue: number
		passengers: number
	}[]
	totalRevenue: number
	totalPassengers: number
}

export interface CustomerByNationalityData {
	nationality: string
	count: number
	totalSpent: number
	coordinates: [number, number] | null
}

export interface TopTourData {
	tourId: string
	tourName: string
	type: string
	salesCount: number
	passengersCount: number
	revenue: number
	percentage: number
}

export interface ExportSaleData {
	fecha: string
	voucher?: string
	tour: string
	vendedor: string
	canal: string
	total: number
	pasajeros: number
	nacionalidades: string
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

const COUNTRY_COORDINATES: Record<string, [number, number]> = {
	"Chile": [-70.6483, -33.4569],
	"Argentina": [-58.3816, -34.6037],
	"Brasil": [-47.9297, -15.7801],
	"Brazil": [-47.9297, -15.7801],
	"USA": [-77.0369, 38.9072],
	"Estados Unidos": [-77.0369, 38.9072],
	"United States": [-77.0369, 38.9072],
	"España": [-3.7038, 40.4168],
	"Spain": [-3.7038, 40.4168],
	"México": [-99.1332, 19.4326],
	"Mexico": [-99.1332, 19.4326],
	"Colombia": [-74.0721, 4.711],
	"Perú": [-77.0428, -12.0464],
	"Peru": [-77.0428, -12.0464],
	"Francia": [2.3522, 48.8566],
	"France": [2.3522, 48.8566],
	"Alemania": [13.405, 52.52],
	"Germany": [13.405, 52.52],
	"Italia": [12.4964, 41.9028],
	"Italy": [12.4964, 41.9028],
	"Reino Unido": [-0.1276, 51.5074],
	"UK": [-0.1276, 51.5074],
	"United Kingdom": [-0.1276, 51.5074],
	"Canadá": [-75.6972, 45.4215],
	"Canada": [-75.6972, 45.4215],
	"Australia": [151.2093, -33.8688],
	"Japón": [139.6917, 35.6895],
	"Japan": [139.6917, 35.6895],
	"China": [116.4074, 39.9042],
	"Corea del Sur": [126.978, 37.5665],
	"South Korea": [126.978, 37.5665],
	"Bolivia": [-68.1193, -16.4897],
	"Ecuador": [-78.4678, -0.1807],
	"Uruguay": [-56.1645, -34.9011],
	"Paraguay": [-57.5759, -25.2637],
	"Venezuela": [-66.9036, 10.4806],
	"Panamá": [-79.5197, 9.082],
	"Panama": [-79.5197, 9.082],
	"Costa Rica": [-84.0907, 9.9281],
	"Cuba": [-82.3666, 23.1136],
	"República Dominicana": [-69.9312, 18.4861],
	"Dominican Republic": [-69.9312, 18.4861],
	"Puerto Rico": [-66.1057, 18.4655],
	"Guatemala": [-90.5069, 14.6349],
	"Honduras": [-87.2068, 14.0723],
	"El Salvador": [-89.2182, 13.6929],
	"Nicaragua": [-86.2685, 12.115],
	"Holanda": [4.9041, 52.3676],
	"Netherlands": [4.9041, 52.3676],
	"Bélgica": [4.3517, 50.8503],
	"Belgium": [4.3517, 50.8503],
	"Suiza": [7.4474, 46.948],
	"Switzerland": [7.4474, 46.948],
	"Austria": [16.3738, 48.2082],
	"Portugal": [-9.1393, 38.7223],
	"Polonia": [21.0122, 52.2297],
	"Poland": [21.0122, 52.2297],
	"Rusia": [37.6173, 55.7558],
	"Russia": [37.6173, 55.7558],
	"India": [77.209, 28.6139],
	"Sudáfrica": [28.0473, -26.2041],
	"South Africa": [28.0473, -26.2041],
	"Nueva Zelanda": [174.7762, -41.2866],
	"New Zealand": [174.7762, -41.2866],
	"Israel": [35.2137, 31.7683],
	"Suecia": [18.0686, 59.3293],
	"Sweden": [18.0686, 59.3293],
	"Noruega": [10.7522, 59.9139],
	"Norway": [10.7522, 59.9139],
	"Dinamarca": [12.5683, 55.6761],
	"Denmark": [12.5683, 55.6761],
	"Finlandia": [24.9384, 60.1699],
	"Finland": [24.9384, 60.1699],
	"Irlanda": [-6.2603, 53.3498],
	"Ireland": [-6.2603, 53.3498],
	"Grecia": [23.7275, 37.9838],
	"Greece": [23.7275, 37.9838],
}

function getCoordinatesForNationality(nationality: string): [number, number] | null {
	if (!nationality) return null
	if (COUNTRY_COORDINATES[nationality]) return COUNTRY_COORDINATES[nationality]

	const normalizedNationality = nationality.toLowerCase().trim()
	for (const [country, coords] of Object.entries(COUNTRY_COORDINATES)) {
		if (country.toLowerCase() === normalizedNationality) return coords
	}
	return null
}

function buildWhereClause(filters?: AnalyticsFilters) {
	const defaultStartDate = subMonths(startOfMonth(new Date()), 5)
	const defaultEndDate = endOfMonth(new Date())

	const startDate = filters?.startDate ?? defaultStartDate
	const endDate = filters?.endDate ?? defaultEndDate

	const where: any = {
		type: "SALE",
		// Exclude cancelled vouchers from all analytics KPIs — mirrors the commissions module filter.
		status: { not: "CANCELLED" },
		createdAt: {
			gte: startDate,
			lte: endDate,
		},
	}

	if (filters?.sellerId) where.sellerId = filters.sellerId
	if (filters?.channel) where.channel = filters.channel

	// Always require at least one non-cancelled booking so fully-cancelled sales are excluded.
	// Optional mode/tour filters are merged into the same `some` predicate.
	const bookingsWhere: any = { cancelled: false }
	if (filters?.mode) bookingsWhere.event = { mode: filters.mode }
	if (filters?.tourIds && filters.tourIds.length > 0) {
		bookingsWhere.event = {
			...(bookingsWhere.event || {}),
			tourId: { in: filters.tourIds },
		}
	}

	where.eventBookings = { some: bookingsWhere }

	return where
}

/**
 * Get customer data grouped by nationality with coordinates
 */
export async function getCustomersByNationality(
	filters?: AnalyticsFilters
): Promise<CustomerByNationalityData[]> {
	await getAuthUser()

	const where = buildWhereClause(filters)

	const sales = await prisma.saleRecord.findMany({
		where,
		include: {
			passengers: {
				select: { nationality: true },
			},
			paymentRecords: {
				where: { refund: false },
				select: { amount: true },
			},
			eventBookings: {
				include: { event: true },
			},
		},
	})

	const nationalityMap = new Map<string, { count: number; totalSpent: number }>()

	for (const sale of sales) {
		const matchesFilters = sale.eventBookings.some((booking) => {
			if (filters?.mode && booking.event.mode !== filters.mode) return false
			if (
				filters?.tourIds &&
				filters.tourIds.length > 0 &&
				(!booking.event.tourId || !filters.tourIds.includes(booking.event.tourId))
			)
				return false
			return true
		})

		if (!matchesFilters) continue

		const totalPayments = sale.paymentRecords.reduce((sum, p) => sum + p.amount, 0)
		const revenuePerPassenger =
			sale.passengers.length > 0 ? totalPayments / sale.passengers.length : 0

		for (const passenger of sale.passengers) {
			const nationality = passenger.nationality || "Desconocido"

			if (!nationalityMap.has(nationality)) {
				nationalityMap.set(nationality, { count: 0, totalSpent: 0 })
			}

			const data = nationalityMap.get(nationality)!
			data.count += 1
			data.totalSpent += revenuePerPassenger
		}
	}

	return Array.from(nationalityMap.entries())
		.map(([nationality, data]) => ({
			nationality,
			count: data.count,
			totalSpent: data.totalSpent,
			coordinates: getCoordinatesForNationality(nationality),
		}))
		.filter((d) => d.coordinates !== null)
		.sort((a, b) => b.count - a.count)
}

/**
 * Get top tours by sales count and revenue for treemap
 */
export async function getTopTours(filters?: AnalyticsFilters): Promise<TopTourData[]> {
	await getAuthUser()

	const where = buildWhereClause(filters)

	const sales = await prisma.saleRecord.findMany({
		where,
		include: {
			eventBookings: {
				include: {
					event: {
						include: {
							tour: {
								select: { id: true, name: true },
							},
							transferService: { select: { id: true, name: true } },
						},
					},
				},
			},
			paymentRecords: {
				where: { refund: false },
			},
			passengers: true,
		},
	})

	const tourMap = new Map<
		string,
		{ tourName: string; type: string; salesCount: number; passengersCount: number; revenue: number }
	>()

	let totalPassengers = 0

	for (const sale of sales) {
		const totalPayments = sale.paymentRecords.reduce((sum, p) => sum + p.amount, 0)
		const passengerCount = sale.passengers.length

		for (const booking of sale.eventBookings) {
			const tour = booking.event.tour
			if (!tour) continue

			if (filters?.tourIds && filters.tourIds.length > 0 && !filters.tourIds.includes(tour.id)) {
				continue
			}
			if (filters?.mode && booking.event.mode !== filters.mode) continue

			if (!tourMap.has(tour.id)) {
				tourMap.set(tour.id, {
					tourName: tour.name,
					type: booking.event.serviceKind,
					salesCount: 0,
					passengersCount: 0,
					revenue: 0,
				})
			}

			const data = tourMap.get(tour.id)!
			data.salesCount += 1
			data.passengersCount += passengerCount
			data.revenue += totalPayments / sale.eventBookings.length
			totalPassengers += passengerCount
		}
	}

	return Array.from(tourMap.entries())
		.map(([tourId, data]) => ({
			tourId,
			...data,
			percentage: totalPassengers > 0 ? (data.passengersCount / totalPassengers) * 100 : 0,
		}))
		.sort((a, b) => b.passengersCount - a.passengersCount)
}

/**
 * Get analytics summary for quick stats
 */
export async function getAnalyticsSummary(filters?: AnalyticsFilters) {
	await getAuthUser()

	const where = buildWhereClause(filters)

	const sales = await prisma.saleRecord.findMany({
		where,
		include: {
			paymentRecords: { where: { refund: false } },
			passengers: true,
			eventBookings: { include: { event: true } },
		},
	})

	const filteredSales = sales.filter((sale) => {
		return sale.eventBookings.some((booking) => {
			if (filters?.mode && booking.event.mode !== filters.mode) return false
			if (
				filters?.tourIds &&
				filters.tourIds.length > 0 &&
				(!booking.event.tourId || !filters.tourIds.includes(booking.event.tourId))
			)
				return false
			return true
		})
	})

	const totalSales = filteredSales.length
	const totalRevenue = filteredSales.reduce(
		(sum, s) => sum + s.paymentRecords.reduce((pSum, p) => pSum + p.amount, 0),
		0
	)
	const totalPassengers = filteredSales.reduce((sum, s) => sum + s.passengers.length, 0)
	const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0

	const nationalities = new Set<string>()
	for (const sale of filteredSales) {
		for (const p of sale.passengers) {
			if (p.nationality) nationalities.add(p.nationality)
		}
	}

	return {
		totalSales,
		totalRevenue,
		totalPassengers,
		avgTicket,
		uniqueCountries: nationalities.size,
	}
}

/**
 * Export filtered sales data for Excel download
 */
export async function exportAnalyticsSales(filters?: AnalyticsFilters): Promise<ExportSaleData[]> {
	await getAuthUser()

	const where = buildWhereClause(filters)

	const sales = await prisma.saleRecord.findMany({
		where,
		include: {
			paymentRecords: { where: { refund: false } },
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
			seller: { select: { name: true } },
		},
		orderBy: { createdAt: "desc" },
	})

	const exportData: ExportSaleData[] = []

	for (const sale of sales) {
		const matchingBookings = sale.eventBookings.filter((booking) => {
			if (filters?.mode && booking.event.mode !== filters.mode) return false
			if (
				filters?.tourIds &&
				filters.tourIds.length > 0 &&
				(!booking.event.tourId || !filters.tourIds.includes(booking.event.tourId))
			)
				return false
			return true
		})

		if (matchingBookings.length === 0) continue

		const total = sale.paymentRecords.reduce((sum, p) => sum + p.amount, 0)
		const tourNames = matchingBookings.map((b) => getEventDisplayName(b.event)).join(", ")
		const nationalities = Array.from(
			new Set(sale.passengers.map((p) => p.nationality || "Desconocido"))
		).join(", ")

		exportData.push({
			fecha: format(sale.createdAt, "dd/MM/yyyy"),
			voucher: sale.id.slice(0, 8).toUpperCase(),
			tour: tourNames,
			vendedor: sale.seller.name,
			canal: sale.channel,
			total,
			pasajeros: sale.passengers.length,
			nacionalidades: nationalities,
		})
	}

	return exportData
}

export interface SalesEvolutionData {
	date: string
	revenue: number
	count: number
}

export interface PaymentMethodData {
	method: string
	count: number
	amount: number
	percentage: number
}

export interface BookingLeadTimeData {
	range: string
	count: number
	percentage: number
}

export interface TopToursByMonthData {
	month: string
	tours: {
		tourId: string
		tourName: string
		salesCount: number
		revenue: number
	}[]
}

/**
 * Get sales evolution data grouped by date or month
 */
export async function getSalesEvolution(
	filters?: AnalyticsFilters,
	groupBy: "day" | "month" = "day"
): Promise<SalesEvolutionData[]> {
	await getAuthUser()

	const where = buildWhereClause(filters)

	const sales = await prisma.saleRecord.findMany({
		where,
		include: {
			paymentRecords: { where: { refund: false } },
			eventBookings: {
				include: { event: true },
			},
		},
		orderBy: { createdAt: "asc" },
	})

	const dataMap = new Map<string, { revenue: number; count: number }>()

	for (const sale of sales) {
		const matchesFilters = sale.eventBookings.some((booking) => {
			if (filters?.mode && booking.event.mode !== filters.mode) return false
			if (
				filters?.tourIds &&
				filters.tourIds.length > 0 &&
				(!booking.event.tourId || !filters.tourIds.includes(booking.event.tourId))
			)
				return false
			return true
		})

		if (!matchesFilters && sale.eventBookings.length > 0) continue

		const dateKey =
			groupBy === "month" ? format(sale.createdAt, "yyyy-MM") : format(sale.createdAt, "yyyy-MM-dd")
		const total = sale.paymentRecords.reduce((sum, p) => sum + p.amount, 0)

		if (!dataMap.has(dateKey)) {
			dataMap.set(dateKey, { revenue: 0, count: 0 })
		}

		const entry = dataMap.get(dateKey)!
		entry.revenue += total
		entry.count += 1
	}

	return Array.from(dataMap.entries()).map(([date, data]) => ({
		date,
		revenue: data.revenue,
		count: data.count,
	}))
}

/**
 * Get payment methods distribution
 */
export async function getPaymentMethodsDistribution(
	filters?: AnalyticsFilters
): Promise<PaymentMethodData[]> {
	await getAuthUser()

	const where = buildWhereClause(filters)

	const sales = await prisma.saleRecord.findMany({
		where,
		include: {
			paymentRecords: { where: { refund: false } },
			eventBookings: { include: { event: true } },
		},
	})

	const methodMap = new Map<string, { count: number; amount: number }>()
	let totalRevenue = 0

	for (const sale of sales) {
		const matchesFilters = sale.eventBookings.some((booking) => {
			if (filters?.mode && booking.event.mode !== filters.mode) return false
			if (
				filters?.tourIds &&
				filters.tourIds.length > 0 &&
				(!booking.event.tourId || !filters.tourIds.includes(booking.event.tourId))
			)
				return false
			return true
		})

		if (!matchesFilters && sale.eventBookings.length > 0) continue

		for (const payment of sale.paymentRecords) {
			const method = payment.method
			const amount = payment.amount

			if (!methodMap.has(method)) {
				methodMap.set(method, { count: 0, amount: 0 })
			}

			const entry = methodMap.get(method)!
			entry.count += 1
			entry.amount += amount
			totalRevenue += amount
		}
	}

	return Array.from(methodMap.entries())
		.map(([method, data]) => ({
			method,
			count: data.count,
			amount: data.amount,
			percentage: totalRevenue > 0 ? (data.amount / totalRevenue) * 100 : 0,
		}))
		.sort((a, b) => b.amount - a.amount)
}

/**
 * Get booking lead time distribution
 */
export async function getBookingLeadTime(
	filters?: AnalyticsFilters
): Promise<BookingLeadTimeData[]> {
	await getAuthUser()

	const where = buildWhereClause(filters)

	const sales = await prisma.saleRecord.findMany({
		where,
		include: {
			eventBookings: { include: { event: true } },
		},
	})

	const ranges = {
		"Mismo día": 0,
		"1-3 días": 0,
		"4-7 días": 0,
		"8-30 días": 0,
		"+30 días": 0,
	}

	let totalBookings = 0

	for (const sale of sales) {
		for (const booking of sale.eventBookings) {
			if (filters?.mode && booking.event.mode !== filters.mode) continue
			if (
				filters?.tourIds &&
				filters.tourIds.length > 0 &&
				(!booking.event.tourId || !filters.tourIds.includes(booking.event.tourId))
			)
				continue

			const leadDays = differenceInDays(booking.event.date, sale.createdAt)

			if (leadDays <= 0) ranges["Mismo día"]++
			else if (leadDays <= 3) ranges["1-3 días"]++
			else if (leadDays <= 7) ranges["4-7 días"]++
			else if (leadDays <= 30) ranges["8-30 días"]++
			else ranges["+30 días"]++

			totalBookings++
		}
	}

	return Object.entries(ranges).map(([range, count]) => ({
		range,
		count,
		percentage: totalBookings > 0 ? (count / totalBookings) * 100 : 0,
	}))
}

/**
 * Get top 5 tours by month for stacked bar chart
 */
export async function getTopToursByMonth(
	filters?: AnalyticsFilters
): Promise<TopToursByMonthData[]> {
	await getAuthUser()

	const where = buildWhereClause(filters)

	const sales = await prisma.saleRecord.findMany({
		where,
		include: {
			paymentRecords: { where: { refund: false } },
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
		orderBy: { createdAt: "asc" },
	})

	// First pass: count total sales per tour to determine top 5
	const tourTotals = new Map<string, { name: string; count: number }>()

	for (const sale of sales) {
		for (const booking of sale.eventBookings) {
			const tour = booking.event.tour
			if (!tour) continue
			if (filters?.mode && booking.event.mode !== filters.mode) continue
			if (filters?.tourIds && filters.tourIds.length > 0 && !filters.tourIds.includes(tour.id))
				continue

			if (!tourTotals.has(tour.id)) {
				tourTotals.set(tour.id, { name: tour.name, count: 0 })
			}
			tourTotals.get(tour.id)!.count += 1
		}
	}

	// Get top 5 tour IDs
	const top5TourIds = Array.from(tourTotals.entries())
		.sort((a, b) => b[1].count - a[1].count)
		.slice(0, 5)
		.map(([id]) => id)

	const top5TourNames = new Map(
		Array.from(tourTotals.entries())
			.filter(([id]) => top5TourIds.includes(id))
			.map(([id, data]) => [id, data.name])
	)

	// Second pass: group by month for top 5 tours only
	const monthlyData = new Map<string, Map<string, { salesCount: number; revenue: number }>>()

	for (const sale of sales) {
		const month = format(sale.createdAt, "yyyy-MM")
		const totalPayments = sale.paymentRecords.reduce((sum, p) => sum + p.amount, 0)
		const bookingsCount = sale.eventBookings.length

		for (const booking of sale.eventBookings) {
			const tour = booking.event.tour
			if (!tour) continue
			if (!top5TourIds.includes(tour.id)) continue
			if (filters?.mode && booking.event.mode !== filters.mode) continue
			if (filters?.tourIds && filters.tourIds.length > 0 && !filters.tourIds.includes(tour.id))
				continue

			if (!monthlyData.has(month)) {
				monthlyData.set(month, new Map())
			}

			const monthMap = monthlyData.get(month)!
			if (!monthMap.has(tour.id)) {
				monthMap.set(tour.id, { salesCount: 0, revenue: 0 })
			}

			const tourData = monthMap.get(tour.id)!
			tourData.salesCount += 1
			tourData.revenue += totalPayments / bookingsCount
		}
	}

	// Convert to array format
	return Array.from(monthlyData.entries())
		.sort((a, b) => a[0].localeCompare(b[0]))
		.map(([month, toursMap]) => ({
			month,
			tours: top5TourIds.map((tourId) => ({
				tourId,
				tourName: top5TourNames.get(tourId) || "Desconocido",
				salesCount: toursMap.get(tourId)?.salesCount || 0,
				revenue: toursMap.get(tourId)?.revenue || 0,
			})),
		}))
}
