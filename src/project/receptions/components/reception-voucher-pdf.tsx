import { Document, Page, Text, View, Image } from "@react-pdf/renderer"
import { format } from "date-fns"
import React from "react"

import { formatCalendarDay } from "@/shared/utils/calendar-day"

import {
	voucherStyles as styles,
	voucherLocaleMap as localeMap,
	VoucherTourDetailPage,
} from "@/project/sales/components/voucher-pdf"
import { getTranslations, type Language } from "@/project/sales/utils/voucher-translations"
import { formatHotelsSummary } from "@/project/sales/utils/resolve-hotel"

import type { ReceptionWithDetails } from "../actions/reception.actions"
import { getEventDisplayName, getEventServiceId } from "@/project/events/utils/event-display"

type TourWithDetails = NonNullable<ReceptionWithDetails["eventBookings"][number]["event"]["tour"]>
type PriceDetailItem = ReceptionWithDetails["priceDetails"][number]
type EventBookingItem = ReceptionWithDetails["eventBookings"][number]

/**
 * Compute per-booking totals from priceDetails using eventBookingId linkage.
 *
 * Three cases:
 * 1. ALL linked (non-null eventBookingId) → pure group-by eventBookingId.
 * 2. ALL unlinked (null eventBookingId, legacy rows) → prorate sum evenly across bookings.
 * 3. MIXED → group linked rows by booking, then distribute unlinked remainder evenly.
 *
 * Invariant: sum(per-booking totals) === sum(priceDetails tourPrice + entrancePrice).
 */
function computePerBookingTotals(
	priceDetails: PriceDetailItem[],
	eventBookings: EventBookingItem[],
): Record<string, number> {
	if (eventBookings.length === 0) return {}

	const linked = priceDetails.filter((pd) => pd.eventBookingId !== null)
	const unlinked = priceDetails.filter((pd) => pd.eventBookingId === null)

	const sumOf = (rows: PriceDetailItem[]) =>
		rows.reduce((acc, r) => acc + r.tourPrice + r.entrancePrice, 0)

	// Case 1: ALL linked — pure group-by
	if (unlinked.length === 0) {
		const totals: Record<string, number> = {}
		for (const booking of eventBookings) {
			totals[booking.id] = sumOf(linked.filter((pd) => pd.eventBookingId === booking.id))
		}
		return totals
	}

	// Case 2: ALL unlinked (legacy) — prorate evenly
	if (linked.length === 0) {
		const proratedShare = sumOf(unlinked) / eventBookings.length
		return Object.fromEntries(eventBookings.map((b) => [b.id, proratedShare]))
	}

	// Case 3: MIXED — group linked, distribute unlinked remainder evenly
	const totals: Record<string, number> = {}
	for (const booking of eventBookings) {
		totals[booking.id] = sumOf(linked.filter((pd) => pd.eventBookingId === booking.id))
	}
	const unlinkedShare = sumOf(unlinked) / eventBookings.length
	for (const booking of eventBookings) {
		totals[booking.id] += unlinkedShare
	}
	return totals
}

interface ReceptionVoucherPDFProps {
	reception: ReceptionWithDetails
	language?: Language
	includePrice?: boolean
}

export const ReceptionVoucherPDF: React.FC<ReceptionVoucherPDFProps> = ({
	reception,
	language = "es",
	includePrice = true,
}) => {
	const t = getTranslations(language)
	const locale = localeMap[language]

	const total = reception.priceDetails.reduce(
		(acc, p) => acc + p.tourPrice + p.entrancePrice,
		0
	)

	// Compute per-booking totals using eventBookingId linkage (three-case strategy).
	const totalsByBookingId = computePerBookingTotals(reception.priceDetails, reception.eventBookings)

	const uniqueTours = reception.eventBookings
		.filter((booking) => booking.event.tour !== null)
		.reduce(
			(acc, booking) => {
				const serviceId = getEventServiceId(booking.event)
				if (!acc.some((item) => item.serviceId === serviceId)) {
					acc.push({
						tour: booking.event.tour as TourWithDetails,
						serviceId,
						date: formatCalendarDay(booking.event.date, "dd/MM/yyyy"),
					})
				}
				return acc
			},
			[] as Array<{ tour: TourWithDetails; serviceId: string | null; date: string }>
		)

	const formatCurrency = (amount: number) =>
		new Intl.NumberFormat("es-CL", {
			style: "currency",
			currency: "CLP",
			minimumFractionDigits: 0,
		}).format(amount)

	const hasPassengerData = reception.passengers.some(
		(p) => p.name || p.document || p.phone || p.email || p.hotels?.length || p.nationality
	)

	return (
		<Document>
			<Page size="A4" style={styles.page}>
				{/* Header */}
				<View style={styles.header}>
					{/* eslint-disable-next-line jsx-a11y/alt-text */}
					<Image
						src={`${process.env.NEXT_PUBLIC_BASE_URL}/pdf-background.jpg`}
						style={styles.headerBackground}
					/>
					<View style={styles.headerLeft}>
						<Text style={styles.voucherLabel}>{t.voucher}</Text>
						<Text style={styles.voucherNumber}>R-{reception.voucher}</Text>
						<Text style={styles.voucherDate}>
							{format(new Date(reception.createdAt), "dd MMMM yyyy", { locale })}
						</Text>
					</View>

					<View style={styles.headerRight}>
						{/* eslint-disable-next-line jsx-a11y/alt-text */}
						<Image
							src={`${process.env.NEXT_PUBLIC_BASE_URL}/full-logo.png`}
							style={styles.logo}
						/>
					</View>
				</View>

				<View style={styles.content}>
					{/* Agency info */}
					<View style={styles.section}>
						<Text style={styles.sectionTitle}>{t.agency}</Text>
						<Text style={styles.agencyName}>{reception.agency.name}</Text>
					</View>

					{/* Passengers table */}
					{hasPassengerData && (
						<View style={styles.section}>
							<Text style={styles.sectionTitle}>
								{t.passengers} ({reception.passengers.length})
							</Text>
							<View style={styles.table}>
								<View style={styles.tableHeader}>
									<Text style={[styles.tableHeaderCell, { width: "28%" }]}>{t.name}</Text>
									<Text style={[styles.tableHeaderCell, { width: "15%" }]}>{t.document}</Text>
									<Text style={[styles.tableHeaderCell, { width: "15%" }]}>{t.phone}</Text>
									<Text style={[styles.tableHeaderCell, { width: "20%" }]}>{t.hotel}</Text>
									<Text style={[styles.tableHeaderCell, { width: "14%" }]}>
										{t.nationality}
									</Text>
									<Text
										style={[styles.tableHeaderCell, { width: "8%", textAlign: "right" }]}
									>
										{t.age}
									</Text>
								</View>

								{reception.passengers.map((passenger) => (
									<View key={passenger.id} style={styles.tableRow}>
										<Text style={[styles.tableCellBold, { width: "28%" }]}>
											{passenger.name || "—"}
										</Text>
										<Text style={[styles.tableCell, { width: "15%" }]}>
											{passenger.document || "—"}
										</Text>
										<Text style={[styles.tableCell, { width: "15%" }]}>
											{passenger.phone || "—"}
										</Text>
										<Text style={[styles.tableCell, { width: "20%" }]}>
											{passenger.hotels.length > 0
												? formatHotelsSummary(passenger.hotels)
												: passenger.hotel || "—"}
										</Text>
										<Text style={[styles.tableCell, { width: "14%" }]}>
											{passenger.nationality || "—"}
										</Text>
										<Text style={[styles.tableCell, { width: "8%", textAlign: "right" }]}>
											{passenger.age || "—"}
										</Text>
									</View>
								))}
							</View>
						</View>
					)}

					{/* Tours table */}
					<View style={styles.section}>
						<Text style={styles.sectionTitle}>{t.tour}s</Text>
						<View style={styles.table}>
							<View style={styles.tableHeader}>
								<Text style={[styles.tableHeaderCell, { width: "18%" }]}>{t.tourDate}</Text>
								<Text
									style={[
										styles.tableHeaderCell,
										{ width: includePrice ? "37%" : "52%" },
									]}
								>
									{t.tour}
								</Text>
								<Text
									style={[styles.tableHeaderCell, { width: "15%", textAlign: "center" }]}
								>
									{t.start}
								</Text>
								<Text
									style={[styles.tableHeaderCell, { width: "15%", textAlign: "center" }]}
								>
									{t.end}
								</Text>
								{includePrice && (
									<Text
										style={[styles.tableHeaderCell, { width: "15%", textAlign: "right" }]}
									>
										{t.totalAmount}
									</Text>
								)}
							</View>

							{reception.eventBookings.map((booking) => (
								<View key={booking.id} style={styles.tableRow}>
									<Text style={[styles.tableCell, { width: "18%" }]}>
										{formatCalendarDay(booking.event.date, "dd/MM/yyyy")}
									</Text>
									<View style={{ width: includePrice ? "37%" : "52%" }}>
										<Text style={styles.tableCellBold}>{getEventDisplayName(booking.event)}</Text>
										{booking.event.mode === "PRIVATE" && (
											<Text style={styles.tableCellMuted}>{t.private}</Text>
										)}
									</View>
									<Text
										style={[styles.tableCell, { width: "15%", textAlign: "center" }]}
									>
										{booking.event.startTime || "—"}
									</Text>
									<Text
										style={[styles.tableCell, { width: "15%", textAlign: "center" }]}
									>
										{booking.event.endTime || "—"}
									</Text>
									{includePrice && (
										<Text
											style={[
												styles.tableCellBold,
												{ width: "15%", textAlign: "right" },
											]}
										>
											{formatCurrency(totalsByBookingId[booking.id] ?? 0)}
										</Text>
									)}
								</View>
							))}
						</View>
					</View>

					{/* Total */}
					{includePrice && (
						<View style={styles.totalSection}>
							<Text style={styles.totalLabel}>{t.total}</Text>
							<Text style={styles.totalAmount}>{formatCurrency(total)}</Text>
						</View>
					)}
				</View>

				{/* Footer */}
				<View style={styles.footer} wrap={false}>
					<View style={{ flexDirection: "row", justifyContent: "space-between" }}>
						<View style={styles.footerSection}>
							<Text style={styles.footerTitle}>{t.emergencyTitle}</Text>
							<Text style={styles.footerText}>{t.emergencyPhone}</Text>
							<Text style={styles.footerText}>{t.emergencyEmail}</Text>
						</View>
						<View style={[styles.footerSection, { alignItems: "flex-end" }]}>
							<Text style={styles.footerTitle}>{t.conditionsTitle}</Text>
							<Text style={styles.footerText}>{t.conditionTransferIn}</Text>
							<Text style={styles.footerText}>{t.conditionTransferOut}</Text>
						</View>
					</View>
					<Text style={styles.footerLink}>www.turismochiletours.com</Text>
				</View>
			</Page>

			{/* Tour detail pages */}
			{uniqueTours.map(({ tour, date }) => (
				<VoucherTourDetailPage
					key={tour.id}
					tour={tour}
					tourDate={date}
					language={language}
					t={t}
				/>
			))}
		</Document>
	)
}
