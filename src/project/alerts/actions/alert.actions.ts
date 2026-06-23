"use server"

import { headers } from "next/headers"

import { addDays, startOfDay, subDays } from "date-fns"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { calculateBookingRevenue } from "@/project/sales/utils/booking-revenue"
import { getEventDisplayName } from "@/project/events/utils/event-display"

import { buildAlertsDashboardData } from "../utils/alert-rules"

async function getAuthUser() {
	const session = await auth.api.getSession({ headers: await headers() })
	if (!session?.user) throw new Error("No autenticado")
	return session.user
}

export async function getAlertsDashboardData() {
	await getAuthUser()
	const now = new Date()
	const todayStart = startOfDay(now)
	const lookbackStart = subDays(todayStart, 30)
	const upcomingEnd = addDays(todayStart, 30)

	const [events, sales, transfers, cashBoxes, providers, agencies, tours] = await Promise.all([
		prisma.event.findMany({
			where: {
				date: {
					gte: lookbackStart,
					lte: upcomingEnd,
				},
				status: {
					not: "CANCELLED",
				},
			},
			select: {
				id: true,
				date: true,
				startTime: true,
				status: true,
				currentBookings: true,
				maxCapacity: true,
				tour: {
					select: {
						name: true,
					},
				},
				transferService: {
					select: {
						id: true,
						name: true,
					},
				},
				guide: {
					select: {
						fullName: true,
					},
				},
				driver: {
					select: {
						fullName: true,
					},
				},
				vehicle: {
					select: {
						vehiclePlate: true,
					},
				},
				cateringProviderId: true,
			},
		}),
		prisma.saleRecord.findMany({
			where: {
				createdAt: {
					gte: subDays(todayStart, 60),
				},
				status: {
					not: "CANCELLED",
				},
			},
			select: {
				id: true,
				voucher: true,
				type: true,
				status: true,
				discount: true,
				wholesaleMarkup: true,
				createdAt: true,
				passengers: {
					select: {
						id: true,
					},
				},
				eventBookings: {
					select: {
						id: true,
						priceEntries: {
							select: { count: true, priceSnapshot: true, receptionSnapshot: true },
						},
						entrySnapshots: {
							select: { count: true, priceSnapshot: true },
						},
					},
				},
				paymentRecords: {
					select: {
						amount: true,
						refund: true,
					},
				},
				convertedToSale: {
					select: {
						id: true,
					},
				},
			},
		}),
		prisma.agencyTransfer.findMany({
			where: {
				type: "OUTGOING",
				date: {
					gte: subDays(todayStart, 90),
				},
			},
			select: {
				id: true,
				voucher: true,
				date: true,
				paymentStatus: true,
				agency: {
					select: {
						name: true,
					},
				},
			},
		}),
		prisma.cashBox.findMany({
			where: {
				date: {
					gte: subDays(todayStart, 30),
				},
			},
			select: {
				id: true,
				date: true,
				status: true,
				counts: {
					where: {
						type: "CLOSING",
					},
					select: {
						id: true,
					},
				},
			},
		}),
		prisma.provider.findMany({
			where: {
				isActive: true,
			},
			select: {
				id: true,
				fullName: true,
				companyName: true,
				licenseRenovationDate: true,
				technicalRevisionDate: true,
				circulationPermitDate: true,
				decree80Date: true,
				sernaturRenovationDate: true,
			},
		}),
		prisma.agency.findMany({
			where: {
				active: true,
			},
			select: {
				id: true,
				name: true,
				contactEmails: true,
			},
		}),
		prisma.tour.findMany({
			where: {
				active: true,
			},
			select: {
				id: true,
				name: true,
				active: true,
				imageUrl: true,
				startTime: true,
				endTime: true,
			},
		}),
	])

	const snapshot = {
		events: events.map((event) => ({
			id: event.id,
			date: event.date,
			startTime: event.startTime,
			status: event.status,
			currentBookings: event.currentBookings,
			maxCapacity: event.maxCapacity,
			tourName: getEventDisplayName(event),
			guideName: event.guide?.fullName || null,
			driverName: event.driver?.fullName || null,
			vehiclePlate: event.vehicle?.vehiclePlate || null,
			hasCateringProvider: Boolean(event.cateringProviderId),
		})),
		sales: sales.map((sale) => {
			const expectedAmount = sale.eventBookings.reduce((acc, booking) => {
				const revenue = calculateBookingRevenue(booking.priceEntries || [], booking.entrySnapshots || [])
				return acc + revenue.grandTotal
			}, 0)

			const paidAmount = sale.paymentRecords.reduce((acc, payment) => {
				if (payment.refund) return acc - payment.amount
				return acc + payment.amount
			}, 0)

			return {
				id: sale.id,
				voucher: sale.voucher,
				type: sale.type,
				status: sale.status,
				discount: sale.discount,
				wholesaleMarkup: sale.wholesaleMarkup,
				createdAt: sale.createdAt,
				passengerCount: sale.passengers.length,
				eventBookingsCount: sale.eventBookings.length,
				expectedAmount: Math.max(0, expectedAmount - sale.discount + sale.wholesaleMarkup),
				paidAmount,
				hasConvertedSale: Boolean(sale.convertedToSale?.id),
			}
		}),
		transfers: transfers.map((transfer) => ({
			id: transfer.id,
			voucher: transfer.voucher,
			date: transfer.date,
			paymentStatus: transfer.paymentStatus,
			agencyName: transfer.agency.name,
		})),
		cashBoxes: cashBoxes.map((cashBox) => ({
			id: cashBox.id,
			date: cashBox.date,
			status: cashBox.status,
			hasClosingCount: cashBox.counts.length > 0,
		})),
		providers: providers.map((provider) => ({
			id: provider.id,
			displayName: provider.fullName || provider.companyName || "Proveedor sin nombre",
			licenseRenovationDate: provider.licenseRenovationDate,
			technicalRevisionDate: provider.technicalRevisionDate,
			circulationPermitDate: provider.circulationPermitDate,
			decree80Date: provider.decree80Date,
			sernaturRenovationDate: provider.sernaturRenovationDate,
		})),
		agencies,
		tours,
	}

	return buildAlertsDashboardData(snapshot, now)
}
