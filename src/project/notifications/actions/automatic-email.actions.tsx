"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { canSendEmails, resendClient, resendFromEmail } from "@/lib/email/resend"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { canCurrentUserInteractPaths } from "@/project/roles/actions/role.actions"
import {
	dedupeEmails,
	isValidEmail,
	getFirstValidEmail,
	getFirstAgencyEmail,
} from "@/lib/email/email-utils"

import { calculateBookingRevenue } from "@/project/sales/utils/booking-revenue"
import { getEventDisplayName } from "@/project/events/utils/event-display"
import { AgencyTransferEmail } from "../emails/agency-transfer-email"
import { SaleVoucherEmail } from "../emails/sale-voucher-email"
import { ReceptionEmail } from "../emails/reception-email"

function getBaseUrl() {
	const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim()
	if (!baseUrl) return undefined

	return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
}

function getWholesaleRecipientForSale(sale: {
	channel: "ONLINE" | "AGENCY" | "PHYSICAL" | "WHOLESALE"
	isWholesale: boolean
	agency: { contactEmails: string[] } | null
	wholesaleAgency: { contactEmails: string[] } | null
}) {
	if (sale.channel === "WHOLESALE") {
		return getFirstAgencyEmail(sale.agency?.contactEmails || [])
	}

	if (sale.channel === "ONLINE" && sale.isWholesale) {
		return getFirstAgencyEmail(sale.wholesaleAgency?.contactEmails || [])
	}

	return null
}

export async function notifySaleVoucherByEmail(saleId: string) {
	if (!canSendEmails() || !resendClient) return

	try {
		const sale = await prisma.saleRecord.findUnique({
			where: { id: saleId },
			include: {
				agency: {
					select: {
						name: true,
						contactEmails: true,
					},
				},
				wholesaleAgency: {
					select: {
						contactEmails: true,
					},
				},
				passengers: {
					select: {
						id: true,
						name: true,
						document: true,
						phone: true,
						nationality: true,
						age: true,
						email: true,
						hotels: {
							orderBy: { order: "asc" },
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
										id: true,
										name: true,
										generalSummaryEs: true,
										scheduleEs: true,
										includesEs: true,
										pickupEs: true,
										whatToBringEs: true,
										altitudeEs: true,
									},
								},
								transferService: { select: { id: true, name: true } },
							},
						},
					},
				},
			},
		})

		if (!sale || sale.type !== "SALE") {
			return
		}

		const customerEmail = getFirstValidEmail([
			sale.clientEmail,
			...sale.passengers.map((passenger) => passenger.email),
		])

		if (customerEmail && !sale.customerVoucherEmailSentAt) {
			const { error } = await resendClient.emails.send(
				{
					from: resendFromEmail,
					to: [customerEmail],
					subject: `Voucher V-${sale.voucher} - Turismo Chile Tours`,
					react: (
						<SaleVoucherEmail
							voucher={sale.voucher}
							createdAt={sale.createdAt}
							agencyName={sale.agency?.name}
							passengers={sale.passengers}
							events={sale.eventBookings.map((booking) => ({
								id: booking.id,
								date: booking.event.date,
								startTime: booking.event.startTime,
								endTime: booking.event.endTime,
								flyTime: booking.flyTime,
								tourId: booking.event.tour?.id || null,
								tourName: getEventDisplayName(booking.event),
								bookingTotal: calculateBookingRevenue(booking.priceEntries || [], booking.entrySnapshots || []).totalPrice,
								tourSummary: booking.event.tour?.generalSummaryEs || null,
								tourSchedule: booking.event.tour?.scheduleEs || null,
								tourIncludes: booking.event.tour?.includesEs || null,
								tourPickup: booking.event.tour?.pickupEs || null,
								tourWhatToBring: booking.event.tour?.whatToBringEs || null,
								tourAltitude: booking.event.tour?.altitudeEs || null,
								mode: booking.event.mode,
							}))}
							includePrice={true}
							baseUrl={getBaseUrl()}
						/>
					),
				},
				{
					idempotencyKey: `sale-voucher-customer/${sale.id}`,
				}
			)

			if (!error) {
				await prisma.saleRecord.update({
					where: { id: sale.id },
					data: {
						customerVoucherEmailSentAt: new Date(),
						customerVoucherEmailSentTo: customerEmail,
					},
				})
			} else {
				console.error("Error sending customer voucher email:", error)
			}
		}

		const wholesaleEmail = getWholesaleRecipientForSale(sale)
		if (!wholesaleEmail || sale.wholesaleVoucherEmailSentAt) {
			return
		}

		const { error: wholesaleError } = await resendClient.emails.send(
			{
				from: resendFromEmail,
				to: [wholesaleEmail],
				subject: `Copia voucher V-${sale.voucher} - Turismo Chile Tours`,
				react: (
					<SaleVoucherEmail
						voucher={sale.voucher}
						createdAt={sale.createdAt}
						agencyName={sale.agency?.name}
						passengers={sale.passengers}
						events={sale.eventBookings.map((booking) => ({
							id: booking.id,
							date: booking.event.date,
							startTime: booking.event.startTime,
							endTime: booking.event.endTime,
							flyTime: booking.flyTime,
							tourId: booking.event.tour?.id || null,
							tourName: getEventDisplayName(booking.event),
							bookingTotal: calculateBookingRevenue(booking.priceEntries || [], booking.entrySnapshots || []).totalPrice,
							tourSummary: booking.event.tour?.generalSummaryEs || null,
							tourSchedule: booking.event.tour?.scheduleEs || null,
							tourIncludes: booking.event.tour?.includesEs || null,
							tourPickup: booking.event.tour?.pickupEs || null,
							tourWhatToBring: booking.event.tour?.whatToBringEs || null,
							tourAltitude: booking.event.tour?.altitudeEs || null,
							mode: booking.event.mode,
						}))}
						includePrice={false}
						baseUrl={getBaseUrl()}
					/>
				),
			},
			{
				idempotencyKey: `sale-voucher-wholesale/${sale.id}`,
			}
		)

		if (!wholesaleError) {
			await prisma.saleRecord.update({
				where: { id: sale.id },
				data: {
					wholesaleVoucherEmailSentAt: new Date(),
					wholesaleVoucherEmailSentTo: wholesaleEmail,
				},
			})
		} else {
			console.error("Error sending wholesale voucher email:", wholesaleError)
		}
	} catch (error) {
		console.error("Error notifying sale voucher by email:", error)
	}
}

export async function notifyTransferCreatedByEmail(transferId: string) {
	if (!canSendEmails() || !resendClient) return

	try {
		const transfer = await prisma.agencyTransfer.findUnique({
			where: { id: transferId },
			include: {
				agency: {
					select: {
						name: true,
						contactEmails: true,
					},
				},
				createdByUser: {
					select: {
						name: true,
						email: true,
					},
				},
				saleRecord: {
					select: {
						voucher: true,
					},
				},
				eventBookings: {
					include: {
						event: {
							include: {
								tour: {
									select: {
										name: true,
									},
								},
								transferService: { select: { id: true, name: true } },
							},
						},
					},
				},
				passengers: {
					select: {
						name: true,
					},
				},
			},
		})

		if (!transfer || transfer.type !== "OUTGOING") {
			return
		}

		if (transfer.agencyNotificationEmailSentAt) {
			return
		}

		const agencyEmail = getFirstAgencyEmail(transfer.agency.contactEmails)
		if (!agencyEmail) {
			return
		}

		const executiveEmail = isValidEmail(transfer.createdByUser.email)
			? transfer.createdByUser.email
			: null

		const ccList = dedupeEmails([executiveEmail || ""]).filter((email) => email !== agencyEmail)

		const { error } = await resendClient.emails.send(
			{
				from: resendFromEmail,
				to: [agencyEmail],
				cc: ccList.length > 0 ? ccList : undefined,
				subject: `Traspaso T-${transfer.voucher} - ${transfer.agency.name}`,
				react: (
					<AgencyTransferEmail
						voucher={transfer.voucher}
						date={transfer.date}
						saleVoucher={transfer.saleRecord?.voucher || null}
						agencyName={transfer.agency.name}
						executiveName={transfer.createdByUser.name}
						comments={transfer.comments}
						events={transfer.eventBookings.map((booking) => ({
							id: booking.id,
							date: booking.event.date,
							tourName: getEventDisplayName(booking.event),
							passengerCount: booking.passengerCount,
						}))}
						passengerNames={transfer.passengers
							.map((passenger) => passenger.name?.trim())
							.filter((name): name is string => Boolean(name))}
					/>
				),
			},
			{
				idempotencyKey: `transfer-email/${transfer.id}`,
			}
		)

		if (!error) {
			await prisma.agencyTransfer.update({
				where: { id: transfer.id },
				data: {
					agencyNotificationEmailSentAt: new Date(),
					agencyNotificationEmailSentTo: agencyEmail,
					...(executiveEmail
						? {
								executiveNotificationEmailSentAt: new Date(),
								executiveNotificationEmailSentTo: executiveEmail,
							}
						: {}),
				},
			})
		} else {
			console.error("Error sending transfer email:", error)
		}
	} catch (error) {
		console.error("Error notifying transfer by email:", error)
	}
}

export async function notifyReceptionByEmail(transferId: string) {
	if (!canSendEmails() || !resendClient) return

	try {
		const reception = await prisma.agencyTransfer.findUnique({
			where: { id: transferId },
			include: {
				agency: {
					select: {
						name: true,
					},
				},
				createdByUser: {
					select: {
						name: true,
						email: true,
					},
				},
				passengers: {
					orderBy: {
						id: "asc",
					},
					select: {
						name: true,
						email: true,
					},
				},
				eventBookings: {
					include: {
						event: {
							include: {
								tour: {
									select: {
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

		if (!reception || reception.type !== "INCOMING") {
			return
		}

		const firstPassenger = reception.passengers[0]
		const passengerEmail = firstPassenger ? getFirstValidEmail([firstPassenger.email]) : null
		const executiveEmail = isValidEmail(reception.createdByUser.email)
			? reception.createdByUser.email
			: null

		if (!passengerEmail && !executiveEmail) {
			return
		}

		const alreadySentToPassenger = Boolean(reception.passengerNotificationEmailSentAt)
		const alreadySentToExecutive = Boolean(reception.executiveNotificationEmailSentAt)

		const mustSendPassenger = Boolean(passengerEmail && !alreadySentToPassenger)
		const mustSendExecutive = Boolean(executiveEmail && !alreadySentToExecutive)

		if (!mustSendPassenger && !mustSendExecutive) {
			return
		}

		const toList = dedupeEmails([
			...(mustSendPassenger && passengerEmail ? [passengerEmail] : []),
			...(!mustSendPassenger && mustSendExecutive && executiveEmail ? [executiveEmail] : []),
		])

		const ccList = dedupeEmails([
			...(mustSendPassenger && mustSendExecutive && executiveEmail ? [executiveEmail] : []),
		]).filter((email) => !toList.includes(email))

		if (toList.length === 0) {
			return
		}

		const { error } = await resendClient.emails.send(
			{
				from: resendFromEmail,
				to: toList,
				cc: ccList.length > 0 ? ccList : undefined,
				subject: `Recepcion R-${reception.voucher} - ${reception.agency.name}`,
				react: (
					<ReceptionEmail
						voucher={reception.voucher}
						date={reception.date}
						agencyName={reception.agency.name}
						executiveName={reception.createdByUser.name}
						passengerName={firstPassenger?.name || null}
						comments={reception.comments}
						events={reception.eventBookings.map((booking) => ({
							id: booking.id,
							date: booking.event.date,
							tourName: getEventDisplayName(booking.event),
							startTime: booking.event.startTime,
							endTime: booking.event.endTime,
						}))}
					/>
				),
			},
			{
				idempotencyKey: `reception-email/${reception.id}`,
			}
		)

		if (!error) {
			await prisma.agencyTransfer.update({
				where: { id: reception.id },
				data: {
					...(mustSendPassenger && passengerEmail
						? {
								passengerNotificationEmailSentAt: new Date(),
								passengerNotificationEmailSentTo: passengerEmail,
							}
						: {}),
					...(mustSendExecutive && executiveEmail
						? {
								executiveNotificationEmailSentAt: new Date(),
								executiveNotificationEmailSentTo: executiveEmail,
							}
						: {}),
				},
			})
		} else {
			console.error("Error sending reception email:", error)
		}
	} catch (error) {
		console.error("Error notifying reception by email:", error)
	}
}

// ==================== FORCE RESEND VOUCHER ====================

async function getAuthUser() {
	const session = await auth.api.getSession({
		headers: await headers(),
	})

	if (!session?.user) {
		throw new Error("No autenticado")
	}

	return session.user
}

export async function forceResendSaleVoucherByEmail(
	saleRecordId: string
): Promise<{ success: boolean; error?: string }> {
	try {
		// Auth
		await getAuthUser()

		// Permission — same paths as sale record updates + calendar (the CTA lives in sale detail + calendar context)
		const canInteract = await canCurrentUserInteractPaths([
			"/dashboard/registro-de-ventas",
			"/dashboard/navegacion-ventas",
			"/dashboard/calendario",
		])
		if (!canInteract) {
			return { success: false, error: "No autorizado" }
		}

		// Validate input
		z.cuid().parse(saleRecordId)

		if (!canSendEmails() || !resendClient) {
			return { success: false, error: "El servicio de emails no está disponible" }
		}

		const sale = await prisma.saleRecord.findUnique({
			where: { id: saleRecordId },
			include: {
				agency: {
					select: {
						name: true,
						contactEmails: true,
					},
				},
				wholesaleAgency: {
					select: {
						contactEmails: true,
					},
				},
				passengers: {
					select: {
						id: true,
						name: true,
						document: true,
						phone: true,
						nationality: true,
						age: true,
						email: true,
						hotels: {
							orderBy: { order: "asc" },
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
										id: true,
										name: true,
										generalSummaryEs: true,
										scheduleEs: true,
										includesEs: true,
										pickupEs: true,
										whatToBringEs: true,
										altitudeEs: true,
									},
								},
								transferService: { select: { id: true, name: true } },
							},
						},
					},
				},
			},
		})

		if (!sale || sale.type !== "SALE") {
			return { success: false, error: "Venta no encontrada" }
		}

		const customerEmail = getFirstValidEmail([
			sale.clientEmail,
			...sale.passengers.map((passenger) => passenger.email),
		])

		if (!customerEmail) {
			return { success: false, error: "El cliente no tiene un email válido registrado" }
		}

		const { error } = await resendClient.emails.send(
			{
				from: resendFromEmail,
				to: [customerEmail],
				subject: `Voucher V-${sale.voucher} - Turismo Chile Tours`,
				react: (
					<SaleVoucherEmail
						voucher={sale.voucher}
						createdAt={sale.createdAt}
						agencyName={sale.agency?.name}
						passengers={sale.passengers}
						events={sale.eventBookings.map((booking) => ({
							id: booking.id,
							date: booking.event.date,
							startTime: booking.event.startTime,
							endTime: booking.event.endTime,
							flyTime: booking.flyTime,
							tourId: booking.event.tour?.id || null,
							tourName: getEventDisplayName(booking.event),
							bookingTotal: calculateBookingRevenue(
								booking.priceEntries || [],
								booking.entrySnapshots || []
							).totalPrice,
							tourSummary: booking.event.tour?.generalSummaryEs || null,
							tourSchedule: booking.event.tour?.scheduleEs || null,
							tourIncludes: booking.event.tour?.includesEs || null,
							tourPickup: booking.event.tour?.pickupEs || null,
							tourWhatToBring: booking.event.tour?.whatToBringEs || null,
							tourAltitude: booking.event.tour?.altitudeEs || null,
							mode: booking.event.mode,
						}))}
						includePrice={true}
						baseUrl={getBaseUrl()}
					/>
				),
			},
			{
				// No idempotency key — force resend intentionally bypasses deduplication
			}
		)

		if (error) {
			console.error("Error force-resending customer voucher email:", error)
			return { success: false, error: "Error al enviar el email. Intente nuevamente." }
		}

		// Update: clear voucherOutdatedAt and refresh customerVoucherEmailSentAt
		await prisma.saleRecord.update({
			where: { id: saleRecordId },
			data: {
				voucherOutdatedAt: null,
				customerVoucherEmailSentAt: new Date(),
				customerVoucherEmailSentTo: customerEmail,
			},
		})

		revalidatePath("/dashboard/registro-de-ventas")
		revalidatePath("/dashboard/navegacion-ventas")

		return { success: true }
	} catch (error) {
		console.error("Error in forceResendSaleVoucherByEmail:", error)
		return { success: false, error: "Error al reenviar el voucher" }
	}
}
