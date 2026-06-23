import {
	Body,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Img,
	Preview,
	Section,
	Text,
} from "@react-email/components"
import { format } from "date-fns"
import { es } from "date-fns/locale"

import { formatCalendarDay } from "@/shared/utils/calendar-day"

import { formatHotelsSummary } from "@/project/sales/utils/resolve-hotel"

import {
	emailContainerStyle,
	emailTheme,
	sectionTitleStyle,
	tableCellHeaderStyle,
	tableCellStyle,
} from "./email-theme"

type SaleEventItem = {
	id: string
	date: Date
	startTime: string | null
	endTime: string | null
	flyTime: string | null
	tourId: string | null
	tourName: string
	bookingTotal: number
	tourSummary: string | null
	tourSchedule: string | null
	tourIncludes: string | null
	tourPickup: string | null
	tourWhatToBring: string | null
	tourAltitude: string | null
	mode: "REGULAR" | "PRIVATE"
}

type SalePassengerHotelItem = {
	hotelName: string
	checkIn: Date | null
	checkOut: Date | null
	order: number
}

type SalePassengerItem = {
	id: string
	name: string | null
	document: string | null
	phone: string | null
	hotels: SalePassengerHotelItem[]
	nationality: string | null
	age: number | null
}

type SaleVoucherEmailProps = {
	voucher: number
	createdAt: Date
	agencyName?: string | null
	passengers: SalePassengerItem[]
	events: SaleEventItem[]
	includePrice: boolean
	baseUrl?: string
}

const formatCurrency = (amount: number) =>
	new Intl.NumberFormat("es-CL", {
		style: "currency",
		currency: "CLP",
		minimumFractionDigits: 0,
	}).format(amount)

function splitBulletLines(text: string | null) {
	if (!text) return []

	return text
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
}

export function SaleVoucherEmail({
	voucher,
	createdAt,
	agencyName,
	passengers,
	events,
	includePrice,
	baseUrl,
}: SaleVoucherEmailProps) {
	const passengerCount = Math.max(passengers.length, 1)
	const tourDetails = Array.from(
		new Map(
			events
				.filter((event) => Boolean(event.tourId))
				.map((event) => [
					event.tourId,
					{
						tourId: event.tourId,
						tourName: event.tourName,
						tourSummary: event.tourSummary,
						tourSchedule: event.tourSchedule,
						tourIncludes: event.tourIncludes,
						tourPickup: event.tourPickup,
						tourWhatToBring: event.tourWhatToBring,
						tourAltitude: event.tourAltitude,
					},
				])
		).values()
	).filter(
		(tour) =>
			Boolean(tour.tourSummary) ||
			Boolean(tour.tourSchedule) ||
			Boolean(tour.tourIncludes) ||
			Boolean(tour.tourPickup) ||
			Boolean(tour.tourWhatToBring) ||
			Boolean(tour.tourAltitude)
	)

	const totalAmount = events.reduce((acc, event) => {
		if (!includePrice) {
			return acc
		}

		return acc + event.bookingTotal
	}, 0)

	const assetPrefix = baseUrl || ""

	return (
		<Html lang="es">
			<Head />
			<Preview>{`Voucher V-${voucher} Turismo Chile Tours`}</Preview>
			<Body style={{ margin: 0, padding: "20px", backgroundColor: "#d1d5db" }}>
				<Container style={emailContainerStyle}>
					{baseUrl ? (
						<Img
							src={`${assetPrefix}/pdf-background.jpg`}
							alt="Atacama"
							width="760"
							style={{ width: "100%", height: "180px", objectFit: "cover", opacity: 0.8 }}
						/>
					) : null}

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
							Voucher
						</Text>
						<Heading
							style={{ fontSize: "44px", color: emailTheme.colors.black, margin: "2px 0 8px" }}
						>
							V-{voucher}
						</Heading>
						<Text style={{ margin: 0, fontSize: "13px", color: emailTheme.colors.mediumGray }}>
							{format(createdAt, "dd 'de' MMMM yyyy", { locale: es })}
						</Text>
					</Section>

					<Section style={{ padding: "0 36px" }}>
						<Hr style={{ borderColor: emailTheme.colors.lineGray, margin: "0 0 22px" }} />

						{agencyName ? (
							<Section style={{ marginBottom: "22px" }}>
								<Text style={sectionTitleStyle}>Agencia</Text>
								<Text
									style={{
										margin: 0,
										fontSize: "16px",
										fontWeight: "700",
										color: emailTheme.colors.black,
									}}
								>
									{agencyName}
								</Text>
							</Section>
						) : null}

						<Section style={{ marginBottom: "22px" }}>
							<Text style={sectionTitleStyle}>{`Pasajeros (${passengers.length})`}</Text>
							<table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
								<thead>
									<tr>
										<th align="left" style={{ ...tableCellHeaderStyle, width: "28%" }}>
											Nombre
										</th>
										<th align="left" style={{ ...tableCellHeaderStyle, width: "17%" }}>
											Documento
										</th>
										<th align="left" style={{ ...tableCellHeaderStyle, width: "18%" }}>
											Telefono
										</th>
										<th align="left" style={{ ...tableCellHeaderStyle, width: "19%" }}>
											Hotel
										</th>
										<th align="left" style={{ ...tableCellHeaderStyle, width: "12%" }}>
											Pais
										</th>
										<th align="right" style={{ ...tableCellHeaderStyle, width: "6%" }}>
											Edad
										</th>
									</tr>
								</thead>
								<tbody>
									{passengers.map((passenger) => (
										<tr key={passenger.id}>
											<td style={tableCellStyle}>{passenger.name || "-"}</td>
											<td style={tableCellStyle}>{passenger.document || "-"}</td>
											<td style={tableCellStyle}>{passenger.phone || "-"}</td>
											<td style={tableCellStyle}>{formatHotelsSummary(passenger.hotels)}</td>
											<td style={tableCellStyle}>{passenger.nationality || "-"}</td>
											<td align="right" style={tableCellStyle}>
												{passenger.age || "-"}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</Section>

						<Section style={{ marginBottom: "22px" }}>
							<Text style={sectionTitleStyle}>Tours</Text>
							<table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
								<thead>
									<tr>
										<th align="left" style={{ ...tableCellHeaderStyle, width: "19%" }}>
											Fecha
										</th>
										<th
											align="left"
											style={{ ...tableCellHeaderStyle, width: includePrice ? "38%" : "48%" }}
										>
											Tour
										</th>
										<th align="center" style={{ ...tableCellHeaderStyle, width: "14%" }}>
											Inicio
										</th>
										<th align="center" style={{ ...tableCellHeaderStyle, width: "14%" }}>
											Termino
										</th>
										{includePrice ? (
											<th align="right" style={{ ...tableCellHeaderStyle, width: "15%" }}>
												Monto
											</th>
										) : null}
									</tr>
								</thead>
								<tbody>
									{events.map((event) => (
										<tr key={event.id}>
											<td style={tableCellStyle}>{formatCalendarDay(event.date, "dd/MM/yyyy")}</td>
											<td style={tableCellStyle}>
												<Text
													style={{
														margin: "0 0 3px",
														fontSize: "13px",
														fontWeight: "700",
														color: "#111827",
													}}
												>
													{event.tourName}
												</Text>
												{event.mode === "PRIVATE" ? (
													<Text
														style={{
															margin: 0,
															fontSize: "11px",
															color: emailTheme.colors.mediumGray,
														}}
													>
														Servicio privado
													</Text>
												) : null}
											</td>
											<td align="center" style={tableCellStyle}>
												{event.startTime || event.flyTime || "-"}
											</td>
											<td align="center" style={tableCellStyle}>
												{event.endTime || "-"}
											</td>
											{includePrice ? (
												<td align="right" style={tableCellStyle}>
													{event.bookingTotal > 0
														? formatCurrency(event.bookingTotal)
														: "-"}
												</td>
											) : null}
										</tr>
									))}
								</tbody>
							</table>
						</Section>

						{includePrice ? (
							<Section style={{ marginTop: "24px", textAlign: "right" }}>
								<Hr style={{ borderColor: emailTheme.colors.black, margin: "0 0 12px" }} />
								<Text
									style={{
										margin: "0 0 4px",
										fontSize: "12px",
										textTransform: "uppercase",
										letterSpacing: "1px",
										color: emailTheme.colors.mediumGray,
									}}
								>
									Total
								</Text>
								<Text
									style={{
										margin: 0,
										fontSize: "34px",
										lineHeight: "36px",
										fontWeight: "700",
										color: emailTheme.colors.accent,
									}}
								>
									{formatCurrency(totalAmount)}
								</Text>
							</Section>
						) : null}

						<Section style={{ marginTop: "28px" }}>
							<Hr style={{ borderColor: emailTheme.colors.lineGray, margin: "0 0 14px" }} />
							<Text style={{ margin: 0, fontSize: "12px", color: emailTheme.colors.mediumGray }}>
								Contacto de emergencia: +56 9 8967 4264
							</Text>
							<Text
								style={{ margin: "6px 0 0", fontSize: "12px", color: emailTheme.colors.mediumGray }}
							>
								turismochiletours.com
							</Text>
						</Section>

						{tourDetails.length > 0 ? (
							<Section style={{ marginTop: "30px" }}>
								<Hr style={{ borderColor: emailTheme.colors.lineGray, margin: "0 0 20px" }} />
								<Text style={sectionTitleStyle}>Detalle de tours</Text>
								{tourDetails.map((tour) => {
									const scheduleLines = splitBulletLines(tour.tourSchedule)
									const includesLines = splitBulletLines(tour.tourIncludes)
									const whatToBringLines = splitBulletLines(tour.tourWhatToBring)

									return (
										<Section
											key={tour.tourId || tour.tourName}
											style={{
												marginBottom: "22px",
												padding: "16px",
												backgroundColor: emailTheme.colors.white,
											}}
										>
											<Text
												style={{
													margin: "0 0 10px",
													fontSize: "18px",
													fontWeight: "700",
													color: emailTheme.colors.black,
												}}
											>
												{tour.tourName}
											</Text>

											{tour.tourSummary ? (
												<>
													<Text style={sectionTitleStyle}>Resumen general</Text>
													<Text
														style={{ margin: "0 0 12px", fontSize: "13px", lineHeight: "20px" }}
													>
														{tour.tourSummary}
													</Text>
												</>
											) : null}

											{scheduleLines.length > 0 ? (
												<>
													<Text style={sectionTitleStyle}>Itinerario</Text>
													{scheduleLines.map((line, index) => (
														<Text
															key={`schedule-${index}`}
															style={{ margin: "0 0 6px", fontSize: "13px" }}
														>
															- {line}
														</Text>
													))}
												</>
											) : null}

											{includesLines.length > 0 ? (
												<>
													<Text style={sectionTitleStyle}>Incluye</Text>
													{includesLines.map((line, index) => (
														<Text
															key={`includes-${index}`}
															style={{ margin: "0 0 6px", fontSize: "13px" }}
														>
															- {line}
														</Text>
													))}
												</>
											) : null}

											{tour.tourPickup ? (
												<>
													<Text style={sectionTitleStyle}>Punto de encuentro</Text>
													<Text
														style={{ margin: "0 0 12px", fontSize: "13px", lineHeight: "20px" }}
													>
														{tour.tourPickup}
													</Text>
												</>
											) : null}

											{whatToBringLines.length > 0 ? (
												<>
													<Text style={sectionTitleStyle}>Que traer</Text>
													{whatToBringLines.map((line, index) => (
														<Text
															key={`bring-${index}`}
															style={{ margin: "0 0 6px", fontSize: "13px" }}
														>
															- {line}
														</Text>
													))}
												</>
											) : null}

											{tour.tourAltitude ? (
												<>
													<Text style={sectionTitleStyle}>Informacion de altitud</Text>
													<Text
														style={{
															margin: 0,
															fontSize: "13px",
															lineHeight: "20px",
															padding: "12px",
															backgroundColor: emailTheme.colors.paperGray,
														}}
													>
														{tour.tourAltitude}
													</Text>
												</>
											) : null}
										</Section>
									)
								})}
							</Section>
						) : null}
					</Section>
				</Container>
			</Body>
		</Html>
	)
}
