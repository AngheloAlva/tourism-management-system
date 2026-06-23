import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import React from "react"

import { formatCalendarDay } from "@/shared/utils/calendar-day"

import type { CommissionSale, CommissionKind } from "../types/commission.types"

interface CommissionPdfProps {
	operator: {
		id: string
		name: string
	}
	period: {
		startDate: Date
		endDate: Date
	}
	sales: CommissionSale[]
	percentage: number
	kind: CommissionKind
	totals: {
		totalSaleAmount: number
		totalEntranceFees: number
		totalTourOnly: number
		commissionAmount: number
	}
	generatedAt: Date
}

// Paleta minimalista - consistente con voucher-pdf y payment-statement-pdf
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
		padding: 40,
		fontFamily: "Helvetica",
		fontSize: 9,
		backgroundColor: colors.white,
		color: colors.darkGray,
	},
	// Header
	header: {
		minHeight: 150,
		marginBottom: 0,
		paddingBottom: 40,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		position: "relative",
	},
	headerBackground: {
		position: "absolute",
		top: -40,
		left: -40,
		right: -40,
		height: 150,
		opacity: 0.4,
		objectFit: "cover",
	},
	headerLeft: {
		flex: 1,
	},
	headerRight: {
		alignItems: "flex-end",
	},
	logo: {
		width: 80,
		height: 74,
		objectFit: "contain",
		opacity: 0.9,
	},
	title: {
		fontSize: 8,
		fontFamily: "Helvetica",
		color: colors.mediumGray,
		letterSpacing: 2,
		textTransform: "uppercase",
		marginBottom: 4,
	},
	titleMain: {
		fontSize: 24,
		fontFamily: "Helvetica-Bold",
		color: colors.black,
		letterSpacing: -0.5,
	},
	generatedDate: {
		fontSize: 8,
		color: colors.mediumGray,
		marginTop: 8,
	},
	// Operator info
	operatorSection: {
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
	operatorName: {
		fontSize: 12,
		fontFamily: "Helvetica-Bold",
		color: colors.black,
		marginBottom: 4,
	},
	operatorDetail: {
		fontSize: 9,
		color: colors.mediumGray,
		marginBottom: 2,
	},
	// Period badge
	periodSection: {
		marginBottom: 24,
		paddingVertical: 12,
		paddingHorizontal: 16,
		backgroundColor: colors.backgroundGray,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	periodText: {
		fontSize: 11,
		fontFamily: "Helvetica-Bold",
		color: colors.black,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	periodCount: {
		fontSize: 9,
		color: colors.mediumGray,
	},
	// Table
	table: {
		marginBottom: 24,
	},
	tableHeader: {
		flexDirection: "row",
		borderBottomWidth: 1,
		borderBottomColor: colors.black,
		paddingBottom: 8,
	},
	tableRow: {
		flexDirection: "row",
		paddingVertical: 8,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderGray,
	},
	subtotalRow: {
		flexDirection: "row",
		paddingVertical: 6,
		paddingHorizontal: 0,
		backgroundColor: colors.backgroundGray,
		marginBottom: 8,
	},
	// Column widths
	colVoucher: { width: "10%" },
	colDate: { width: "9%" },
	colTour: { width: "23%" },
	colPax: { width: "5%", textAlign: "center" as const },
	colBruto: { width: "13%", textAlign: "right" as const },
	colEntradas: { width: "11%", textAlign: "right" as const },
	colTourOnly: { width: "13%", textAlign: "right" as const },
	colComision: { width: "8%", textAlign: "right" as const },
	colEstado: { width: "8%", textAlign: "center" as const },
	// Text styles
	headerText: {
		fontSize: 7,
		fontFamily: "Helvetica-Bold",
		color: colors.darkGray,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	cellText: {
		fontSize: 8,
		color: colors.darkGray,
	},
	cellTextBold: {
		fontSize: 8,
		fontFamily: "Helvetica-Bold",
		color: colors.black,
	},
	subtotalText: {
		fontSize: 7,
		fontFamily: "Helvetica-Bold",
		color: colors.mediumGray,
	},
	// Totals
	totalsSection: {
		marginTop: 20,
		paddingTop: 16,
		borderTopWidth: 2,
		borderTopColor: colors.black,
		flexDirection: "row",
		justifyContent: "flex-end",
		alignItems: "baseline",
	},
	totalsLabel: {
		fontSize: 10,
		fontFamily: "Helvetica",
		color: colors.mediumGray,
		marginRight: 16,
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	totalsValue: {
		fontSize: 24,
		fontFamily: "Helvetica-Bold",
		color: colors.accent,
	},
	// Footer
	footer: {
		position: "absolute",
		bottom: 30,
		left: 40,
		right: 40,
		paddingTop: 12,
		borderTopWidth: 1,
		borderTopColor: colors.borderGray,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	footerText: {
		fontSize: 8,
		color: colors.lightGray,
	},
	footerBrand: {
		fontSize: 8,
		color: colors.accent,
		letterSpacing: 0.5,
	},
})

const formatCurrency = (amount: number) =>
	new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(amount)

export function CommissionPdf({
	operator,
	period,
	sales,
	percentage,
	kind,
	totals,
	generatedAt,
}: CommissionPdfProps) {
	const periodLabel = `${formatCalendarDay(period.startDate, "dd/MM/yyyy")} - ${formatCalendarDay(period.endDate, "dd/MM/yyyy")}`
	const pdfTitle = kind === "SPECIAL" ? "Comisiones Especiales" : "Comisiones"
	// When percentage is 0 (SPECIAL flow), the PDF is printed with blank commission cells
	// so the user can fill them in by hand following the special-tour rules.
	const blankCommission = percentage === 0

	return (
		<Document>
			<Page size="A4" orientation="landscape" style={styles.page}>
				{/* Header */}
				<View style={styles.header}>
					{/* eslint-disable-next-line jsx-a11y/alt-text */}
					<Image
						src={`${process.env.NEXT_PUBLIC_BASE_URL}/pdf-background.jpg`}
						style={styles.headerBackground}
					/>
					<View style={styles.headerLeft}>
						<Text style={styles.title}>Liquidación de comisiones</Text>
						<Text style={styles.titleMain}>{pdfTitle}</Text>
						<Text style={styles.generatedDate}>
							Generado el {format(generatedAt, "dd 'de' MMMM 'de' yyyy", { locale: es })}
						</Text>
					</View>
					<View style={styles.headerRight}>
						{/* eslint-disable-next-line jsx-a11y/alt-text */}
						<Image src={`${process.env.NEXT_PUBLIC_BASE_URL}/full-logo.png`} style={styles.logo} />
					</View>
				</View>

				{/* Operator Info */}
				<View style={styles.operatorSection}>
					<Text style={styles.sectionTitle}>Operadora</Text>
					<Text style={styles.operatorName}>{operator.name}</Text>
					<Text style={styles.operatorDetail}>
						Comisión: {blankCommission ? "_____ %" : `${percentage}%`}
					</Text>
				</View>

				{/* Period */}
				<View style={styles.periodSection}>
					<Text style={styles.periodText}>{periodLabel}</Text>
					<Text style={styles.periodCount}>{sales.length} ventas</Text>
				</View>

				{/* Table */}
				<View style={styles.table}>
					<View style={styles.tableHeader}>
						<Text style={[styles.colVoucher, styles.headerText]}>Voucher</Text>
						<Text style={[styles.colDate, styles.headerText]}>Fecha</Text>
						<Text style={[styles.colTour, styles.headerText]}>Tour</Text>
						<Text style={[styles.colPax, styles.headerText]}>Pax</Text>
						<Text style={[styles.colBruto, styles.headerText]}>Bruto</Text>
						<Text style={[styles.colEntradas, styles.headerText]}>Entradas</Text>
						<Text style={[styles.colTourOnly, styles.headerText]}>Neto Tour</Text>
						<Text style={[styles.colComision, styles.headerText]}>
							{blankCommission ? "Comisión" : `${percentage}%`}
						</Text>
						<Text style={[styles.colEstado, styles.headerText]}>Estado</Text>
					</View>

					{sales.map((sale) => (
						<React.Fragment key={sale.id}>
							{sale.bookings.map((booking, bookingIndex) => (
								<View key={`${sale.id}-${booking.id}`} style={styles.tableRow}>
									<Text style={[styles.colVoucher, styles.cellTextBold]}>
										{bookingIndex === 0 ? `V-${sale.voucher}` : ""}
									</Text>
									<Text style={[styles.colDate, styles.cellText]}>
										{formatCalendarDay(booking.date, "dd/MM/yy")}
									</Text>
									<Text style={[styles.colTour, styles.cellText]}>
										{booking.tourName}
									</Text>
									<Text style={[styles.colPax, styles.cellText]}>
										{booking.entries.reduce((sum, e) => sum + e.count, 0)}
									</Text>
									<Text style={[styles.colBruto, styles.cellText]}>
										{formatCurrency(booking.saleAmount)}
									</Text>
									<Text style={[styles.colEntradas, styles.cellText]}>
										{booking.entranceFees > 0
											? `-${formatCurrency(booking.entranceFees)}`
											: "—"}
									</Text>
									<Text style={[styles.colTourOnly, styles.cellText]}>
										{formatCurrency(booking.tourOnlyAmount)}
									</Text>
									<Text style={[styles.colComision, styles.cellText]}>
										{blankCommission
											? ""
											: formatCurrency(
													Math.round(booking.tourOnlyAmount * (percentage / 100))
												)}
									</Text>
									<Text style={[styles.colEstado, styles.cellText]}>
										{booking.commissionPaid ? "Pagada" : "Pendiente"}
									</Text>
								</View>
							))}
							{/* Subtotal row */}
							<View style={styles.subtotalRow}>
								<Text style={[styles.colVoucher, styles.subtotalText]}></Text>
								<Text style={[styles.colDate, styles.subtotalText]}></Text>
								<Text style={[styles.colTour, styles.subtotalText, { textAlign: "right" }]}>
									Subtotal V-{sale.voucher}
								</Text>
								<Text style={[styles.colPax, styles.subtotalText]}></Text>
								<Text style={[styles.colBruto, styles.subtotalText]}>
									{formatCurrency(sale.totalSaleAmount)}
								</Text>
								<Text style={[styles.colEntradas, styles.subtotalText]}>
									{sale.totalEntranceFees > 0
										? `-${formatCurrency(sale.totalEntranceFees)}`
										: "—"}
								</Text>
								<Text style={[styles.colTourOnly, styles.subtotalText]}>
									{formatCurrency(sale.totalTourOnly)}
								</Text>
								<Text style={[styles.colComision, styles.subtotalText]}>
									{blankCommission
										? ""
										: formatCurrency(
												Math.round(sale.totalTourOnly * (percentage / 100))
											)}
								</Text>
								<Text style={[styles.colEstado, styles.subtotalText]}></Text>
							</View>
						</React.Fragment>
					))}
				</View>

				{/* Total */}
				<View style={styles.totalsSection}>
					<Text style={styles.totalsLabel}>
						{blankCommission ? "Comisión total" : `Comisión total (${percentage}%)`}
					</Text>
					<Text style={styles.totalsValue}>
						{blankCommission ? "_____________" : formatCurrency(totals.commissionAmount)}
					</Text>
				</View>

				{/* Footer */}
				<View style={styles.footer}>
					<Text style={styles.footerText}>{format(generatedAt, "dd/MM/yyyy HH:mm")}</Text>
					<Text style={styles.footerBrand}>turismochiletours.com</Text>
				</View>
			</Page>
		</Document>
	)
}
