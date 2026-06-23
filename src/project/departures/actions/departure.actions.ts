"use server"

import { startOfDay, endOfDay } from "date-fns"
import { headers } from "next/headers"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

import type { DepartureEvent } from "../types/departure.types"

async function getAuthUser() {
	const session = await auth.api.getSession({
		headers: await headers(),
	})

	if (!session?.user) {
		throw new Error("No autenticado")
	}

	return session.user
}

export async function getEventsByDate(date: Date): Promise<DepartureEvent[]> {
	try {
		await getAuthUser()

		const dayStart = startOfDay(date)
		const dayEnd = endOfDay(date)

		const events = await prisma.event.findMany({
			where: {
				status: {
					not: "CANCELLED",
				},
				date: {
					gte: dayStart,
					lte: dayEnd,
				},
				bookings: {
					some: {
						saleRecord: {
							type: "SALE",
						},
					},
				},
			},
			include: {
				transferService: {
					select: {
						id: true,
						name: true,
					},
				},
				tour: {
					select: {
						id: true,
						name: true,
					},
				},
				bookings: {
					where: {
						saleRecord: {
							type: "SALE",
						},
					},
					include: {
						saleRecord: {
							include: {
								seller: {
									select: {
										id: true,
										name: true,
									},
								},
								passengers: {
									select: {
										id: true,
										name: true,
										age: true,
									},
								},
							},
						},
						bookingPassengers: {
							select: {
								passengerId: true,
								excluded: true,
							},
						},
					},
					orderBy: {
						saleRecord: {
							voucher: "asc",
						},
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
						vehicleBrand: true,
						vehicleModel: true,
						vehiclePlate: true,
					},
				},
				cateringProvider: {
					select: {
						fullName: true,
						companyName: true,
					},
				},
			},
			orderBy: [
				{
					startTime: "asc",
				},
				{
					date: "asc",
				},
			],
		})

		const eventIds = events.map((event) => event.id)
		const transferDetailsByEvent =
			eventIds.length > 0
				? await prisma.transferEventBooking.findMany({
						where: {
							eventId: { in: eventIds },
							transfer: {
								type: "OUTGOING",
							},
						},
						select: {
							eventId: true,
							transfer: {
								select: {
									priceDetails: {
										select: {
											sourcePassengerId: true,
											passengerName: true,
										},
									},
								},
							},
						},
					})
				: []

		const transferredIdsByEvent = new Map<string, Set<string>>()
		const transferredNamesByEvent = new Map<string, Set<string>>()

		for (const transferBooking of transferDetailsByEvent) {
			if (!transferredIdsByEvent.has(transferBooking.eventId)) {
				transferredIdsByEvent.set(transferBooking.eventId, new Set<string>())
			}
			if (!transferredNamesByEvent.has(transferBooking.eventId)) {
				transferredNamesByEvent.set(transferBooking.eventId, new Set<string>())
			}

			const idsSet = transferredIdsByEvent.get(transferBooking.eventId)!
			const namesSet = transferredNamesByEvent.get(transferBooking.eventId)!

			for (const priceDetail of transferBooking.transfer.priceDetails) {
				if (priceDetail.sourcePassengerId) {
					idsSet.add(priceDetail.sourcePassengerId)
				}
				const normalizedName = priceDetail.passengerName?.trim().toLowerCase()
				if (!priceDetail.sourcePassengerId && normalizedName) {
					namesSet.add(normalizedName)
				}
			}
		}

		const getAgeCategory = (age: number | null | undefined): "adult" | "child" | "senior" => {
			if (!age) return "adult"
			if (age < 12) return "child"
			if (age >= 65) return "senior"
			return "adult"
		}

		const mappedEvents = events
			.map((event) => {
				const normalizedTour =
					event.tour ||
					(event.transferService
						? {
								id: event.transferService.id,
								name: event.transferService.name,
							}
						: null)

				if (!normalizedTour) return null

				const transferredIds = transferredIdsByEvent.get(event.id) || new Set<string>()
				const transferredNames = transferredNamesByEvent.get(event.id) || new Set<string>()

				const activeBookings = event.bookings
					.map((booking) => {
						// Build set of excluded passenger IDs from bookingPassengers
						const excludedPassengerIds = new Set(
							booking.bookingPassengers
								?.filter((bp) => bp.excluded)
								.map((bp) => bp.passengerId) ?? []
						)

						const sourcePassengers = booking.saleRecord?.passengers || []
						const remainingPassengers = sourcePassengers.filter((passenger) => {
							if (excludedPassengerIds.has(passenger.id)) return false
							const normalizedName = passenger.name?.trim().toLowerCase()
							const transferredByName = normalizedName
								? transferredNames.has(normalizedName)
								: false
							return !transferredIds.has(passenger.id) && !transferredByName
						})

						const counts = remainingPassengers.reduce(
							(acc, passenger) => {
								const category = getAgeCategory(passenger.age)
								if (category === "adult") acc.adultsCount++
								if (category === "child") acc.childrenCount++
								if (category === "senior") acc.seniorsCount++
								return acc
							},
							{ adultsCount: 0, childrenCount: 0, seniorsCount: 0 }
						)

						const remainingPassengerCount = Math.min(
							booking.passengerCount,
							remainingPassengers.length
						)

						if (remainingPassengerCount <= 0) return null

						return {
							...booking,
							passengerCount: remainingPassengerCount,
							adultsCount: counts.adultsCount,
							childrenCount: counts.childrenCount,
							seniorsCount: counts.seniorsCount,
							saleRecord: {
								...booking.saleRecord,
								passengers: remainingPassengers,
							},
						}
					})
					.filter((booking): booking is NonNullable<typeof booking> => Boolean(booking))

				if (activeBookings.length === 0) return null

				return {
					...event,
					tour: normalizedTour,
					bookings: activeBookings,
					currentBookings: activeBookings.reduce((sum, booking) => sum + booking.passengerCount, 0),
				}
			})
			.filter((event): event is NonNullable<typeof event> => Boolean(event))

		return mappedEvents as unknown as DepartureEvent[]
	} catch (error) {
		console.error("Error fetching events by date:", error)
		throw new Error("Error al obtener los eventos del día")
	}
}
