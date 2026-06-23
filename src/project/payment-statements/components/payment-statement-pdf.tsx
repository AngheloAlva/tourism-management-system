import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import React from "react"

import { formatCalendarDay } from "@/shared/utils/calendar-day"

import type { PaymentStatementSale } from "../types/payment-statement.types"

interface PaymentStatementPdfAgency {
	id: string
	name: string
	taxId: string | null
	address: string | null
	phone: string | null
}

interface PaymentStatementPdfProps {
	agencies: PaymentStatementPdfAgency[]
	period: {
		startDate: Date
		endDate: Date
	}
	sales: PaymentStatementSale[]
	totals: {
		totalAmount: number
		paidAmount: number
		pendingAmount: number
	}
	generatedAt: Date
}

const colors = {
	black: "#0a0a0a",
	darkGray: "#374151",
	mediumGray: "#6b7280",
	lightGray: "#9ca3af",
	borderGray: "#e5e7eb",
	backgroundGray: "#f9fafb",
	white: "#ffffff",
	accent: "#ff6900",
}

const styles = StyleSheet.create({
	page: {
		padding: 40,
		fontFamily: "Helvetica",
		fontSize: 9,
		backgroundColor: colors.white,
		color: colors.darkGray,
	},
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
	agencySection: {
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
	agencyName: {
		fontSize: 12,
		fontFamily: "Helvetica-Bold",
		color: colors.black,
		marginBottom: 4,
	},
	agencyDetail: {
		fontSize: 9,
		color: colors.mediumGray,
		marginBottom: 2,
	},
	agencyListItem: {
		fontSize: 9,
		color: colors.darkGray,
		marginBottom: 2,
	},
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
	agencyGroup: {
		marginBottom: 20,
	},
	agencyGroupHeader: {
		paddingVertical: 6,
		paddingHorizontal: 8,
		backgroundColor: colors.black,
		marginBottom: 0,
	},
	agencyGroupHeaderText: {
		fontSize: 10,
		fontFamily: "Helvetica-Bold",
		color: colors.white,
		letterSpacing: 0.5,
		textTransform: "uppercase",
	},
	tableHeader: {
		flexDirection: "row",
		borderBottomWidth: 1,
		borderBottomColor: colors.black,
		paddingVertical: 6,
	},
	tableRow: {
		flexDirection: "row",
		paddingVertical: 6,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderGray,
	},
	subtotalRow: {
		flexDirection: "row",
		paddingVertical: 6,
		paddingHorizontal: 0,
		backgroundColor: colors.backgroundGray,
		marginTop: 4,
		marginBottom: 4,
	},
	groupSubtotalRow: {
		flexDirection: "row",
		paddingVertical: 8,
		paddingHorizontal: 8,
		borderTopWidth: 1,
		borderTopColor: colors.black,
		marginTop: 4,
	},
	// Column widths
	colFile: { width: "13%", paddingRight: 8 },
	colVoucher: { width: "9%", paddingRight: 6 },
	colPassenger: { width: "16%", paddingRight: 6 },
	colDate: { width: "10%", paddingRight: 6 },
	colTour: { width: "26%", paddingRight: 6 },
	colPax: { width: "6%", textAlign: "center" as const, paddingRight: 6 },
	colAmount: { width: "20%", textAlign: "right" as const },
	headerText: {
		fontSize: 8,
		fontFamily: "Helvetica-Bold",
		color: colors.darkGray,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	cellText: {
		fontSize: 9,
		color: colors.darkGray,
	},
	cellTextBold: {
		fontSize: 9,
		fontFamily: "Helvetica-Bold",
		color: colors.black,
	},
	subtotalText: {
		fontSize: 8,
		fontFamily: "Helvetica-Bold",
		color: colors.mediumGray,
	},
	groupSubtotalText: {
		fontSize: 9,
		fontFamily: "Helvetica-Bold",
		color: colors.black,
	},
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

function getVoucherTotal(sale: PaymentStatementSale) {
	return sale.events.reduce((sum, event) => sum + event.amount, 0)
}

function groupSalesByAgency(
	sales: PaymentStatementSale[],
	agencies: PaymentStatementPdfAgency[]
) {
	const byAgency = new Map<string, PaymentStatementSale[]>()
	for (const sale of sales) {
		const key = sale.agencyId ?? "__unknown__"
		const list = byAgency.get(key) ?? []
		list.push(sale)
		byAgency.set(key, list)
	}
	return agencies
		.map((agency) => ({
			agency,
			sales: byAgency.get(agency.id) ?? [],
		}))
		.filter((g) => g.sales.length > 0)
}

export function PaymentStatementPdf({
	agencies,
	period,
	sales,
	totals,
	generatedAt,
}: PaymentStatementPdfProps) {
	const periodLabel = `${formatCalendarDay(period.startDate, "dd/MM/yyyy")} - ${formatCalendarDay(period.endDate, "dd/MM/yyyy")}`
	const isSingleAgency = agencies.length === 1
	const grouped = groupSalesByAgency(sales, agencies)

	return (
		<Document>
			<Page size="A4" style={styles.page}>
				<View style={styles.header}>
					{/* eslint-disable-next-line jsx-a11y/alt-text */}
					<Image
						src={`${process.env.NEXT_PUBLIC_BASE_URL}/pdf-background.jpg`}
						style={styles.headerBackground}
					/>
					<View style={styles.headerLeft}>
						<Text style={styles.title}>Estado de cuenta</Text>
						<Text style={styles.titleMain}>Facturación</Text>
						<Text style={styles.generatedDate}>
							Generado el {format(generatedAt, "dd 'de' MMMM 'de' yyyy", { locale: es })}
						</Text>
					</View>
					<View style={styles.headerRight}>
						{/* eslint-disable-next-line jsx-a11y/alt-text */}
						<Image src={`${process.env.NEXT_PUBLIC_BASE_URL}/full-logo.png`} style={styles.logo} />
					</View>
				</View>

				{/* Agency Info */}
				<View style={styles.agencySection}>
					{isSingleAgency ? (
						<>
							<Text style={styles.sectionTitle}>Agencia</Text>
							<Text style={styles.agencyName}>{agencies[0].name}</Text>
							{agencies[0].taxId && (
								<Text style={styles.agencyDetail}>RUT: {agencies[0].taxId}</Text>
							)}
							{agencies[0].address && (
								<Text style={styles.agencyDetail}>{agencies[0].address}</Text>
							)}
							{agencies[0].phone && (
								<Text style={styles.agencyDetail}>Tel: {agencies[0].phone}</Text>
							)}
						</>
					) : (
						<>
							<Text style={styles.sectionTitle}>Agencias ({agencies.length})</Text>
							{agencies.map((agency) => (
								<Text key={agency.id} style={styles.agencyListItem}>
									• {agency.name}
									{agency.taxId ? `  —  RUT: ${agency.taxId}` : ""}
								</Text>
							))}
						</>
					)}
				</View>

				{/* Period */}
				<View style={styles.periodSection}>
					<Text style={styles.periodText}>{periodLabel}</Text>
					<Text style={styles.periodCount}>{sales.length} ventas</Text>
				</View>

				{/* Groups */}
				{grouped.map((group) => {
					const groupTotal = group.sales.reduce((sum, s) => sum + getVoucherTotal(s), 0)
					return (
						<View key={group.agency.id} style={styles.agencyGroup}>
							{!isSingleAgency && (
								<View style={styles.agencyGroupHeader} wrap={false}>
									<Text style={styles.agencyGroupHeaderText}>{group.agency.name}</Text>
								</View>
							)}

							<View style={styles.tableHeader} wrap={false}>
								<Text style={[styles.colFile, styles.headerText]}>File</Text>
								<Text style={[styles.colVoucher, styles.headerText]}>Voucher</Text>
								<Text style={[styles.colPassenger, styles.headerText]}>Pasajero</Text>
								<Text style={[styles.colDate, styles.headerText]}>Fecha</Text>
								<Text style={[styles.colTour, styles.headerText]}>Tour</Text>
								<Text style={[styles.colPax, styles.headerText]}>Pax</Text>
								<Text style={[styles.colAmount, styles.headerText]}>Monto</Text>
							</View>

							{group.sales.map((sale) => (
								<View key={sale.id} wrap={false}>
									{sale.events.map((event, eventIndex) => (
										<View key={`${sale.id}-${event.id}`} style={styles.tableRow}>
											<Text style={[styles.colFile, styles.cellTextBold]}>
												{eventIndex === 0 ? sale.fileNumber || "—" : ""}
											</Text>
											<Text style={[styles.colVoucher, styles.cellText]}>
												{eventIndex === 0 ? `V-${sale.voucher}` : ""}
											</Text>
											<Text style={[styles.colPassenger, styles.cellText]}>
												{eventIndex === 0 ? sale.firstPassengerName || "—" : ""}
											</Text>
											<Text style={[styles.colDate, styles.cellText]}>
												{formatCalendarDay(event.date, "dd/MM/yy")}
											</Text>
											<Text style={[styles.colTour, styles.cellText]}>{event.tourName}</Text>
											<Text style={[styles.colPax, styles.cellText]}>{event.participantCount}</Text>
											<Text style={[styles.colAmount, styles.cellText]}>
												{formatCurrency(event.amount)}
											</Text>
										</View>
									))}
									<View style={styles.subtotalRow}>
										<Text style={[styles.colFile, styles.subtotalText]}></Text>
										<Text style={[styles.colVoucher, styles.subtotalText]}></Text>
										<Text style={[styles.colPassenger, styles.subtotalText]}></Text>
										<Text style={[styles.colDate, styles.subtotalText]}></Text>
										<Text style={[styles.colTour, styles.subtotalText, { textAlign: "right" }]}>
											Subtotal V-{sale.voucher}
										</Text>
										<Text style={[styles.colPax, styles.subtotalText]}></Text>
										<Text style={[styles.colAmount, styles.subtotalText]}>
											{formatCurrency(getVoucherTotal(sale))}
										</Text>
									</View>
								</View>
							))}

							{!isSingleAgency && (
								<View style={styles.groupSubtotalRow} wrap={false}>
									<Text style={[{ flex: 1 }, styles.groupSubtotalText]}>
										Subtotal {group.agency.name}
									</Text>
									<Text style={[styles.colAmount, styles.groupSubtotalText]}>
										{formatCurrency(groupTotal)}
									</Text>
								</View>
							)}
						</View>
					)
				})}

				{/* Total */}
				<View style={styles.totalsSection}>
					<Text style={styles.totalsLabel}>Total del período</Text>
					<Text style={styles.totalsValue}>{formatCurrency(totals.totalAmount)}</Text>
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
