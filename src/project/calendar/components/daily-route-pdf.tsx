import { Document, Page, View, Text, StyleSheet, Image } from "@react-pdf/renderer"
import { format } from "date-fns"
import { es } from "date-fns/locale"

import type { DailyRoutePdfProps, PdfEventData } from "../types/calendar.types"
import { COMPANY_INFO } from "@/lib/company-info"

// Paleta minimalista — consistente con voucher-pdf
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
		padding: 0,
		fontSize: 9,
		fontFamily: "Helvetica",
		backgroundColor: colors.white,
		color: colors.darkGray,
	},
	// Branding header (logo + company info)
	brandingHeader: {
		padding: 30,
		paddingBottom: 20,
		flexDirection: "row",
		alignItems: "center",
		borderBottomWidth: 1,
		borderBottomColor: colors.borderGray,
	},
	brandingLogo: {
		width: 80,
		objectFit: "contain",
		marginRight: 16,
	},
	brandingInfo: {
		flex: 1,
	},
	brandingName: {
		fontSize: 12,
		fontFamily: "Helvetica-Bold",
		color: colors.black,
		marginBottom: 2,
	},
	brandingDetail: {
		fontSize: 8,
		color: colors.mediumGray,
		marginBottom: 1,
	},
	// Header minimalista
	header: {
		padding: 40,
		paddingTop: 20,
		paddingBottom: 20,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderGray,
	},
	headerLabel: {
		fontSize: 10,
		fontFamily: "Helvetica",
		color: colors.mediumGray,
		letterSpacing: 2,
		textTransform: "uppercase",
		marginBottom: 4,
	},
	title: {
		fontSize: 24,
		fontFamily: "Helvetica-Bold",
		color: colors.black,
		letterSpacing: 0.5,
	},
	subtitle: {
		fontSize: 9,
		color: colors.mediumGray,
		marginTop: 8,
	},
	// Contenido
	content: {
		padding: 40,
		paddingTop: 30,
		paddingBottom: 80,
	},
	// Sección de evento
	eventSection: {
		marginBottom: 24,
	},
	eventHeader: {
		marginBottom: 12,
		paddingBottom: 10,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderGray,
	},
	eventTitle: {
		fontSize: 14,
		fontFamily: "Helvetica-Bold",
		color: colors.black,
		marginBottom: 4,
	},
	eventTime: {
		fontSize: 9,
		color: colors.mediumGray,
	},
	// Info de proveedores
	providerSection: {
		marginBottom: 10,
	},
	providerRow: {
		flexDirection: "row",
		marginBottom: 4,
	},
	providerLabel: {
		width: 70,
		fontSize: 8,
		fontFamily: "Helvetica-Bold",
		color: colors.mediumGray,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	providerValue: {
		fontSize: 9,
		color: colors.darkGray,
		flex: 1,
	},
	// Notas
	notesRow: {
		backgroundColor: colors.backgroundGray,
		padding: 10,
		marginBottom: 10,
	},
	notesLabel: {
		fontSize: 8,
		fontFamily: "Helvetica-Bold",
		color: colors.mediumGray,
		letterSpacing: 1,
		textTransform: "uppercase",
		marginBottom: 4,
	},
	notesText: {
		fontSize: 8,
		color: colors.darkGray,
		lineHeight: 1.5,
		fontStyle: "italic",
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
	tableHeaderText: {
		fontSize: 8,
		fontFamily: "Helvetica-Bold",
		color: colors.darkGray,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	tableRow: {
		flexDirection: "row",
		paddingVertical: 8,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderGray,
	},
	// 8-column passenger table
	colName: { width: "16%", paddingRight: 4 },
	colDocument: { width: "12%", paddingRight: 4 },
	colAge: { width: "6%", paddingRight: 4 },
	colNat: { width: "12%", paddingRight: 4 },
	colPhone: { width: "14%", paddingRight: 4 },
	colHotel: { width: "15%", paddingRight: 4 },
	colAllergies: { width: "13%", paddingRight: 4 },
	colDiet: { width: "12%" },
	// Event date label
	eventDate: {
		fontSize: 9,
		color: colors.mediumGray,
		marginBottom: 6,
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
	// Footer
	footer: {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
		padding: 30,
		paddingTop: 20,
		flexDirection: "row",
		justifyContent: "space-between",
		borderTopWidth: 1,
		borderTopColor: colors.borderGray,
	},
	footerText: {
		fontSize: 8,
		color: colors.lightGray,
	},
	// Sin eventos
	noEvents: {
		textAlign: "center",
		marginTop: 40,
		fontSize: 12,
		color: colors.lightGray,
	},
})

function EventSection({ event, index }: { event: PdfEventData; index: number }) {
	const modeLabel = event.mode === "PRIVATE" ? "Privado" : "Regular"
	const eventDateLabel = event.date
		? (() => {
				const d = new Date(event.date)
				// UTC-reconstruct: avoid runtime-tz shift on the UTC-midnight ISO string
				return format(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), "d 'de' MMMM yyyy", {
					locale: es,
				})
			})()
		: null

	return (
		<View style={styles.eventSection} wrap={false}>
			{/* Event date */}
			{eventDateLabel ? (
				<Text style={styles.eventDate}>{eventDateLabel}</Text>
			) : null}

			{/* Event header */}
			<View style={styles.eventHeader}>
				<Text style={styles.eventTitle}>
					{index + 1}. {event.tourName}
				</Text>
				<Text style={styles.eventTime}>
					{event.startTime && event.endTime
						? `${event.startTime} - ${event.endTime}`
						: event.startTime
							? `Desde ${event.startTime}`
							: "Horario no definido"}
					{" · "}
					{modeLabel}
					{" · "}
					{event.passengerCount} pax
				</Text>
			</View>

			{/* Provider info */}
			<View style={styles.providerSection}>
				<View style={styles.providerRow}>
					<Text style={styles.providerLabel}>Guia</Text>
					<Text style={styles.providerValue}>{event.guideName}</Text>
				</View>
				<View style={styles.providerRow}>
					<Text style={styles.providerLabel}>Chofer</Text>
					<Text style={styles.providerValue}>{event.driverName}</Text>
				</View>
				<View style={styles.providerRow}>
					<Text style={styles.providerLabel}>Vehiculo</Text>
					<Text style={styles.providerValue}>{event.vehicleInfo}</Text>
				</View>
			</View>

			{/* Notes */}
			{event.notes ? (
				<View style={styles.notesRow}>
					<Text style={styles.notesLabel}>Notas</Text>
					<Text style={styles.notesText}>{event.notes}</Text>
				</View>
			) : null}

			{/* Passenger table — 8 columns */}
			{event.passengers.length > 0 && (
				<View style={styles.table}>
					<View style={styles.tableHeader}>
						<Text style={[styles.tableHeaderText, styles.colName]}>Nombre</Text>
						<Text style={[styles.tableHeaderText, styles.colDocument]}>Documento</Text>
						<Text style={[styles.tableHeaderText, styles.colAge]}>Edad</Text>
						<Text style={[styles.tableHeaderText, styles.colNat]}>Nacionalidad</Text>
						<Text style={[styles.tableHeaderText, styles.colPhone]}>Teléfono</Text>
						<Text style={[styles.tableHeaderText, styles.colHotel]}>Hotel</Text>
						<Text style={[styles.tableHeaderText, styles.colAllergies]}>Alergias</Text>
						<Text style={[styles.tableHeaderText, styles.colDiet]}>Dieta</Text>
					</View>
					{event.passengers.map((pax, paxIndex) => (
						<View key={`${pax.name}-${paxIndex}`} style={styles.tableRow}>
							<Text style={[styles.cellTextBold, styles.colName]}>{pax.name}</Text>
							<Text style={[styles.cellText, styles.colDocument]}>{pax.document}</Text>
							<Text style={[styles.cellText, styles.colAge]}>{pax.age}</Text>
							<Text style={[styles.cellText, styles.colNat]}>{pax.nationality}</Text>
							<Text style={[styles.cellText, styles.colPhone]}>{pax.phone}</Text>
							<Text style={[styles.cellText, styles.colHotel]}>{pax.hotel}</Text>
							<Text style={[styles.cellText, { ...styles.colAllergies }]}>{pax.allergies}</Text>
							<Text style={[styles.cellText, { ...styles.colDiet }]}>{pax.diet}</Text>
						</View>
					))}
				</View>
			)}
		</View>
	)
}

export function DailyRoutePdf({ date, events, totalPassengers }: DailyRoutePdfProps) {
	return (
		<Document>
			<Page size="A4" style={styles.page}>
				{/* Branding header */}
				<View style={styles.brandingHeader}>
					{/* eslint-disable-next-line jsx-a11y/alt-text */}
					<Image src={COMPANY_INFO.logoUrl} style={styles.brandingLogo} />
					<View style={styles.brandingInfo}>
						<Text style={styles.brandingName}>{COMPANY_INFO.name}</Text>
						<Text style={styles.brandingDetail}>Sernatur: {COMPANY_INFO.sernatur}</Text>
						<Text style={styles.brandingDetail}>{COMPANY_INFO.address}</Text>
						<Text style={styles.brandingDetail}>{COMPANY_INFO.phone}</Text>
					</View>
				</View>

				{/* Header */}
				<View style={styles.header}>
					<Text style={styles.headerLabel}>Hoja de Ruta</Text>
					<Text style={styles.title}>{date}</Text>
					<Text style={styles.subtitle}>
						{events.length} {events.length === 1 ? "evento" : "eventos"} · {totalPassengers}{" "}
						{totalPassengers === 1 ? "pasajero" : "pasajeros"}
					</Text>
				</View>

				{/* Events */}
				<View style={styles.content}>
					{events.length === 0 ? (
						<Text style={styles.noEvents}>No hay eventos para esta fecha</Text>
					) : (
						events.map((event, index) => (
							<EventSection key={`${event.tourName}-${index}`} event={event} index={index} />
						))
					)}
				</View>

				{/* Footer */}
				<View style={styles.footer} fixed>
					<Text style={styles.footerText}>
						Generado: {new Date().toLocaleString("es-AR")}
					</Text>
					<Text
						style={styles.footerText}
						render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} de ${totalPages}`}
					/>
				</View>
			</Page>
		</Document>
	)
}
