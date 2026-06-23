"use server"

import { headers } from "next/headers"
import type { Prisma, PrismaClient } from "@/generated/prisma/client"

import { saleRecordFormSchema } from "../schemas/sale-record.schema"
import { saleRecordFiltersSchema } from "../schemas/sale-record-filters.schema"
import type { SaleRecordFilters } from "../schemas/sale-record-filters.schema"
export type { SaleRecordFilters } from "../schemas/sale-record-filters.schema"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

import {
	registerCashIncomeFromPayment,
	recalculateSaleCashFlowOnEdit,
} from "@/project/cash-flow/utils/cash-flow-internal"
import { paymentsAffectingCashChanged } from "@/project/sales/utils/payment-cash-diff"
import { notifySaleVoucherByEmail } from "@/project/notifications/actions/automatic-email.actions"
import { canCurrentUserInteractPaths } from "@/project/roles/actions/role.actions"
import { generateVoucherNumber } from "@/shared/actions/generate-voucher"
import { applyFirstEventDate } from "@/project/sales/server/first-event-date"
import { parseCalendarDay, formatCalendarDay } from "@/shared/utils/calendar-day"
import { requestApproval } from "@/project/approvals/actions/approval.actions"
import { computeFingerprint } from "@/project/approvals/utils/fingerprint"
import { buildSnapshot } from "@/project/approvals/utils/snapshot"
import { APPROVAL_ACTION } from "@/generated/prisma/enums"
import { AuditService } from "@/lib/audit/service"
import type { AuditFieldValue } from "@/lib/audit/types"
import {
	buildSaleAuditSnapshot,
	isSaleNoOp,
} from "@/project/sales/utils/sale-audit-summary"
import { applySaleUpdateTx, isInvoiced } from "@/project/sales/server/apply-sale-update"

import type { SaleRecordFormSchema } from "../schemas/sale-record.schema"

export interface SaleRecordWithDetails {
	id: string
	voucher: number
	type: "SALE" | "QUOTE"
	channel: "ONLINE" | "AGENCY" | "PHYSICAL" | "WHOLESALE"
	status: "TO_BE_DONE" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
	clientEmail: string | null
	fileNumber: string | null
	comments: string | null
	contacted: boolean
	discount: number
	isWholesale: boolean
	wholesalePaymentTerm: "IMMEDIATE" | "POSTPAID"
	wholesaleAgencyId: string | null
	wholesaleMarkup: number
	createdAt: Date
	updatedAt: Date
	voucherOutdatedAt: Date | null
	convertedFromQuoteId: string | null
	convertedFromQuote: {
		id: string
		voucher: number
	} | null
	convertedToSale: {
		id: string
		voucher: number
	} | null
	seller: {
		id: string
		name: string
		email: string
	}
	agency: {
		id: string
		name: string
		contactEmails: string[]
	} | null
	wholesaleAgency: {
		id: string
		name: string
	} | null
	passengers: Array<{
		id: string
		name: string | null
		document: string | null
		age: number | null
		nationality: string | null
		diet: "NORMAL" | "VEGETARIAN" | "VEGAN" | "CELIAC" | "OTHER" | null
		dietOther: string | null
		phone: string | null
		hotels: {
			id: string
			hotelName: string
			checkIn: Date | null
			checkOut: Date | null
			order: number
		}[]
		email: string | null
		allergies: string[]
		complimentary: boolean
		complimentaryCategory: string | null
	}>
	paymentRecords: Array<{
		id: string
		refund: boolean
		method:
			| "CASH"
			| "TRANSFER"
			| "CREDIT_CARD"
			| "DEBIT_CARD"
			| "PAYMENT_LINK_DEBIT"
			| "PAYMENT_LINK_CREDIT"
		currency: "CLP" | "USD"
		amount: number
		originalAmount: number | null
		exchangeRate: number | null
		date: Date
		comments: string | null
		documentNumber: string | null
		voucherUrl: string | null
	}>
	eventBookings: Array<{
		id: string
		passengerCount: number
		transferredPassengerCount?: number
		remainingPassengerCount?: number
		isFullyTransferred?: boolean
		isPartiallyTransferred?: boolean
		flyTime: string | null
		flyDate: string | null
		flyName: string | null
		specialRequest: string | null
		priceEntries: Array<{
			id: string
			count: number
			priceSnapshot: number
			receptionSnapshot: number
			categoryName: string
			tourPriceCategoryId: string | null
		}>
		entrySnapshots: Array<{
			id: string
			count: number
			priceSnapshot: number
			entryName: string
			variantName: string
			categoryName: string
			tourEntryId: string | null
		}>
		bookingPassengers: Array<{
			id: string
			passengerId: string
			excluded: boolean
			excludeReason: string | null
			passenger: {
				id: string
				name: string | null
			}
		}>
		event: {
			id: string
			date: Date
			serviceKind: "TOUR" | "TRANSFER"
			mode: "REGULAR" | "PRIVATE"
			status: string
			startTime: string | null
			endTime: string | null
			tour: {
				id: string
				name: string
				generalSummaryEs: string | null
				generalSummaryEn: string | null
				generalSummaryPt: string | null
				scheduleEs: string | null
				scheduleEn: string | null
				schedulePt: string | null
				includesEs: string | null
				includesEn: string | null
				includesPt: string | null
				pickupEs: string | null
				pickupEn: string | null
				pickupPt: string | null
				whatToBringEs: string | null
				whatToBringEn: string | null
				whatToBringPt: string | null
				altitudeEs: string | null
				altitudeEn: string | null
				altitudePt: string | null
			} | null
			transferService: { id: string; name: string } | null
		}
	}>
}

type PrismaTransactionClient = Omit<
	PrismaClient,
	"$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>

export interface SalesSummary {
	totalSales: number
	totalQuotes: number
	totalRevenue: number
	pendingRevenue: number
	salesThisMonth: number
	quotesThisMonth: number
	salesLastYearSameMonth: number
	quotesLastYearSameMonth: number
	monthlyRevenue: number
	convertedQuotes: number
	avgQuoteValue: number
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

function getNormalizedPaymentAmounts(payment: SaleRecordFormSchema["paymentArray"][number]) {
	const amount = Number(payment.amount || 0)
	const currency = payment.currency || "CLP"
	const exchangeRate = currency === "USD" ? Number(payment.exchange_rate || 0) : null

	if (currency === "USD") {
		if (!exchangeRate || exchangeRate <= 0) {
			throw new Error("El tipo de cambio debe ser mayor a 0 para pagos en USD")
		}

		return {
			amountInClp: amount * exchangeRate,
			currency,
			originalAmount: amount,
			exchangeRate,
		}
	}

	return {
		amountInClp: amount,
		currency,
		originalAmount: null,
		exchangeRate: null,
	}
}

/**
 * Helper to find an existing event with capacity or create a new one
 */
async function findOrCreateEventForBooking(
	tx: PrismaTransactionClient,
	params: {
		serviceId: string
		date: Date
		mode: "REGULAR" | "PRIVATE"
		passengerCount: number
		startTime?: string | null
		endTime?: string | null
		comments?: string | null
	}
) {
	const { serviceId, date: rawDate, mode, passengerCount, startTime, endTime, comments } = params
	// Normalize client-supplied Date (local midnight) to UTC midnight for @db.Date field.
	const date = parseCalendarDay(formatCalendarDay(rawDate, "yyyy-MM-dd"))

	const transferService = await tx.transferService.findUnique({
		where: { id: serviceId },
		select: { id: true },
	})

	const serviceKind = transferService ? "TRANSFER" : "TOUR"
	const tourId = transferService ? null : serviceId
	const transferServiceId = transferService?.id || null

	const existingEvents = await tx.event.findMany({
		where: {
			serviceKind,
			...(tourId ? { tourId } : {}),
			...(transferServiceId ? { transferServiceId } : {}),
			date,
			mode,
			status: {
				not: "CANCELLED",
			},
			startTime: startTime || null,
			endTime: endTime || null,
		},
		orderBy: {
			createdAt: "asc",
		},
	})

	let targetEvent = existingEvents.find(
		(event) => event.currentBookings + passengerCount <= event.maxCapacity
	)

	if (!targetEvent) {
		const tour = await tx.tour.findUnique({
			where: { id: tourId || "" },
			select: { maxCapacity: true },
		})

		const maxCapacity = tour?.maxCapacity || 12

		targetEvent = await tx.event.create({
			data: {
				serviceKind,
				...(tourId ? { tourId } : {}),
				...(transferServiceId ? { transferServiceId } : {}),
				date,
				mode,
				maxCapacity,
				startTime: startTime || null,
				endTime: endTime || null,
				comments: comments || null,
				status: "SCHEDULED",
				currentBookings: 0,
			},
		})
	}

	return targetEvent
}

async function createBookingForEvent(
	tx: PrismaTransactionClient,
	bookingData: SaleRecordFormSchema["eventBookings"][number],
	saleRecordId: string,
	passengerCount: number
) {
	let event
	if (bookingData.eventId) {
		const selectedEvent = await tx.event.findUniqueOrThrow({
			where: { id: bookingData.eventId },
		})
		if (selectedEvent.currentBookings + passengerCount > selectedEvent.maxCapacity) {
			throw new Error("El evento seleccionado no tiene capacidad suficiente")
		}
		event = selectedEvent
	} else {
		event = await findOrCreateEventForBooking(tx, {
			serviceId: bookingData.tourId,
			date: bookingData.date,
			mode: bookingData.mode,
			passengerCount,
			startTime: bookingData.startTime,
			endTime: bookingData.endTime,
			comments: bookingData.comments,
		})
	}

	const priceEntriesWithCount = (bookingData.priceEntries || []).filter((pe) => pe.count > 0)

	await tx.eventBooking.create({
		data: {
			saleRecordId,
			eventId: event.id,
			passengerCount,
			flyDate: bookingData.flyDate?.toISOString() || null,
			flyTime: bookingData.flyTime || null,
			flyName: bookingData.flyName || null,
			specialRequest: bookingData.specialRequest || null,
			priceEntries: {
				create: priceEntriesWithCount.map((pe) => ({
					count: pe.count,
					priceSnapshot: pe.price,
					receptionSnapshot: pe.reception,
					categoryName: pe.categoryName,
					// TRANSFER events use synthetic price categories; their ids are not real FKs.
					// Re-derive from event.serviceKind rather than trusting client payload.
					tourPriceCategoryId:
						event.serviceKind === "TRANSFER" ? null : (pe.priceCategoryId || null),
				})),
			},
			entrySnapshots: {
				create: (bookingData.entrySnapshots || [])
					.filter((snap) => snap.count > 0)
					.map((snap) => ({
						count: snap.count,
						priceSnapshot: snap.price,
						entryName: snap.entryName,
						variantName: snap.variantName,
						categoryName: snap.categoryName,
						tourEntryId: snap.tourEntryId || null,
					})),
			},
		},
	})

	await tx.event.update({
		where: { id: event.id },
		data: {
			currentBookings: {
				increment: passengerCount,
			},
		},
	})
}

export interface PaginatedSaleRecords {
	data: SaleRecordWithDetails[]
	total: number
	page: number
	pageSize: number
}

const SALE_SORTABLE_FIELDS = ["voucher", "channel", "status", "fileNumber", "createdAt"] as const
export type SaleSort = { field: string; order: "asc" | "desc" }

function buildSaleRecordWhere(rawFilters?: SaleRecordFilters): Prisma.SaleRecordWhereInput {
	// Sanitize at the choke point: strip unknown / invalid values before any DB access.
	// .catch(undefined) per field means safeParse essentially always succeeds;
	// the ?? undefined guard handles a totally non-object input.
	const filters = rawFilters != null
		? saleRecordFiltersSchema.safeParse(rawFilters).data ?? undefined
		: undefined

	const where: Prisma.SaleRecordWhereInput = {}

	if (filters?.type) {
		where.type = filters.type
	}

	if (filters?.channel) {
		where.channel = filters.channel
	}

	if (filters?.sellerId) {
		where.sellerId = filters.sellerId
	}

	if (filters?.wholesaleAgencyId) {
		where.wholesaleAgencyId = filters.wholesaleAgencyId
	}

	if (filters?.clientEmail) {
		where.clientEmail = {
			contains: filters.clientEmail,
			mode: "insensitive",
		}
	}

	if (filters?.status) {
		where.status = filters.status
	}

	if (filters?.startDate || filters?.endDate) {
		where.createdAt = {}
		if (filters.startDate) {
			where.createdAt.gte = filters.startDate
		}
		if (filters.endDate) {
			where.createdAt.lte = filters.endDate
		}
	}

	if (filters?.search) {
		const term = filters.search.trim()
		const numericTerm = Number(term)

		where.AND = [
			...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
			{
				OR: [
					{ fileNumber: { contains: term, mode: "insensitive" } },
					{ seller: { name: { contains: term, mode: "insensitive" } } },
					{ agency: { name: { contains: term, mode: "insensitive" } } },
					{ wholesaleAgency: { name: { contains: term, mode: "insensitive" } } },
					{ passengers: { some: { name: { contains: term, mode: "insensitive" } } } },
					// voucher is a Postgres int4: guard the upper bound (2_147_483_647)
					// so large numeric terms don't overflow the column and 500 the query
					...(Number.isInteger(numericTerm) &&
					numericTerm > 0 &&
					numericTerm <= 2_147_483_647
						? [{ voucher: numericTerm }]
						: []),
				],
			},
		]
	}

	return where
}

export async function getSaleRecords(
	filters?: SaleRecordFilters,
	page = 1,
	pageSize = 50,
	sort?: SaleSort | null
): Promise<PaginatedSaleRecords> {
	try {
		await getAuthUser()
		const where = buildSaleRecordWhere(filters)

		const [sales, total] = await Promise.all([
			prisma.saleRecord.findMany({
				where,
				include: {
					seller: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
					agency: {
						select: {
							id: true,
							name: true,
							contactEmails: true,
						},
					},
					wholesaleAgency: {
						select: {
							id: true,
							name: true,
						},
					},
					passengers: { include: { hotels: { orderBy: { order: "asc" } } } },
					paymentRecords: true,
					convertedFromQuote: {
						select: {
							id: true,
							voucher: true,
						},
					},
					convertedToSale: {
						select: {
							id: true,
							voucher: true,
						},
					},
					eventBookings: {
						include: {
							priceEntries: true,
							entrySnapshots: true,
							bookingPassengers: {
								include: {
									passenger: {
										select: { id: true, name: true },
									},
								},
							},
							event: {
								include: {
									tour: {
										select: {
											id: true,
											name: true,
										},
									},
									transferService: { select: { id: true, name: true } },
								},
							},
						},
					},
				},
				orderBy: (() => {
					const isValidSort =
						sort && (SALE_SORTABLE_FIELDS as readonly string[]).includes(sort.field)
					return isValidSort
						? ({ [sort.field]: sort.order } as Prisma.SaleRecordOrderByWithRelationInput)
						: { createdAt: "desc" as const }
				})(),
				skip: (page - 1) * pageSize,
				take: pageSize,
			}),
			prisma.saleRecord.count({ where }),
		])

		return {
			data: sales as unknown as SaleRecordWithDetails[],
			total,
			page,
			pageSize,
		}
	} catch (error) {
		console.error("Error fetching sale records:", error)
		throw new Error("Error al obtener los registros de ventas")
	}
}

export async function getSaleRecordById(id: string): Promise<SaleRecordWithDetails | null> {
	try {
		await getAuthUser()
		const sale = await prisma.saleRecord.findUnique({
			where: { id },
			include: {
				seller: {
					select: {
						id: true,
						name: true,
						email: true,
					},
				},
				agency: {
					select: {
						id: true,
						name: true,
						contactEmails: true,
					},
				},
				wholesaleAgency: {
					select: {
						id: true,
						name: true,
					},
				},
				passengers: { include: { hotels: { orderBy: { order: "asc" } } } },
				paymentRecords: true,
				convertedFromQuote: {
					select: {
						id: true,
						voucher: true,
					},
				},
				convertedToSale: {
					select: {
						id: true,
						voucher: true,
					},
				},
				eventBookings: {
					include: {
						priceEntries: true,
						entrySnapshots: true,
						bookingPassengers: {
							include: {
								passenger: {
									select: { id: true, name: true },
								},
							},
						},
						event: {
							include: {
								tour: {
									select: {
										id: true,
										name: true,
										generalSummaryEs: true,
										generalSummaryEn: true,
										generalSummaryPt: true,
										scheduleEs: true,
										scheduleEn: true,
										schedulePt: true,
										includesEs: true,
										includesEn: true,
										includesPt: true,
										pickupEs: true,
										pickupEn: true,
										pickupPt: true,
										whatToBringEs: true,
										whatToBringEn: true,
										whatToBringPt: true,
										altitudeEs: true,
										altitudeEn: true,
										altitudePt: true,
									},
								},
								transferService: { select: { id: true, name: true } },
							},
						},
					},
				},
			},
		})

		if (!sale) return null

		const eventIds = sale.eventBookings.map((booking) => booking.event.id)
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

		const enrichedEventBookings = sale.eventBookings.map((booking) => {
			const transferredIds = transferredIdsByEvent.get(booking.event.id) || new Set<string>()
			const transferredNames = transferredNamesByEvent.get(booking.event.id) || new Set<string>()
			const transferredPassengerIds = new Set<string>()

			for (const passenger of sale.passengers) {
				if (transferredIds.has(passenger.id)) {
					transferredPassengerIds.add(passenger.id)
					continue
				}

				const normalizedName = passenger.name?.trim().toLowerCase()
				if (normalizedName && transferredNames.has(normalizedName)) {
					transferredPassengerIds.add(passenger.id)
				}
			}

			const transferredPassengerCount = Math.min(
				booking.passengerCount,
				transferredPassengerIds.size
			)
			const remainingPassengerCount = Math.max(
				0,
				booking.passengerCount - transferredPassengerCount
			)
			const isFullyTransferred = booking.passengerCount > 0 && remainingPassengerCount === 0
			const isPartiallyTransferred = transferredPassengerCount > 0 && remainingPassengerCount > 0

			return {
				...booking,
				transferredPassengerCount,
				remainingPassengerCount,
				isFullyTransferred,
				isPartiallyTransferred,
			}
		})

		return {
			...sale,
			eventBookings: enrichedEventBookings,
		} as unknown as SaleRecordWithDetails
	} catch (error) {
		console.error("Error fetching sale record:", error)
		throw new Error("Error al obtener el registro de venta")
	}
}

export async function createSaleRecord(data: SaleRecordFormSchema) {
	try {
		const user = await getAuthUser()
		const canInteract = await canCurrentUserInteractPaths([
			"/dashboard/registro-de-ventas",
			"/dashboard/navegacion-ventas",
			"/dashboard/navegacion-cotizacion",
		])

		if (!canInteract) {
			throw new Error("No autorizado para interactuar con ventas")
		}

		const validatedData = saleRecordFormSchema.parse(data)

		if (!validatedData.type) throw new Error("El tipo de registro es obligatorio")
		if (!validatedData.channel) throw new Error("El canal de venta es obligatorio")
		if (!validatedData.eventBookings || validatedData.eventBookings.length === 0) {
			throw new Error("Debe agregar al menos un evento")
		}

		let voucherNumber = await generateVoucherNumber()

		let isUnique = (await prisma.saleRecord.count({ where: { voucher: voucherNumber } })) === 0
		while (!isUnique) {
			voucherNumber = await generateVoucherNumber()
			isUnique = (await prisma.saleRecord.count({ where: { voucher: voucherNumber } })) === 0
		}

		const wholesalePaymentTerm =
			validatedData.channel === "WHOLESALE" && validatedData.paymentPending
				? "POSTPAID"
				: "IMMEDIATE"

		const saleRecord = await prisma.$transaction(async (tx) => {
			const sale = await tx.saleRecord.create({
				data: {
					voucher: voucherNumber,
					type: validatedData.type,
					channel: validatedData.channel,
					comments: validatedData.comments || null,
					fileNumber: validatedData.fileNumber || null,
					discount: validatedData.discount ? Number(validatedData.discount) : 0,
					sellerId: user.id,
					agencyId: validatedData.agencyId || null,
					isWholesale: validatedData.isWholesale || false,
					wholesalePaymentTerm,
					wholesaleAgencyId: validatedData.wholesaleAgencyId || null,
					wholesaleMarkup: 30,
					convertedFromQuoteId: validatedData.convertedFromQuoteId || null,
					passengers: {
						create: validatedData.passengerArray.map((passenger) => ({
							name: passenger.name || null,
							document: passenger.rut || null,
							age: passenger.age ? Number(passenger.age) : null,
							nationality: passenger.nacionality || null,
							diet: passenger.diet_type || null,
							dietOther: passenger.dietOther || null,
							allergies: passenger.allergies || [],
							phone: passenger.phone || null,
							email: passenger.email || null,
							complimentary: passenger.complimentary ?? false,
							complimentaryCategory: passenger.complimentary
								? passenger.complimentaryCategory || null
								: null,
							...(passenger.hotels?.length > 0 && {
								hotels: {
									create: passenger.hotels
										.filter((h) => h.hotelName?.trim())
										.map((h, idx) => ({
											hotelName: h.hotelName!.trim(),
											checkIn: h.checkIn ? parseCalendarDay(formatCalendarDay(h.checkIn, "yyyy-MM-dd")) : null,
											checkOut: h.checkOut ? parseCalendarDay(formatCalendarDay(h.checkOut, "yyyy-MM-dd")) : null,
											order: idx,
										})),
								},
							}),
						})),
					},
					paymentRecords: {
						create: validatedData.paymentArray.map((payment) => {
							if (!payment.method) throw new Error("El método de pago es obligatorio")
							if (!payment.amount || +payment.amount === 0) {
								throw new Error("El monto del pago debe ser mayor a 0")
							}
							if (!payment.movement_date) throw new Error("La fecha del pago es obligatoria")
							const normalizedPayment = getNormalizedPaymentAmounts(payment)

							return {
								method: payment.method,
								amount: normalizedPayment.amountInClp,
								currency: normalizedPayment.currency,
								originalAmount: normalizedPayment.originalAmount,
								exchangeRate: normalizedPayment.exchangeRate,
								date: payment.movement_date,
								refund: payment.refund || false,
								comments: payment.comments || null,
								documentNumber: payment.document_number,
							}
						}),
					},
				},
			})

			for (const bookingData of validatedData.eventBookings) {
				await createBookingForEvent(tx, bookingData, sale.id, validatedData.passengerArray.length)
			}

			// Create BookingPassenger rows for all passenger × booking combinations
			const [createdPassengers, createdBookings] = await Promise.all([
				tx.passenger.findMany({
					where: { saleRecordId: sale.id },
					select: { id: true },
					orderBy: { id: "asc" },
				}),
				tx.eventBooking.findMany({
					where: { saleRecordId: sale.id },
					select: { id: true },
				}),
			])

			if (createdPassengers.length > 0 && createdBookings.length > 0) {
				await tx.bookingPassenger.createMany({
					data: createdBookings.flatMap((booking) =>
						createdPassengers.map((passenger) => ({
							eventBookingId: booking.id,
							passengerId: passenger.id,
							excluded: false,
						}))
					),
				})
			}

			await applyFirstEventDate(sale.id, tx)

			return sale
		}, { timeout: 20000, maxWait: 10000 })

		// Fetch the complete record to return
		const completeRecord = await prisma.saleRecord.findUnique({
			where: { id: saleRecord.id },
			include: {
				seller: {
					select: {
						id: true,
						name: true,
						email: true,
					},
				},
				agency: {
					select: {
						id: true,
						name: true,
						contactEmails: true,
					},
				},
				wholesaleAgency: {
					select: {
						id: true,
						name: true,
					},
				},
				passengers: { include: { hotels: { orderBy: { order: "asc" } } } },
				paymentRecords: true,
				eventBookings: {
					include: {
						priceEntries: true,
						entrySnapshots: true,
						bookingPassengers: {
							include: {
								passenger: {
									select: { id: true, name: true },
								},
							},
						},
						event: {
							include: {
								tour: {
									select: {
										id: true,
										name: true,
									},
								},
								transferService: { select: { id: true, name: true } },
							},
						},
					},
				},
			},
		})

		// Register ALL payments in cash flow (only for SALE type, not quotes)
		if (completeRecord && validatedData.type === "SALE") {
			for (const payment of completeRecord.paymentRecords) {
				if (!payment.refund && payment.amount > 0) {
					const paymentCurrency = (payment as { currency?: "CLP" | "USD" }).currency || "CLP"
					const paymentOriginalAmount =
						(payment as { originalAmount?: number | null }).originalAmount ?? undefined
					const paymentExchangeRate =
						(payment as { exchangeRate?: number | null }).exchangeRate ?? undefined

					try {
						await registerCashIncomeFromPayment(
							payment.id,
							payment.amount,
							voucherNumber,
							user.id,
							payment.method as
								| "CASH"
								| "TRANSFER"
								| "CREDIT_CARD"
								| "DEBIT_CARD"
								| "PAYMENT_LINK_DEBIT"
								| "PAYMENT_LINK_CREDIT",
							paymentCurrency,
							paymentOriginalAmount,
							paymentExchangeRate
						)
					} catch (cashFlowError) {
						console.error("Error registering payment in cash flow:", cashFlowError)
						// Don't fail the sale creation if cash flow registration fails
					}
				}
			}
		}

		// Audit: log the creation (outside transaction — failure must not roll back the sale)
		if (completeRecord) {
			try {
				await AuditService.logCreate(
					"SaleRecord",
					saleRecord.id,
					user,
					buildSaleAuditSnapshot(completeRecord) as Record<string, AuditFieldValue>,
					{
						voucher: voucherNumber,
						type: validatedData.type,
						passengersCount: validatedData.passengerArray.length,
						paymentsCount: validatedData.paymentArray.length,
						eventsCount: validatedData.eventBookings.length,
					}
				)
			} catch (e) {
				console.error("[sale-record-audit] logCreate failed", e)
			}
		}

		await notifySaleVoucherByEmail(saleRecord.id)

		return { success: true, data: completeRecord as unknown as SaleRecordWithDetails }
	} catch (error) {
		console.error("Error creating sale record:", error)
		if (error instanceof Error) {
			return { success: false, error: error.message }
		}
		return { success: false, error: "Error al crear el registro de venta" }
	}
}

export async function updateSaleRecord(id: string, data: SaleRecordFormSchema, reason?: string) {
	try {
		const user = await getAuthUser()
		const canInteract = await canCurrentUserInteractPaths([
			"/dashboard/registro-de-ventas",
			"/dashboard/navegacion-ventas",
			"/dashboard/navegacion-cotizacion",
		])

		if (!canInteract) {
			throw new Error("No autorizado para interactuar con ventas")
		}

		// Validar los datos
		const validatedData = saleRecordFormSchema.parse(data)

		// Obtener el registro actual para comparar cambios (para auditoría)
		// wholesaleInvoiceLine included for invoiced-gate detection (REQ-2)
		const currentRecord = await prisma.saleRecord.findUnique({
			where: { id },
			include: {
				passengers: { include: { hotels: { orderBy: { order: "asc" } } } },
				paymentRecords: true,
				eventBookings: {
					include: {
						priceEntries: {
							select: { count: true, priceSnapshot: true, categoryName: true },
						},
						entrySnapshots: {
							select: {
								count: true,
								priceSnapshot: true,
								entryName: true,
								variantName: true,
							},
						},
						event: {
							include: {
								tour: true,
								transferService: { select: { id: true, name: true } },
							},
						},
					},
				},
				wholesaleInvoiceLine: true,
			},
		})

		if (!currentRecord) {
			throw new Error("Registro no encontrado")
		}

		// Capturar pagos anteriores para comparación de flujo de caja (ANTES de la transacción)
		const oldCashPayments = currentRecord.paymentRecords.map((p) => ({
			amount: p.amount,
			method: p.method as string,
			currency: (p as { currency?: string }).currency || "CLP",
			refund: p.refund,
		}))

		// Mapear nuevos pagos del formulario para comparación (usando getNormalizedPaymentAmounts)
		const newCashPayments = validatedData.paymentArray.map((p) => {
			const normalized = getNormalizedPaymentAmounts(p)
			return {
				amount: normalized.amountInClp,
				method: p.method as string,
				currency: normalized.currency,
				refund: p.refund || false,
			}
		})

		const shouldRecalcCashFlow =
			validatedData.type === "SALE" &&
			paymentsAffectingCashChanged(oldCashPayments, newCashPayments)

		// Build old snapshot before the transaction (currentRecord already includes
		// passengers, paymentRecords, and eventBookings with event.tour)
		const oldSnapshot = buildSaleAuditSnapshot(currentRecord)

		const newDiscount = validatedData.discount ? Number(validatedData.discount) : 0

		const wholesalePaymentTerm =
			validatedData.channel === "WHOLESALE" && validatedData.paymentPending
				? "POSTPAID"
				: "IMMEDIATE"

		// ── Invoiced-sale approval gate (REQ-3) ──────────────────────────────
		// Non-admin editing an invoiced sale → route to approval (no direct mutation).
		// No-op detection uses the SAME snapshot machinery as the audit layer:
		// buildSaleAuditSnapshotFromInput(validatedData, currentRecord) produces a
		// comparable snapshot, then detectChanges(oldSnapshot, newSnapshot) determines
		// whether a real change was made (gate == audit invariant).
		// Covered: all scalars, passenger names+documents, payment summary (including
		// USD originalAmount), booking service identity (tour/transfer name), booking
		// passengerCount, and priceEntries/entrySnapshots per booking.
		if (isInvoiced(currentRecord) && user.role !== "admin") {
			const isNoOp = isSaleNoOp(oldSnapshot, validatedData, currentRecord)

			if (!isNoOp) {
				// Reason is required by requestApprovalSchema. If not provided yet, signal
				// the client to collect it before re-submitting.
				if (!reason?.trim()) {
					return {
						success: true,
						approvalRequired: true as const,
						needsReason: true as const,
					}
				}

				const fingerprint = computeFingerprint(currentRecord)
				const approvalResult = await requestApproval({
					action: APPROVAL_ACTION.UPDATE_INVOICED_SALE,
					targetType: "sale-record",
					targetId: id,
					payload: validatedData,
					reason: reason.trim(),
					targetFingerprint: fingerprint,
					source: { path: "/dashboard/registro-de-ventas" },
				})

				if ("error" in approvalResult) {
					return { success: false, error: approvalResult.message }
				}

				if (approvalResult.approvalRequired) {
					return {
						success: true,
						approvalRequired: true as const,
						requestId: approvalResult.requestId,
					}
				}
				// If gate is off (isDomainGated false), fall through to direct update
			}
			// No-op: fall through to direct update (no-op will be a no-change commit)
		}

		// Actualizar el registro principal y sus relaciones dentro de una transacción
		// (extracted to applySaleUpdateTx — behavior-preserving)
		const updatedSale = await prisma.$transaction(
			(tx) => applySaleUpdateTx(tx, id, validatedData, currentRecord),
			{ timeout: 30000 }
		)

		// Recalcular flujo de caja si los pagos que afectan caja cambiaron
		let cashFlowSummary: { reversedNetClp: number; reversedNetUsd: number; reRegisteredCount: number; newIncomeTotal: number } | null = null
		if (shouldRecalcCashFlow) {
			// Re-fetch new PaymentRecords (ids ya generados por la transacción)
			const newPaymentRecords = await prisma.paymentRecord.findMany({
				where: { saleRecordId: id },
				select: {
					id: true,
					amount: true,
					method: true,
					currency: true,
					originalAmount: true,
					exchangeRate: true,
					refund: true,
				},
			})
			try {
				cashFlowSummary = await recalculateSaleCashFlowOnEdit({
					voucher: currentRecord.voucher,
					newPayments: newPaymentRecords.map((p) => ({
						id: p.id,
						amount: p.amount,
						method: p.method as string,
						currency: (p.currency as string) || "CLP",
						originalAmount: p.originalAmount ?? null,
						exchangeRate: p.exchangeRate ?? null,
						refund: p.refund,
					})),
					userId: user.id,
				})
			} catch (cashFlowError) {
				console.error("Error recalculando flujo de caja en edición de venta:", cashFlowError)
				// No fallar la edición si el flujo de caja falla — mismo patrón que createSaleRecord y transferencias
			}
		}

		// Build new snapshot from post-transaction re-fetch, then log the update.
		// AuditService.logUpdate calls detectChanges internally; returns null on no-op → no row written.
		// This also catches nested-only changes (passenger/payment/booking summary diffs).
		const newSnapshot = updatedSale ? buildSaleAuditSnapshot(updatedSale) : oldSnapshot
		try {
			await AuditService.logUpdate(
				"SaleRecord",
				id,
				user,
				oldSnapshot,
				newSnapshot,
				{
					voucher: currentRecord.voucher,
					type: currentRecord.type,
					passengersCount: validatedData.passengerArray.length,
					paymentsCount: validatedData.paymentArray.length,
					eventsCount: validatedData.eventBookings.length,
					...(cashFlowSummary && {
						cashFlowReversedNetClp: cashFlowSummary.reversedNetClp,
						cashFlowReversedNetUsd: cashFlowSummary.reversedNetUsd,
						cashFlowReRegisteredCount: cashFlowSummary.reRegisteredCount,
						cashFlowNewIncomeTotal: cashFlowSummary.newIncomeTotal,
					}),
				}
			)
		} catch (e) {
			console.error("[sale-record-audit] logUpdate failed", e)
		}

		await notifySaleVoucherByEmail(id)

		return { success: true, data: updatedSale as unknown as SaleRecordWithDetails }
	} catch (error) {
		console.error("Error updating sale record:", error)
		if (error instanceof Error) {
			return { success: false, error: error.message }
		}
		return { success: false, error: "Error al actualizar el registro de venta" }
	}
}

export async function updateBookingPassengerExclusions(input: {
	saleRecordId: string
	exclusions: Array<{
		eventBookingId: string
		passengerId: string
		excluded: boolean
		excludeReason?: string
	}>
}) {
	try {
		await getAuthUser()
		const canInteract = await canCurrentUserInteractPaths([
			"/dashboard/registro-de-ventas",
			"/dashboard/navegacion-ventas",
		])

		if (!canInteract) {
			throw new Error("No autorizado para modificar exclusiones de pasajeros")
		}

		const { saleRecordId, exclusions } = input

		await prisma.$transaction(async (tx) => {
			// Upsert each exclusion
			const affectedBookingIds = new Set<string>()
			for (const exclusion of exclusions) {
				await tx.bookingPassenger.upsert({
					where: {
						eventBookingId_passengerId: {
							eventBookingId: exclusion.eventBookingId,
							passengerId: exclusion.passengerId,
						},
					},
					update: {
						excluded: exclusion.excluded,
						excludeReason: exclusion.excluded ? (exclusion.excludeReason ?? null) : null,
					},
					create: {
						eventBookingId: exclusion.eventBookingId,
						passengerId: exclusion.passengerId,
						excluded: exclusion.excluded,
						excludeReason: exclusion.excluded ? (exclusion.excludeReason ?? null) : null,
					},
				})
				affectedBookingIds.add(exclusion.eventBookingId)
			}

			// Recalculate passengerCount for each affected booking
			const affectedEventIds = new Set<string>()
			for (const bookingId of affectedBookingIds) {
				const activeCount = await tx.bookingPassenger.count({
					where: { eventBookingId: bookingId, excluded: false },
				})

				const booking = await tx.eventBooking.update({
					where: { id: bookingId },
					data: { passengerCount: activeCount },
					select: { eventId: true },
				})

				affectedEventIds.add(booking.eventId)
			}

			// Recalculate Event.currentBookings for each affected event
			for (const eventId of affectedEventIds) {
				const totalActive = await tx.eventBooking.aggregate({
					where: { eventId, cancelled: false },
					_sum: { passengerCount: true },
				})

				await tx.event.update({
					where: { id: eventId },
					data: { currentBookings: totalActive._sum.passengerCount ?? 0 },
				})
			}
		}, { timeout: 20000, maxWait: 10000 })

		const { revalidatePath } = await import("next/cache")
		revalidatePath("/dashboard/registro-de-ventas")
		revalidatePath(`/dashboard/registro-de-ventas/${saleRecordId}`)

		return { success: true }
	} catch (error) {
		console.error("Error updating booking passenger exclusions:", error)
		if (error instanceof Error) {
			return { success: false, error: error.message }
		}
		return { success: false, error: "Error al actualizar exclusiones de pasajeros" }
	}
}

/**
 * Solicita autorización para eliminar (cancelar) un registro de venta.
 * Usa el flujo asincrónico: crea ApprovalRequest y notifica al admin.
 * El executor (delete-sale-record.executor.ts) ejecuta la cancelación al aprobarse.
 */
export async function deleteSaleRecord(id: string, reason: string) {
	try {
		const user = await getAuthUser()
		const canInteract = await canCurrentUserInteractPaths([
			"/dashboard/registro-de-ventas",
			"/dashboard/navegacion-ventas",
			"/dashboard/navegacion-cotizacion",
		])

		if (!canInteract) {
			return { success: false, error: "No autorizado para interactuar con ventas" }
		}

		if (!reason.trim()) {
			return { success: false, error: "Debe indicar el motivo" }
		}

		const currentRecord = await prisma.saleRecord.findUnique({
			where: { id },
			select: { voucher: true, type: true, status: true, updatedAt: true },
		})

		if (!currentRecord) {
			return { success: false, error: "Registro no encontrado" }
		}

		if (currentRecord.status === "CANCELLED") {
			return { success: false, error: "El registro ya está cancelado" }
		}

		const fingerprint = computeFingerprint(currentRecord)
		const snapshot = buildSnapshot("sales", {
			id,
			status: currentRecord.status,
			voucher: currentRecord.voucher,
			type: currentRecord.type,
		})

		const result = await requestApproval({
			action: APPROVAL_ACTION.DELETE_SALE_RECORD,
			targetType: "sale-record",
			targetId: id,
			payload: { reason: reason.trim() },
			reason: reason.trim(),
			targetFingerprint: fingerprint,
			snapshot,
			source: { path: "/dashboard/registro-de-ventas", ui: "delete-sale-dialog" },
		})

		if ("error" in result) {
			return { success: false, error: result.message }
		}

		return {
			success: true,
			approvalRequired: result.approvalRequired,
			requestId: result.approvalRequired ? result.requestId : undefined,
			user,
		}
	} catch (error) {
		console.error("Error requesting sale record deletion:", error)
		if (error instanceof Error) {
			return { success: false, error: error.message }
		}
		return { success: false, error: "Error al solicitar la cancelación del registro de venta" }
	}
}

/**
 * Solicita autorización para anular (soft-cancel) un registro de venta.
 * Usa el flujo asincrónico: crea ApprovalRequest y notifica al admin.
 * El executor (cancel-sale-record.executor.ts) actualiza status a CANCELLED al aprobarse.
 */
export async function cancelSaleRecord(id: string, reason: string) {
	try {
		const user = await getAuthUser()
		const canInteract = await canCurrentUserInteractPaths([
			"/dashboard/registro-de-ventas",
			"/dashboard/navegacion-ventas",
			"/dashboard/navegacion-cotizacion",
		])

		if (!canInteract) {
			return { success: false, error: "No autorizado para interactuar con ventas" }
		}

		if (!reason.trim()) {
			return { success: false, error: "Debe indicar el motivo de la anulación" }
		}

		const currentRecord = await prisma.saleRecord.findUnique({
			where: { id },
			select: { voucher: true, type: true, status: true, updatedAt: true },
		})

		if (!currentRecord) {
			return { success: false, error: "Registro no encontrado" }
		}

		if (currentRecord.status === "CANCELLED") {
			return { success: false, error: "El registro ya está anulado" }
		}

		const fingerprint = computeFingerprint(currentRecord)
		const snapshot = buildSnapshot("sales", {
			id,
			status: currentRecord.status,
			voucher: currentRecord.voucher,
			type: currentRecord.type,
		})

		const result = await requestApproval({
			action: APPROVAL_ACTION.CANCEL_SALE_RECORD,
			targetType: "sale-record",
			targetId: id,
			payload: { reason: reason.trim() },
			reason: reason.trim(),
			targetFingerprint: fingerprint,
			snapshot,
			source: { path: "/dashboard/registro-de-ventas", ui: "cancel-sale-dialog" },
		})

		if ("error" in result) {
			return { success: false, error: result.message }
		}

		return {
			success: true,
			approvalRequired: result.approvalRequired,
			requestId: result.approvalRequired ? result.requestId : undefined,
			user,
		}
	} catch (error) {
		console.error("Error requesting sale record cancellation:", error)
		if (error instanceof Error) {
			return { success: false, error: error.message }
		}
		return { success: false, error: "Error al solicitar la anulación del registro de venta" }
	}
}

export async function getSalesSummary(filters?: SaleRecordFilters): Promise<SalesSummary> {
	try {
		await getAuthUser()
		const now = new Date()
		const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

		// YoY: same month of previous year
		const firstDayLastYearSameMonth = new Date(now.getFullYear() - 1, now.getMonth(), 1)
		const lastDayLastYearSameMonth = new Date(now.getFullYear() - 1, now.getMonth() + 1, 0, 23, 59, 59, 999)

		const baseWhere = buildSaleRecordWhere(filters)
		const withCreatedAt = (
			where: Prisma.SaleRecordWhereInput,
			createdAt: Prisma.DateTimeFilter
		): Prisma.SaleRecordWhereInput => ({
			...where,
			AND: [
				...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
				{ createdAt },
			],
		})
		const saleWhere: Prisma.SaleRecordWhereInput = { ...baseWhere, type: "SALE" }
		const quoteWhere: Prisma.SaleRecordWhereInput = { ...baseWhere, type: "QUOTE" }

		const [
			totalSales,
			totalQuotes,
			salesThisMonth,
			quotesThisMonth,
			salesLastYearSameMonth,
			quotesLastYearSameMonth,
			convertedQuotes,
			salesWithPayments,
			salesThisMonthWithPayments,
			quotesWithPayments,
		] = await Promise.all([
			prisma.saleRecord.count({ where: saleWhere }),
			prisma.saleRecord.count({ where: quoteWhere }),
			prisma.saleRecord.count({
				where: withCreatedAt(saleWhere, { gte: firstDayOfMonth }),
			}),
			prisma.saleRecord.count({
				where: withCreatedAt(quoteWhere, { gte: firstDayOfMonth }),
			}),
			prisma.saleRecord.count({
				where: withCreatedAt(saleWhere, {
					gte: firstDayLastYearSameMonth,
					lte: lastDayLastYearSameMonth,
				}),
			}),
			prisma.saleRecord.count({
				where: withCreatedAt(quoteWhere, {
					gte: firstDayLastYearSameMonth,
					lte: lastDayLastYearSameMonth,
				}),
			}),
			prisma.saleRecord.count({
				where: { ...quoteWhere, convertedToSale: { isNot: null } },
			}),
			prisma.saleRecord.findMany({
				where: saleWhere,
				include: { paymentRecords: true },
			}),
			prisma.saleRecord.findMany({
				where: withCreatedAt(saleWhere, { gte: firstDayOfMonth }),
				include: { paymentRecords: true },
			}),
			prisma.saleRecord.findMany({
				where: quoteWhere,
				include: { paymentRecords: true },
			}),
		])

		let totalRevenue = 0
		salesWithPayments.forEach((sale) => {
			sale.paymentRecords.forEach((payment) => {
				if (!payment.refund) {
					totalRevenue += payment.amount
				} else {
					totalRevenue -= payment.amount
				}
			})
		})

		let monthlyRevenue = 0
		salesThisMonthWithPayments.forEach((sale) => {
			sale.paymentRecords.forEach((payment) => {
				if (!payment.refund) {
					monthlyRevenue += payment.amount
				} else {
					monthlyRevenue -= payment.amount
				}
			})
		})

		let pendingRevenue = 0
		quotesWithPayments.forEach((quote) => {
			quote.paymentRecords.forEach((payment) => {
				if (!payment.refund) {
					pendingRevenue += payment.amount
				} else {
					pendingRevenue -= payment.amount
				}
			})
		})

		const avgQuoteValue = totalQuotes > 0 ? pendingRevenue / totalQuotes : 0

		return {
			totalSales,
			totalQuotes,
			totalRevenue,
			pendingRevenue,
			salesThisMonth,
			quotesThisMonth,
			salesLastYearSameMonth,
			quotesLastYearSameMonth,
			monthlyRevenue,
			convertedQuotes,
			avgQuoteValue,
		}
	} catch (error) {
		console.error("Error fetching sales summary:", error)
		throw new Error("Error al obtener el resumen de ventas")
	}
}
