import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer"
import { es, enUS, ptBR } from "date-fns/locale"
import { format } from "date-fns"
import React from "react"

import { formatCalendarDay, calendarDayKey } from "@/shared/utils/calendar-day"

import type { SaleRecordWithDetails } from "../actions/sale-record.actions"
import {
	getTranslations,
	type Language,
	type VoucherTranslations,
} from "../utils/voucher-translations"
import { calculateBookingRevenue } from "../utils/booking-revenue"
import { summarizeVoucherPricing } from "../utils/voucher-pricing"
import {
	filterVoucherPassengers,
	type VoucherPassengerFilter,
} from "../utils/voucher-passengers"
import { formatHotelsSummary } from "../utils/resolve-hotel"
import { getEventDisplayName } from "@/project/events/utils/event-display"

type TourWithDetails = NonNullable<SaleRecordWithDetails["eventBookings"][number]["event"]["tour"]>

// Paleta minimalista
const colors = {
	black: "#0a0a0a",
	darkGray: "#374151",
	mediumGray: "#6b7280",
	lightGray: "#9ca3af",
	borderGray: "#e5e7eb",
	backgroundGray: "#f9fafb",
	white: "#ffffff",
	accent: "#ff6900", // Naranja - acento de marca
}

const styles = StyleSheet.create({
	page: {
		padding: 0,
		fontFamily: "Helvetica",
		fontSize: 9,
		backgroundColor: colors.white,
		color: colors.darkGray,
	},
	// Header minimalista
	header: {
		padding: 40,
		minHeight: 150,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		position: "relative",
	},
	headerBackground: {
		position: "absolute",
		minHeight: 150,
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		opacity: 0.3,
		objectFit: "cover",
	},
	headerLeft: {
		flex: 1,
	},
	voucherLabel: {
		fontSize: 10,
		fontFamily: "Helvetica",
		color: colors.mediumGray,
		letterSpacing: 2,
		textTransform: "uppercase",
		marginBottom: 4,
	},
	voucherNumber: {
		fontSize: 28,
		fontFamily: "Helvetica-Bold",
		color: colors.black,
		letterSpacing: 0.5,
	},
	voucherDate: {
		fontSize: 9,
		color: colors.mediumGray,
		marginTop: 8,
	},
	headerRight: {
		alignItems: "flex-end",
	},
	logo: {
		width: 100,
		height: 92,
		objectFit: "contain",
		opacity: 0.9,
	},
	// Contenido
	content: {
		padding: 40,
		paddingTop: 30,
	},
	// Secciones
	section: {
		marginBottom: 24,
	},
	sectionTitle: {
		fontSize: 8,
		fontFamily: "Helvetica-Bold",
		color: colors.mediumGray,
		letterSpacing: 1.5,
		textTransform: "uppercase",
		marginBottom: 10,
	},
	// Info de agencia
	agencyName: {
		fontSize: 11,
		fontFamily: "Helvetica-Bold",
		color: colors.black,
		marginBottom: 2,
	},
	agencyContact: {
		fontSize: 9,
		color: colors.mediumGray,
	},
	// Tablas
	table: {
		marginTop: 8,
	},
	tableHeader: {
		flexDirection: "row",
		borderBottomWidth: 1,
		borderBottomColor: colors.black,
		paddingBottom: 8,
		marginBottom: 0,
	},
	tableHeaderCell: {
		fontSize: 8,
		fontFamily: "Helvetica-Bold",
		color: colors.darkGray,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	tableRow: {
		flexDirection: "row",
		paddingVertical: 10,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderGray,
	},
	tableCell: {
		fontSize: 9,
		color: colors.darkGray,
	},
	tableCellBold: {
		fontSize: 9,
		fontFamily: "Helvetica-Bold",
		color: colors.black,
	},
	tableCellMuted: {
		fontSize: 8,
		color: colors.lightGray,
	},
	// Total section
	totalSection: {
		marginTop: 24,
		paddingTop: 16,
		borderTopWidth: 2,
		borderTopColor: colors.black,
		flexDirection: "row",
		justifyContent: "flex-end",
		alignItems: "baseline",
	},
	totalLabel: {
		fontSize: 10,
		fontFamily: "Helvetica",
		color: colors.mediumGray,
		marginRight: 16,
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	totalAmount: {
		fontSize: 24,
		fontFamily: "Helvetica-Bold",
		color: colors.accent,
	},
	// Footer — fluye al final del contenido (después del total), una sola vez.
	footer: {
		marginTop: 8,
		padding: 30,
		paddingTop: 20,
		borderTopWidth: 1,
		borderTopColor: colors.borderGray,
	},
	footerSection: {
		marginBottom: 12,
	},
	footerTitle: {
		fontSize: 7,
		fontFamily: "Helvetica-Bold",
		color: colors.mediumGray,
		letterSpacing: 1,
		textTransform: "uppercase",
		marginBottom: 4,
	},
	footerText: {
		fontSize: 8,
		color: colors.lightGray,
		lineHeight: 1.4,
	},
	footerLink: {
		fontSize: 8,
		color: colors.accent,
		marginTop: 12,
		textAlign: "center",
		letterSpacing: 0.5,
	},
	// Tour detail pages
	tourDetailPage: {
		padding: 40,
	},
	tourDetailHeader: {
		marginBottom: 30,
		paddingBottom: 20,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderGray,
	},
	tourDetailTitle: {
		fontSize: 20,
		fontFamily: "Helvetica-Bold",
		color: colors.black,
		marginBottom: 4,
	},
	tourDetailSubtitle: {
		fontSize: 10,
		color: colors.mediumGray,
	},
	detailSection: {
		marginBottom: 20,
	},
	detailSectionTitle: {
		fontSize: 8,
		fontFamily: "Helvetica-Bold",
		color: colors.mediumGray,
		letterSpacing: 1.5,
		textTransform: "uppercase",
		marginBottom: 8,
	},
	detailText: {
		fontSize: 9,
		color: colors.darkGray,
		lineHeight: 1.7,
	},
	bulletPoint: {
		flexDirection: "row",
		marginBottom: 6,
		paddingLeft: 0,
	},
	bullet: {
		fontSize: 9,
		color: colors.accent,
		marginRight: 10,
		width: 12,
	},
	bulletText: {
		fontSize: 9,
		color: colors.darkGray,
		flex: 1,
		lineHeight: 1.5,
	},
	infoBox: {
		backgroundColor: colors.backgroundGray,
		padding: 14,
		marginTop: 6,
	},
	infoBoxText: {
		fontSize: 9,
		color: colors.darkGray,
		lineHeight: 1.5,
	},
})

interface VoucherPDFProps {
	sale: SaleRecordWithDetails
	language?: Language
	includePrice?: boolean
	passengerFilter?: VoucherPassengerFilter
}

const localeMap = {
	es: es,
	en: enUS,
	pt: ptBR,
}


const renderBulletList = (text: string) => {
	const lines = text.split("\n").filter((line) => line.trim())
	return lines.map((line, index) => (
		<View key={index} style={styles.bulletPoint}>
			<Text style={styles.bullet}>—</Text>
			<Text style={styles.bulletText}>{line.trim()}</Text>
		</View>
	))
}

interface TourDetailPageProps {
	tour: TourWithDetails
	tourDate: string
	language: Language
	t: VoucherTranslations
}

const TourDetailPage: React.FC<TourDetailPageProps> = ({ tour, tourDate, language, t }) => {
	const getLocalizedField = (fieldName: string) => {
		const fieldMap: Record<Language, string> = {
			es: `${fieldName}Es`,
			en: `${fieldName}En`,
			pt: `${fieldName}Pt`,
		}
		const tourRecord = tour as Record<string, unknown>
		return (
			(tourRecord[fieldMap[language]] as string | null) ||
			(tourRecord[fieldMap.es] as string | null) ||
			null
		)
	}

	const summary = getLocalizedField("generalSummary")
	const schedule = getLocalizedField("schedule")
	const includes = getLocalizedField("includes")
	const pickup = getLocalizedField("pickup")
	const whatToBring = getLocalizedField("whatToBring")
	const altitude = getLocalizedField("altitude")

	if (!summary && !schedule && !includes && !pickup && !whatToBring && !altitude) {
		return null
	}

	return (
		<Page size="A4" style={styles.page}>
			<View style={styles.tourDetailPage}>
				<View style={styles.tourDetailHeader}>
					<Text style={styles.tourDetailTitle}>{tour.name}</Text>
					<Text style={styles.tourDetailSubtitle}>{tourDate}</Text>
				</View>

				{summary && (
					<View style={styles.detailSection}>
						<Text style={styles.detailSectionTitle}>{t.summary}</Text>
						<Text style={styles.detailText}>{summary}</Text>
					</View>
				)}

				{schedule && (
					<View style={styles.detailSection}>
						<Text style={styles.detailSectionTitle}>{t.schedule}</Text>
						{renderBulletList(schedule)}
					</View>
				)}

				{includes && (
					<View style={styles.detailSection}>
						<Text style={styles.detailSectionTitle}>{t.includes}</Text>
						{renderBulletList(includes)}
					</View>
				)}

				{pickup && (
					<View style={styles.detailSection}>
						<Text style={styles.detailSectionTitle}>{t.pickup}</Text>
						<Text style={styles.detailText}>{pickup}</Text>
					</View>
				)}

				{whatToBring && (
					<View style={styles.detailSection}>
						<Text style={styles.detailSectionTitle}>{t.whatToBring}</Text>
						{renderBulletList(whatToBring)}
					</View>
				)}

				{altitude && (
					<View style={styles.detailSection}>
						<Text style={styles.detailSectionTitle}>{t.altitude}</Text>
						<View style={styles.infoBox}>
							<Text style={styles.infoBoxText}>{altitude}</Text>
						</View>
					</View>
				)}
			</View>
		</Page>
	)
}

export const VoucherPDF: React.FC<VoucherPDFProps> = ({
	sale,
	language = "es",
	includePrice = true,
	passengerFilter = "all",
}) => {
	const t = getTranslations(language)
	const locale = localeMap[language]
	const isQuote = sale.type === "QUOTE"

	// Passengers shown on the voucher. Only the displayed table changes — pricing,
	// tours and entrances are computed from eventBookings and stay untouched.
	const displayedPassengers = filterVoucherPassengers(sale.passengers, passengerFilter)

	const getBookingTotal = (booking: SaleRecordWithDetails["eventBookings"][number]) => {
		return calculateBookingRevenue(booking.priceEntries || [], booking.entrySnapshots || []).totalPrice
	}

	const pricing = summarizeVoucherPricing(sale.eventBookings)

	// Eventos ordenados por fecha (día calendario) y hora de inicio como desempate.
	const sortedBookings = [...sale.eventBookings].sort((a, b) => {
		const dateCompare = calendarDayKey(a.event.date).localeCompare(calendarDayKey(b.event.date))
		if (dateCompare !== 0) return dateCompare
		return (a.event.startTime || "").localeCompare(b.event.startTime || "")
	})

	const uniqueTours = sortedBookings
		.filter((booking) => booking.event.tour)
		.reduce(
			(acc, booking) => {
				const tourId = booking.event.tour!.id
				if (!acc.some((item) => item.tour.id === tourId)) {
					acc.push({
						tour: booking.event.tour!,
						date: formatCalendarDay(booking.event.date, "dd/MM/yyyy"),
					})
				}
				return acc
			},
			[] as Array<{ tour: TourWithDetails; date: string }>
		)

	const formatCurrency = (amount: number) =>
		new Intl.NumberFormat("es-CL", {
			style: "currency",
			currency: "CLP",
			minimumFractionDigits: 0,
		}).format(amount)

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
						<Text style={styles.voucherNumber}>V-{sale.voucher}</Text>
						<Text style={styles.voucherDate}>
							{format(new Date(sale.createdAt), "dd MMMM yyyy", { locale })}
						</Text>
					</View>

					<View style={styles.headerRight}>
						{/* eslint-disable-next-line jsx-a11y/alt-text */}
						<Image src={`${process.env.NEXT_PUBLIC_BASE_URL}/full-logo.png`} style={styles.logo} />
					</View>
				</View>

				<View style={styles.content}>
					{/* Agency info */}
					{sale.channel === "AGENCY" && sale.agency && (
						<View style={styles.section}>
							<Text style={styles.sectionTitle}>{t.agency}</Text>
							<Text style={styles.agencyName}>{sale.agency.name}</Text>
							<Text style={styles.agencyContact}>{sale.agency.contactEmails}</Text>
						</View>
					)}

					{/* Passengers table */}
					{displayedPassengers.some(
						(p) => p.name || p.document || p.phone || p.email || p.hotels?.length || p.nationality
					) && (
						<View style={styles.section}>
							<Text style={styles.sectionTitle}>
								{t.passengers} ({sale.passengers.length})
							</Text>
							<View style={styles.table}>
								<View style={styles.tableHeader}>
									<Text style={[styles.tableHeaderCell, { width: "28%" }]}>{t.name}</Text>
									<Text style={[styles.tableHeaderCell, { width: "15%" }]}>{t.document}</Text>
									<Text style={[styles.tableHeaderCell, { width: "15%" }]}>{t.phone}</Text>
									<Text style={[styles.tableHeaderCell, { width: "20%" }]}>{t.hotel}</Text>
									<Text style={[styles.tableHeaderCell, { width: "14%" }]}>{t.nationality}</Text>
									<Text style={[styles.tableHeaderCell, { width: "8%", textAlign: "right" }]}>
										{t.age}
									</Text>
								</View>

								{displayedPassengers.map((passenger) => (
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
											{formatHotelsSummary(passenger.hotels)}
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
										{ width: isQuote || !includePrice ? "52%" : "37%" },
									]}
								>
									{t.tour}
								</Text>
								<Text style={[styles.tableHeaderCell, { width: "15%", textAlign: "center" }]}>
									{t.start}
								</Text>
								<Text style={[styles.tableHeaderCell, { width: "15%", textAlign: "center" }]}>
									{t.end}
								</Text>
								{!isQuote && includePrice && (
									<Text style={[styles.tableHeaderCell, { width: "15%", textAlign: "right" }]}>
										{t.totalAmount}
									</Text>
								)}
							</View>

							{sortedBookings.map((booking) => (
								<View key={booking.id} style={styles.tableRow}>
									<Text style={[styles.tableCell, { width: "18%" }]}>
										{formatCalendarDay(booking.event.date, "dd/MM/yyyy")}
									</Text>
									<View style={{ width: isQuote || !includePrice ? "52%" : "37%" }}>
										<Text style={styles.tableCellBold}>{getEventDisplayName(booking.event)}</Text>
										{booking.event.mode === "PRIVATE" && (
											<Text style={styles.tableCellMuted}>{t.private}</Text>
										)}
										{booking.event.serviceKind === "TRANSFER" && booking.flyName && (
											<Text style={styles.tableCellMuted}>
												{t.flight}: {booking.flyName}
											</Text>
										)}
									</View>
									<Text style={[styles.tableCell, { width: "15%", textAlign: "center" }]}>
										{booking.event.startTime || booking.flyTime || "—"}
									</Text>
									<Text style={[styles.tableCell, { width: "15%", textAlign: "center" }]}>
										{booking.event.endTime || "—"}
									</Text>
									{!isQuote && includePrice && (
										<Text style={[styles.tableCellBold, { width: "15%", textAlign: "right" }]}>
											{formatCurrency(getBookingTotal(booking))}
										</Text>
									)}
								</View>
							))}
						</View>
					</View>

					{/* Entrances table */}
					{!isQuote && includePrice && pricing.entrances.length > 0 && (
						<View style={styles.section}>
							<Text style={styles.sectionTitle}>{t.entrances}</Text>
							<View style={styles.table}>
								{pricing.entrances.map((entrance) => (
									<View key={entrance.id} style={styles.tableRow}>
										<Text style={[styles.tableCellBold, { width: "55%" }]}>
											{entrance.entryName}
											{entrance.variantName ? ` (${entrance.variantName})` : ""}
										</Text>
										<Text style={[styles.tableCell, { width: "30%", textAlign: "center" }]}>
											{entrance.count} × {formatCurrency(entrance.unitPrice)}
										</Text>
										<Text style={[styles.tableCellBold, { width: "15%", textAlign: "right" }]}>
											{formatCurrency(entrance.lineTotal)}
										</Text>
									</View>
								))}
							</View>
						</View>
					)}

					{/* Total */}
					{!isQuote && includePrice && (
						<View style={styles.totalSection}>
							<Text style={styles.totalLabel}>{t.total}</Text>
							<Text style={styles.totalAmount}>{formatCurrency(pricing.grandTotal)}</Text>
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
				<TourDetailPage key={tour.id} tour={tour} tourDate={date} language={language} t={t} />
			))}
		</Document>
	)
}

export const voucherStyles = styles
export const voucherLocaleMap = localeMap
export { TourDetailPage as VoucherTourDetailPage }
