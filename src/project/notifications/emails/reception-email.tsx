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

type ReceptionEventItem = {
	id: string
	date: Date
	tourName: string
	startTime: string | null
	endTime: string | null
}

type ReceptionEmailProps = {
	voucher: number
	date: Date
	agencyName: string
	executiveName: string | null
	passengerName: string | null
	comments: string | null
	events: ReceptionEventItem[]
}

export function ReceptionEmail({
	voucher,
	date,
	agencyName,
	executiveName,
	passengerName,
	comments,
	events,
}: ReceptionEmailProps) {
	return (
		<Html lang="es">
			<Head />
			<Preview>{`Recepcion R-${voucher} confirmada`}</Preview>
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
							Recepcion
						</Text>
						<Heading
							style={{ fontSize: "42px", color: emailTheme.colors.black, margin: "2px 0 8px" }}
						>
							R-{voucher}
						</Heading>
						<Text style={{ margin: 0, fontSize: "13px", color: emailTheme.colors.mediumGray }}>
							{format(date, "dd 'de' MMMM yyyy", { locale: es })}
						</Text>
					</Section>

					<Section style={{ padding: "0 36px" }}>
						<Hr style={{ borderColor: emailTheme.colors.lineGray, margin: "0 0 22px" }} />

						<Section style={{ marginBottom: "18px" }}>
							<Text style={sectionTitleStyle}>Datos generales</Text>
							<Text
								style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: "700", color: "#111827" }}
							>
								{agencyName}
							</Text>
							{passengerName ? (
								<Text
									style={{
										margin: "0 0 6px",
										fontSize: "13px",
										color: emailTheme.colors.mediumGray,
									}}
								>
									Primer pasajero: {passengerName}
								</Text>
							) : null}
							{executiveName ? (
								<Text style={{ margin: 0, fontSize: "13px", color: emailTheme.colors.mediumGray }}>
									Ejecutiva responsable: {executiveName}
								</Text>
							) : null}
						</Section>

						<Section style={{ marginBottom: "22px" }}>
							<Text style={sectionTitleStyle}>Itinerario</Text>
							<table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
								<thead>
									<tr>
										<th align="left" style={{ ...tableCellHeaderStyle, width: "22%" }}>
											Fecha
										</th>
										<th align="left" style={{ ...tableCellHeaderStyle, width: "42%" }}>
											Tour
										</th>
										<th align="center" style={{ ...tableCellHeaderStyle, width: "18%" }}>
											Inicio
										</th>
										<th align="center" style={{ ...tableCellHeaderStyle, width: "18%" }}>
											Termino
										</th>
									</tr>
								</thead>
								<tbody>
									{events.map((event) => (
										<tr key={event.id}>
											<td style={tableCellStyle}>{formatCalendarDay(event.date, "dd/MM/yyyy")}</td>
											<td style={tableCellStyle}>{event.tourName}</td>
											<td align="center" style={tableCellStyle}>
												{event.startTime || "-"}
											</td>
											<td align="center" style={tableCellStyle}>
												{event.endTime || "-"}
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
