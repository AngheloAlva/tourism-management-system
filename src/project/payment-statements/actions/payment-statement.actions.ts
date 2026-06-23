"use server"

import { headers } from "next/headers"

import { parseCalendarDay, formatCalendarDay } from "@/shared/utils/calendar-day"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { calculateBookingRevenue } from "@/project/sales/utils/booking-revenue"
import { canCurrentUserInteractPath } from "@/project/roles/actions/role.actions"
import { getEventDisplayName } from "@/project/events/utils/event-display"

type WholesalePaymentMethod =
	| "CASH"
	| "TRANSFER"
	| "CREDIT_CARD"
	| "DEBIT_CARD"
	| "PAYMENT_LINK_DEBIT"
	| "PAYMENT_LINK_CREDIT"

import type {
	AgencyOption,
	PaymentStatementSale,
	PaymentStatementFilters,
	PaymentStatementSummary,
} from "../types/payment-statement.types"

async function getAuthUser() {
	const session = await auth.api.getSession({
		headers: await headers(),
	})

	if (!session?.user) {
		throw new Error("No autenticado")
	}

	return session.user
}

function mapInvoiceDocumentStatus(
	documentStatus: "PENDING" | "GENERATED" | "SENT" | null | undefined
): "pending" | "generated" | "sent" {
	if (documentStatus === "SENT") {
		return "sent"
	}

	if (documentStatus === "GENERATED") {
		return "generated"
	}

	return "pending"
}

function applyStatusFilter(
	sales: PaymentStatementSale[],
	status: PaymentStatementFilters["status"]
): PaymentStatementSale[] {
	if (!status || status === "all") {
		return sales
	}

	if (status === "paid") {
		return sales.filter((sale) => sale.isPaid)
	}

	if (status === "pending") {
		return sales.filter((sale) => !sale.isPaid)
	}

	return sales.filter((sale) => sale.documentStatus !== "pending")
}

/**
 * Obtiene las agencias que tienen ventas con fileNumber
 */
export async function getAgenciesWithSales(): Promise<AgencyOption[]> {
	try {
		await getAuthUser()

		const agencies = await prisma.agency.findMany({
			where: {
				active: true,
				wholesaleSales: {
					some: {
						fileNumber: { not: null },
						type: "SALE",
					},
				},
			},
			select: {
				id: true,
				name: true,
				_count: {
					select: {
						wholesaleSales: {
							where: {
								fileNumber: { not: null },
								type: "SALE",
							},
						},
					},
				},
			},
			orderBy: {
				name: "asc",
			},
		})

		return agencies.map((agency) => ({
			id: agency.id,
			name: agency.name,
			salesCount: agency._count.wholesaleSales,
		}))
	} catch (error) {
		console.error("Error fetching agencies with sales:", error)
		throw new Error("Error al obtener las agencias")
	}
}

/**
 * Obtiene las ventas de una agencia en un período específico
 */
export async function getPaymentStatementSales(
	filters: PaymentStatementFilters
): Promise<PaymentStatementSale[]> {
	try {
		await getAuthUser()

		if (!filters.agencyIds || filters.agencyIds.length === 0) {
			return []
		}

		// firstEventDate is @db.Date — normalize filter bounds to UTC midnight.
		const startDate = parseCalendarDay(formatCalendarDay(filters.startDate, "yyyy-MM-dd"))
		const endDate = parseCalendarDay(formatCalendarDay(filters.endDate, "yyyy-MM-dd"))

		const sales = await prisma.saleRecord.findMany({
			where: {
				wholesaleAgencyId: { in: filters.agencyIds },
				type: "SALE",
				fileNumber: { not: null },
				firstEventDate: {
					gte: startDate,
					lte: endDate,
				},
			},
			include: {
				wholesaleInvoiceLine: {
					select: {
						id: true,
						netAmount: true,
						grossAmount: true,
						invoice: {
							select: {
								id: true,
								status: true,
								documentStatus: true,
								totalAmount: true,
								paidAmount: true,
								pendingAmount: true,
								payments: {
									select: {
										id: true,
										amount: true,
										paymentDate: true,
										method: true,
										reference: true,
										notes: true,
									},
									orderBy: {
										paymentDate: "asc",
									},
								},
							},
						},
					},
				},
				eventBookings: {
					include: {
						priceEntries: {
							select: { count: true, priceSnapshot: true, receptionSnapshot: true },
						},
						entrySnapshots: {
							select: { count: true, priceSnapshot: true },
						},
						event: {
							include: {
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
							},
						},
					},
					orderBy: {
						event: { date: "asc" },
					},
				},
				paymentRecords: {
					orderBy: {
						date: "asc",
					},
				},
				passengers: {
					select: {
						id: true,
						name: true,
					},
					orderBy: {
						id: "asc",
					},
				},
				wholesaleAgency: {
					select: {
						id: true,
						name: true,
					},
				},
			},
			orderBy: {
				createdAt: "asc",
			},
		})

		const allEventIds = sales.flatMap((sale) =>
			sale.eventBookings.map((booking) => booking.event.id)
		)
		const transferDetailsByEvent =
			allEventIds.length > 0
				? await prisma.transferEventBooking.findMany({
						where: {
							eventId: { in: allEventIds },
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

		const projectedSales = sales.map((sale) => {
			// Calcular totales de eventos
			const eventsData = sale.eventBookings.map((booking) => {
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

				const revenue = calculateBookingRevenue(booking.priceEntries || [], booking.entrySnapshots || [])

				return {
					id: booking.id,
					eventId: booking.event.id,
					date: booking.event.date,
					tourName: getEventDisplayName(booking.event),
					participantCount: booking.passengerCount,
					amount: revenue.grandTotal,
					transferredPassengerCount,
					remainingPassengerCount,
					isFullyTransferred,
					isPartiallyTransferred,
				}
			})

			const eventsTotalAmount = eventsData.reduce((sum, e) => sum + e.amount, 0)

			const paidAmountFromSaleRecords = sale.paymentRecords.reduce((sum, payment) => {
				return payment.refund ? sum - payment.amount : sum + payment.amount
			}, 0)

			const invoiceLine = sale.wholesaleInvoiceLine
			const invoice = invoiceLine?.invoice

			const invoicePaymentsTotal =
				invoice?.payments.reduce((sum, payment) => sum + payment.amount, 0) ?? 0
			const invoicePaidAmount =
				invoicePaymentsTotal > 0 ? invoicePaymentsTotal : (invoice?.paidAmount ?? 0)

			const invoiceLineAmount = invoiceLine?.netAmount || invoiceLine?.grossAmount || 0
			const invoiceTotal = invoice?.totalAmount ?? 0
			const paymentRatio =
				invoice && invoiceTotal > 0 ? Math.min(1, Math.max(0, invoicePaidAmount / invoiceTotal)) : 0

			const totalAmount = invoiceLineAmount > 0 ? invoiceLineAmount : eventsTotalAmount
			const paidAmount =
				invoiceLineAmount > 0 && invoice
					? Math.min(totalAmount, totalAmount * paymentRatio)
					: paidAmountFromSaleRecords
			const pendingAmount = Math.max(0, totalAmount - paidAmount)
			const isPaid = pendingAmount <= 0 && totalAmount > 0

			const documentStatus = mapInvoiceDocumentStatus(invoice?.documentStatus)

			const firstPassengerName = sale.passengers[0]?.name ?? null

			return {
				id: sale.id,
				voucher: sale.voucher,
				fileNumber: sale.fileNumber,
				createdAt: sale.createdAt,
				invoiceId: invoice?.id ?? null,
				invoiceStatus: invoice?.status ?? null,
				agencyId: sale.wholesaleAgency?.id ?? null,
				agencyName: sale.wholesaleAgency?.name ?? null,
				firstPassengerName,
				totalAmount,
				paidAmount,
				pendingAmount,
				isPaid,
				documentStatus,
				events: eventsData,
				payments: sale.paymentRecords.map((payment) => ({
					id: payment.id,
					date: payment.date,
					method: payment.method,
					amount: payment.amount,
					refund: payment.refund,
				})),
			}
		})

		const sortedSales = projectedSales.sort((a, b) => {
			const numA = Number.parseInt(a.fileNumber?.replace(/\D/g, "") || "", 10)
			const numB = Number.parseInt(b.fileNumber?.replace(/\D/g, "") || "", 10)
			const safeA = Number.isFinite(numA) ? numA : Number.POSITIVE_INFINITY
			const safeB = Number.isFinite(numB) ? numB : Number.POSITIVE_INFINITY
			return safeA - safeB
		})

		return applyStatusFilter(sortedSales, filters.status)
	} catch (error) {
		console.error("Error fetching payment statement sales:", error)
		throw new Error("Error al obtener las ventas")
	}
}

interface RegisterWholesaleInvoicePaymentInput {
	invoiceId: string
	amount: number
	method: WholesalePaymentMethod
	paymentDate?: Date
	reference?: string
	notes?: string
}

export async function registerWholesaleInvoicePayment(input: RegisterWholesaleInvoicePaymentInput) {
	try {
		await getAuthUser()

		const canInteract = await canCurrentUserInteractPath("/facturacion")
		if (!canInteract) throw new Error("No tiene permisos para modificar facturación")

		if (!input.invoiceId) {
			throw new Error("Debe indicar una factura")
		}

		if (!Number.isFinite(input.amount) || input.amount <= 0) {
			throw new Error("El monto del pago debe ser mayor a 0")
		}

		return await prisma.$transaction(async (tx) => {
			const invoice = await tx.wholesaleInvoice.findUnique({
				where: { id: input.invoiceId },
				select: {
					id: true,
					totalAmount: true,
					paidAmount: true,
					pendingAmount: true,
					status: true,
				},
			})

			if (!invoice) {
				throw new Error("Factura mayorista no encontrada")
			}

			const currentPending = Math.max(
				0,
				invoice.pendingAmount || invoice.totalAmount - invoice.paidAmount
			)

			if (currentPending <= 0) {
				throw new Error("La factura ya se encuentra completamente pagada")
			}

			if (input.amount > currentPending) {
				throw new Error("El monto no puede superar el saldo pendiente de la factura")
			}

			const balanceUpdate = await tx.wholesaleInvoice.updateMany({
				where: {
					id: input.invoiceId,
					pendingAmount: {
						gte: input.amount,
					},
				},
				data: {
					paidAmount: {
						increment: input.amount,
					},
					pendingAmount: {
						decrement: input.amount,
					},
				},
			})

			if (balanceUpdate.count === 0) {
				throw new Error(
					"No se pudo registrar el pago porque el saldo cambió. Actualice la página e intente nuevamente."
				)
			}

			const updatedInvoice = await tx.wholesaleInvoice.findUnique({
				where: { id: input.invoiceId },
				select: {
					pendingAmount: true,
					status: true,
				},
			})

			if (!updatedInvoice) {
				throw new Error("Factura mayorista no encontrada")
			}

			// paymentDate is @db.Date — normalize to UTC midnight.
			const rawPaymentDate = input.paymentDate ?? new Date()
			const payment = await tx.wholesaleInvoicePayment.create({
				data: {
					invoiceId: input.invoiceId,
					amount: input.amount,
					method: input.method,
					paymentDate: parseCalendarDay(formatCalendarDay(rawPaymentDate, "yyyy-MM-dd")),
					reference: input.reference || undefined,
					notes: input.notes || undefined,
				},
			})

			const nextPendingAmount = Math.max(0, updatedInvoice.pendingAmount)
			const nextStatus = nextPendingAmount === 0 ? "PAID" : "PARTIALLY_PAID"

			if (
				nextPendingAmount !== updatedInvoice.pendingAmount ||
				nextStatus !== updatedInvoice.status
			) {
				await tx.wholesaleInvoice.update({
					where: { id: input.invoiceId },
					data: {
						pendingAmount: nextPendingAmount,
						status: nextStatus,
					},
				})
			}

			return {
				success: true,
				paymentId: payment.id,
			}
		})
	} catch (error) {
		console.error("Error registering wholesale invoice payment:", error)
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Error al registrar pago de factura mayorista",
		}
	}
}

/**
 * Obtiene el resumen de ventas para el período
 */
export async function getPaymentStatementSummary(
	filters: PaymentStatementFilters
): Promise<PaymentStatementSummary> {
	try {
		const sales = await getPaymentStatementSales(filters)

		const totalSales = sales.length
		const totalAmount = sales.reduce((sum, s) => sum + s.totalAmount, 0)
		const paidAmount = sales.reduce((sum, s) => sum + s.paidAmount, 0)
		const pendingAmount = sales.reduce((sum, s) => sum + s.pendingAmount, 0)
		const generatedCount = sales.filter((s) => s.documentStatus !== "pending").length
		const pendingGenerationCount = sales.filter((s) => s.documentStatus === "pending").length

		return {
			totalSales,
			totalAmount,
			paidAmount,
			pendingAmount,
			generatedCount,
			pendingGenerationCount,
		}
	} catch (error) {
		console.error("Error fetching payment statement summary:", error)
		throw new Error("Error al obtener el resumen")
	}
}

/**
 * Obtiene los datos para generar el PDF de estado de pago
 */
export async function getPaymentStatementPdfData(filters: PaymentStatementFilters) {
	try {
		await getAuthUser()

		if (!filters.agencyIds || filters.agencyIds.length === 0) {
			throw new Error("Debe seleccionar al menos una agencia")
		}

		const agencies = await prisma.agency.findMany({
			where: { id: { in: filters.agencyIds } },
			select: {
				id: true,
				name: true,
				taxId: true,
				address: true,
				phone: true,
			},
			orderBy: { name: "asc" },
		})

		if (agencies.length === 0) {
			throw new Error("Agencias no encontradas")
		}

		const sales = await getPaymentStatementSales(filters)

		const totalAmount = sales.reduce((sum, s) => sum + s.totalAmount, 0)
		const paidAmount = sales.reduce((sum, s) => sum + s.paidAmount, 0)
		const pendingAmount = sales.reduce((sum, s) => sum + s.pendingAmount, 0)

		return {
			agencies,
			period: {
				startDate: filters.startDate,
				endDate: filters.endDate,
			},
			sales,
			totals: {
				totalAmount,
				paidAmount,
				pendingAmount,
			},
			generatedAt: new Date(),
		}
	} catch (error) {
		console.error("Error fetching PDF data:", error)
		throw new Error("Error al obtener los datos para el PDF")
	}
}
