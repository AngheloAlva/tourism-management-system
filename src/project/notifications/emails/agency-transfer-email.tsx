import {
	Body,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Preview,
	Section,
	Text,
} from "@react-email/components"
import { format } from "date-fns"
import { es } from "date-fns/locale"

import { formatCalendarDay } from "@/shared/utils/calendar-day"
import {
	emailContainerStyle,
	emailTheme,
	sectionTitleStyle,
	tableCellHeaderStyle,
	tableCellStyle,
} from "./email-theme"

type TransferEventItem = {
	id: string
	date: Date
	tourName: string
	passengerCount: number
}

type AgencyTransferEmailProps = {
	voucher: number
	date: Date
	saleVoucher: number | null
	agencyName: string
	executiveName: string | null
	comments: string | null
	events: TransferEventItem[]
	passengerNames: string[]
}

export function AgencyTransferEmail({
	voucher,
	date,
	saleVoucher,
	agencyName,
	executiveName,
	comments,
	events,
	passengerNames,
}: AgencyTransferEmailProps) {
	return (
		<Html lang="es">
			<Head />
			<Preview>{`Traspaso T-${voucher} para ${agencyName}`}</Preview>
			<Body style={{ margin: 0, padding: "20px", backgroundColor: "#d1d5db" }}>
				<Container style={emailContainerStyle}>
					<Section style={{ padding: "28px 36px 10px" }}>
						<Text
							style={{
								fontSize: "12px",
								letterSpacing: "2px",
								textTransform: "uppercase",
								color: emailTheme.colors.mediumGray,
								margin: 0,
							}}
						>
							Traspaso
						</Text>
						<Heading
							style={{ fontSize: "42px", color: emailTheme.colors.black, margin: "2px 0 8px" }}
						>
							T-{voucher}
						</Heading>
						<Text style={{ margin: 0, fontSize: "13px", color: emailTheme.colors.mediumGray }}>
							{format(date, "dd 'de' MMMM yyyy", { locale: es })}
						</Text>
					</Section>

					<Section style={{ padding: "0 36px" }}>
						<Hr style={{ borderColor: emailTheme.colors.lineGray, margin: "0 0 22px" }} />

						<Section style={{ marginBottom: "18px" }}>
							<Text style={sectionTitleStyle}>Agencia receptora</Text>
							<Text style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#111827" }}>
								{agencyName}
							</Text>
							{saleVoucher ? (
								<Text
									style={{
										margin: "8px 0 0",
										fontSize: "13px",
										color: emailTheme.colors.mediumGray,
									}}
								>
									Voucher origen: V-{saleVoucher}
								</Text>
							) : null}
							{executiveName ? (
								<Text
									style={{
										margin: "6px 0 0",
										fontSize: "13px",
										color: emailTheme.colors.mediumGray,
									}}
								>
									Ejecutiva responsable: {executiveName}
								</Text>
							) : null}
						</Section>

						<Section style={{ marginBottom: "22px" }}>
							<Text style={sectionTitleStyle}>Pasajeros traspasados</Text>
							{passengerNames.length === 0 ? (
								<Text style={{ margin: 0, fontSize: "13px", color: emailTheme.colors.mediumGray }}>
									Sin pasajeros registrados.
								</Text>
							) : (
								passengerNames.map((name, index) => (
									<Text key={`${name}-${index}`} style={{ margin: "0 0 6px", fontSize: "13px" }}>
										- {name}
									</Text>
								))
							)}
						</Section>

						<Section style={{ marginBottom: "22px" }}>
							<Text style={sectionTitleStyle}>Tours traspasados</Text>
							<table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
								<thead>
									<tr>
										<th align="left" style={{ ...tableCellHeaderStyle, width: "24%" }}>
											Fecha
										</th>
										<th align="left" style={{ ...tableCellHeaderStyle, width: "56%" }}>
											Tour
										</th>
										<th align="right" style={{ ...tableCellHeaderStyle, width: "20%" }}>
											Pax
										</th>
									</tr>
								</thead>
								<tbody>
									{events.map((event) => (
										<tr key={event.id}>
											<td style={tableCellStyle}>{formatCalendarDay(event.date, "dd/MM/yyyy")}</td>
											<td style={tableCellStyle}>{event.tourName}</td>
											<td align="right" style={tableCellStyle}>
												{event.passengerCount}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</Section>

						{comments ? (
							<Section style={{ marginBottom: "22px" }}>
								<Text style={sectionTitleStyle}>Comentarios</Text>
								<Text
									style={{
										margin: 0,
										fontSize: "13px",
										lineHeight: "20px",
										padding: "12px",
										backgroundColor: emailTheme.colors.white,
									}}
								>
									{comments}
								</Text>
							</Section>
						) : null}

						<Hr style={{ borderColor: emailTheme.colors.lineGray, margin: "0 0 14px" }} />
						<Text style={{ margin: 0, fontSize: "12px", color: emailTheme.colors.mediumGray }}>
							Este correo fue generado automaticamente por Turismo Chile Tours.
						</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	)
}
