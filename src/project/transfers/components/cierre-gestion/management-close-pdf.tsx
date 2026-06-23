import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer"
import { format } from "date-fns"
import { es } from "date-fns/locale"

import type { CGData, CGRow } from "./types"

interface ManagementClosePdfProps {
	agencyName: string
	period?: {
		from?: Date
		to?: Date
	}
	data: CGData
	receivables: number
	payables: number
	balance: number
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
	red: "#ef4444",
	green: "#10b981",
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
	// Table styles
	tableSection: {
		marginBottom: 20,
	},
	tableTitleRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 8,
	},
	tableTitle: {
		fontSize: 10,
		fontFamily: "Helvetica-Bold",
		color: colors.darkGray,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	tableTitleAccent: {
		fontSize: 10,
		fontFamily: "Helvetica-Bold",
		letterSpacing: 0.5,
	},
	tableHeader: {
		flexDirection: "row",
		borderBottomWidth: 1,
		borderBottomColor: colors.black,
		paddingBottom: 6,
	},
	tableRow: {
		flexDirection: "row",
		paddingVertical: 6,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderGray,
	},
	tableFooterRow: {
		flexDirection: "row",
		paddingVertical: 8,
		backgroundColor: colors.backgroundGray,
		marginTop: 2,
	},
	// Column widths
	colFecha: { width: "14%" },
	colVoucher: { width: "12%" },
	colPax: { width: "8%", textAlign: "center" as const },
	colTour: { width: "26%" },
	colEntrada: { width: "13%", textAlign: "right" as const },
	colValor: { width: "13%", textAlign: "right" as const },
	colTotal: { width: "14%", textAlign: "right" as const },
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
	footerText: {
		fontSize: 8,
		fontFamily: "Helvetica-Bold",
		color: colors.mediumGray,
	},
	// Balance section
	balanceSection: {
		marginTop: 24,
		paddingTop: 16,
		borderTopWidth: 2,
		borderTopColor: colors.black,
	},
	balanceGrid: {
		flexDirection: "row",
		gap: 16,
	},
	balanceCard: {
		flex: 1,
		padding: 12,
		backgroundColor: colors.backgroundGray,
	},
	balanceCardLabel: {
		fontSize: 8,
		fontFamily: "Helvetica-Bold",
		color: colors.mediumGray,
		textTransform: "uppercase",
		letterSpacing: 0.5,
		marginBottom: 4,
	},
	balanceCardValue: {
		fontSize: 16,
		fontFamily: "Helvetica-Bold",
	},
	balanceCardDesc: {
		fontSize: 7,
		color: colors.lightGray,
		marginTop: 2,
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
	footerPageText: {
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
	new Intl.NumberFormat("es-CL", {
		style: "currency",
		currency: "CLP",
		minimumFractionDigits: 0,
	}).format(Math.round(amount))

function OperationsTable({
	title,
	titleColor,
	rows,
}: {
	title: string
	titleColor: string
	rows: CGRow[]
}) {
	const total = rows.reduce((sum, row) => sum + row.total, 0)
	const totalEntrada = rows.reduce((sum, row) => sum + row.entrada, 0)
	const totalValor = rows.reduce((sum, row) => sum + row.valor, 0)

	return (
		<View style={styles.tableSection}>
			<View style={styles.tableTitleRow}>
				<Text style={[styles.tableTitleAccent, { color: titleColor }]}>{title}</Text>
			</View>

			{rows.length === 0 ? (
				<Text style={{ fontSize: 8, color: colors.lightGray, paddingVertical: 8 }}>
					Sin registros pendientes
				</Text>
			) : (
				<>
					<View style={styles.tableHeader}>
						<Text style={[styles.colFecha, styles.headerText]}>Fecha</Text>
						<Text style={[styles.colVoucher, styles.headerText]}>Voucher</Text>
						<Text style={[styles.colPax, styles.headerText]}>Pax</Text>
						<Text style={[styles.colTour, styles.headerText]}>Tour</Text>
						<Text style={[styles.colEntrada, styles.headerText]}>Entrada</Text>
						<Text style={[styles.colValor, styles.headerText]}>Valor</Text>
						<Text style={[styles.colTotal, styles.headerText]}>Total</Text>
					</View>

					{rows.map((row, index) => (
						<View key={`${row.voucher}-${index}`} style={styles.tableRow}>
							<Text style={[styles.colFecha, styles.cellText]}>
								{new Date(row.fecha).toLocaleDateString("es-CL")}
							</Text>
							<Text style={[styles.colVoucher, styles.cellTextBold]}>{row.voucher}</Text>
							<Text style={[styles.colPax, styles.cellText]}>{row.pax}</Text>
							<Text style={[styles.colTour, styles.cellText]}>{row.tour}</Text>
							<Text style={[styles.colEntrada, styles.cellText]}>
								{formatCurrency(row.entrada)}
							</Text>
							<Text style={[styles.colValor, styles.cellText]}>{formatCurrency(row.valor)}</Text>
							<Text style={[styles.colTotal, styles.cellTextBold]}>
								{formatCurrency(row.total)}
							</Text>
						</View>
					))}

					<View style={styles.tableFooterRow}>
						<Text style={[styles.colFecha, styles.footerText]}></Text>
						<Text style={[styles.colVoucher, styles.footerText]}></Text>
						<Text style={[styles.colPax, styles.footerText]}>{rows.length}</Text>
						<Text style={[styles.colTour, styles.footerText, { textAlign: "right" }]}>Total</Text>
						<Text style={[styles.colEntrada, styles.footerText]}>
							{formatCurrency(totalEntrada)}
						</Text>
						<Text style={[styles.colValor, styles.footerText]}>{formatCurrency(totalValor)}</Text>
						<Text style={[styles.colTotal, styles.footerText]}>{formatCurrency(total)}</Text>
					</View>
				</>
			)}
		</View>
	)
}

export function ManagementClosePdf({
	agencyName,
	period,
	data,
	receivables,
	payables,
	balance,
	generatedAt,
}: ManagementClosePdfProps) {
	const pendingRecepciones = data.recepciones.filter((r) => r.estado !== "FULLY_PAID")
	const pendingTraspasos = data.traspasos.filter((r) => r.estado !== "FULLY_PAID")

	const periodLabel =
		period?.from && period?.to
			? `${format(period.from, "dd/MM/yyyy", { locale: es })} - ${format(period.to, "dd/MM/yyyy", { locale: es })}`
			: "Todos los períodos"

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
						<Text style={styles.title}>Balance de agencia</Text>
						<Text style={styles.titleMain}>Cierre de Gestión</Text>
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
					<Text style={styles.sectionTitle}>Agencia</Text>
					<Text style={styles.agencyName}>{agencyName}</Text>
				</View>

				{/* Period */}
				<View style={styles.periodSection}>
					<Text style={styles.periodText}>{periodLabel}</Text>
				</View>

				{/* Recepciones - Por Pagar */}
				<OperationsTable
					title="RECIBIDOS (Por Pagar)"
					titleColor={colors.red}
					rows={pendingRecepciones}
				/>

				{/* Traspasos - Por Cobrar */}
				<OperationsTable
					title="TRASPASADOS (Por Cobrar)"
					titleColor={colors.green}
					rows={pendingTraspasos}
				/>

				{/* Balance */}
				<View style={styles.balanceSection}>
					<View style={styles.balanceGrid}>
						<View style={styles.balanceCard}>
							<Text style={styles.balanceCardLabel}>Por Pagar</Text>
							<Text style={[styles.balanceCardValue, { color: colors.red }]}>
								{formatCurrency(payables)}
							</Text>
							<Text style={styles.balanceCardDesc}>Pendiente de transferir a la agencia</Text>
						</View>
						<View style={styles.balanceCard}>
							<Text style={styles.balanceCardLabel}>Por Cobrar</Text>
							<Text style={[styles.balanceCardValue, { color: colors.green }]}>
								{formatCurrency(receivables)}
							</Text>
							<Text style={styles.balanceCardDesc}>Pendiente de recibir de la agencia</Text>
						</View>
						<View style={styles.balanceCard}>
							<Text style={styles.balanceCardLabel}>Balance</Text>
							<Text
								style={[
									styles.balanceCardValue,
									{
										color: balance > 0 ? colors.green : balance < 0 ? colors.red : colors.darkGray,
									},
								]}
							>
								{formatCurrency(balance)}
							</Text>
							<Text style={styles.balanceCardDesc}>
								{balance > 0
									? "La agencia te debe dinero"
									: balance < 0
										? "Debes dinero a la agencia"
										: "Cuentas saldadas"}
							</Text>
						</View>
					</View>
				</View>

				{/* Footer */}
				<View style={styles.footer}>
					<Text style={styles.footerPageText}>{format(generatedAt, "dd/MM/yyyy HH:mm")}</Text>
					<Text style={styles.footerBrand}>turismochiletours.com</Text>
				</View>
			</Page>
		</Document>
	)
}
