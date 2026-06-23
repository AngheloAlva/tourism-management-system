import {
	ALERT_ICON,
	ALERT_LEVEL,
	ALERT_SCOPE,
	type AlertEngineProviderInput,
	type AlertEngineSnapshot,
	type AlertLevel,
	type AlertsDashboardData,
	type DashboardAlert,
} from "../types/alert.types"

const OWNER_BY_SCOPE = {
	[ALERT_SCOPE.OPERATIONS]: "Operaciones",
	[ALERT_SCOPE.SALES]: "Ventas",
	[ALERT_SCOPE.FINANCE]: "Finanzas",
	[ALERT_SCOPE.PROVIDERS]: "Proveedores",
	[ALERT_SCOPE.DATA]: "Administracion",
} as const

const QUOTE_EXPIRATION_DAYS = 7
const TRANSFER_STALE_DAYS = 2
const PROVIDER_EXPIRATION_WINDOW_DAYS = 30

interface BuildAlertInput {
	ruleId: string
	level: AlertLevel
	scope: DashboardAlert["scope"]
	entityType: string
	entityId: string
	title: string
	description: string
	tags: string[]
	icon: DashboardAlert["icon"]
	createdAt: Date
	dueAt?: Date | null
	action?: DashboardAlert["action"]
}

function buildAlert(input: BuildAlertInput): DashboardAlert {
	return {
		id: `${input.ruleId}:${input.entityId}`,
		ruleId: input.ruleId,
		level: input.level,
		scope: input.scope,
		title: input.title,
		description: input.description,
		entityType: input.entityType,
		entityId: input.entityId,
		createdAt: input.createdAt.toISOString(),
		dueAt: input.dueAt ? input.dueAt.toISOString() : null,
		owner: OWNER_BY_SCOPE[input.scope],
		tags: input.tags,
		icon: input.icon,
		action: input.action || null,
	}
}

function getProviderExpiringDocuments(provider: AlertEngineProviderInput, now: Date) {
	const start = now.getTime()
	const end = start + PROVIDER_EXPIRATION_WINDOW_DAYS * 24 * 60 * 60 * 1000

	const checks = [
		{ label: "Licencia", value: provider.licenseRenovationDate },
		{ label: "Revision tecnica", value: provider.technicalRevisionDate },
		{ label: "Permiso de circulacion", value: provider.circulationPermitDate },
		{ label: "Decreto 80", value: provider.decree80Date },
		{ label: "Sernatur", value: provider.sernaturRenovationDate },
	]

	return checks.filter((check) => {
		if (!check.value) return false
		const date = check.value.getTime()
		return date >= start && date <= end
	})
}

export function buildAlertsDashboardData(
	snapshot: AlertEngineSnapshot,
	now = new Date()
): AlertsDashboardData {
	const alerts: DashboardAlert[] = []
	const nowTime = now.getTime()

	for (const event of snapshot.events) {
		const eventDate = event.date

		if (!event.guideName) {
			alerts.push(
				buildAlert({
					ruleId: "EVENT_WITHOUT_GUIDE",
					level: ALERT_LEVEL.CRITICAL,
					scope: ALERT_SCOPE.OPERATIONS,
					entityType: "EVENT",
					entityId: event.id,
					title: "Evento sin guia asignado",
					description: `${event.tourName}${event.startTime ? ` ${event.startTime}` : ""} no tiene guia asignado.`,
					tags: ["Evento", "Guia", "Salida"],
					icon: ALERT_ICON.USER_X,
					createdAt: eventDate,
					dueAt: eventDate,
					action: {
						label: "Abrir Control de Salidas",
						href: `/dashboard/control-de-salidas?eventId=${event.id}`,
					},
				})
			)
		}

		if (!event.driverName) {
			alerts.push(
				buildAlert({
					ruleId: "EVENT_WITHOUT_DRIVER",
					level: ALERT_LEVEL.CRITICAL,
					scope: ALERT_SCOPE.OPERATIONS,
					entityType: "EVENT",
					entityId: event.id,
					title: "Evento sin conductor asignado",
					description: `${event.tourName}${event.startTime ? ` ${event.startTime}` : ""} no tiene conductor asignado.`,
					tags: ["Evento", "Conductor", "Salida"],
					icon: ALERT_ICON.USERS,
					createdAt: eventDate,
					dueAt: eventDate,
					action: {
						label: "Abrir Control de Salidas",
						href: `/dashboard/control-de-salidas?eventId=${event.id}`,
					},
				})
			)
		}

		if (!event.vehiclePlate) {
			alerts.push(
				buildAlert({
					ruleId: "EVENT_WITHOUT_VEHICLE",
					level: ALERT_LEVEL.CRITICAL,
					scope: ALERT_SCOPE.OPERATIONS,
					entityType: "EVENT",
					entityId: event.id,
					title: "Evento sin vehiculo asignado",
					description: `${event.tourName}${event.startTime ? ` ${event.startTime}` : ""} no tiene vehiculo asignado.`,
					tags: ["Evento", "Vehiculo", "Salida"],
					icon: ALERT_ICON.CAR,
					createdAt: eventDate,
					dueAt: eventDate,
					action: {
						label: "Abrir Control de Salidas",
						href: `/dashboard/control-de-salidas?eventId=${event.id}`,
					},
				})
			)
		}

		if (!event.hasCateringProvider && event.currentBookings > 6) {
			alerts.push(
				buildAlert({
					ruleId: "EVENT_WITHOUT_CATERING",
					level: ALERT_LEVEL.WARNING,
					scope: ALERT_SCOPE.OPERATIONS,
					entityType: "EVENT",
					entityId: event.id,
					title: "Evento sin catering asignado",
					description: `${event.tourName} tiene ${event.currentBookings} pasajeros y no tiene catering.`,
					tags: ["Catering", "Operacion", "Servicio"],
					icon: ALERT_ICON.UTENSILS,
					createdAt: eventDate,
					dueAt: eventDate,
					action: {
						label: "Abrir Control de Salidas",
						href: `/dashboard/control-de-salidas?eventId=${event.id}`,
					},
				})
			)
		}

		if (event.currentBookings > event.maxCapacity) {
			alerts.push(
				buildAlert({
					ruleId: "EVENT_OVER_CAPACITY",
					level: ALERT_LEVEL.CRITICAL,
					scope: ALERT_SCOPE.OPERATIONS,
					entityType: "EVENT",
					entityId: event.id,
					title: "Evento con sobrecupo",
					description: `${event.tourName} supera su capacidad (${event.currentBookings}/${event.maxCapacity}).`,
					tags: ["Capacidad", "Pax", "Riesgo"],
					icon: ALERT_ICON.ALERT_TRIANGLE,
					createdAt: eventDate,
					dueAt: eventDate,
					action: {
						label: "Abrir Control de Salidas",
						href: `/dashboard/control-de-salidas?eventId=${event.id}`,
					},
				})
			)
		}
	}

	for (const sale of snapshot.sales) {
		if (sale.type === "SALE" && sale.passengerCount === 0) {
			alerts.push(
				buildAlert({
					ruleId: "SALE_WITHOUT_PASSENGERS",
					level: ALERT_LEVEL.WARNING,
					scope: ALERT_SCOPE.SALES,
					entityType: "SALE_RECORD",
					entityId: sale.id,
					title: "Venta sin pasajeros registrados",
					description: `Voucher ${sale.voucher} no tiene pasajeros registrados.`,
					tags: ["Venta", "Pasajeros", "Datos"],
					icon: ALERT_ICON.USERS,
					createdAt: sale.createdAt,
					action: {
						label: "Abrir Registro de Ventas",
						href: `/dashboard/registro-de-ventas?voucher=${sale.voucher}`,
					},
				})
			)
		}

		if (sale.type === "SALE" && sale.eventBookingsCount === 0) {
			alerts.push(
				buildAlert({
					ruleId: "SALE_WITHOUT_EVENTS",
					level: ALERT_LEVEL.CRITICAL,
					scope: ALERT_SCOPE.SALES,
					entityType: "SALE_RECORD",
					entityId: sale.id,
					title: "Venta sin eventos asociados",
					description: `Voucher ${sale.voucher} no tiene salidas asociadas.`,
					tags: ["Venta", "Evento", "Operacion"],
					icon: ALERT_ICON.FILE_TEXT,
					createdAt: sale.createdAt,
					action: {
						label: "Abrir Registro de Ventas",
						href: `/dashboard/registro-de-ventas?voucher=${sale.voucher}`,
					},
				})
			)
		}

		const quoteAgeDays = Math.floor((nowTime - sale.createdAt.getTime()) / (24 * 60 * 60 * 1000))
		if (sale.type === "QUOTE" && !sale.hasConvertedSale && quoteAgeDays > QUOTE_EXPIRATION_DAYS) {
			alerts.push(
				buildAlert({
					ruleId: "QUOTE_EXPIRED",
					level: ALERT_LEVEL.WARNING,
					scope: ALERT_SCOPE.SALES,
					entityType: "SALE_RECORD",
					entityId: sale.id,
					title: "Cotizacion vencida sin contacto",
					description: `Voucher ${sale.voucher} lleva ${quoteAgeDays} dias sin conversion.`,
					tags: ["Cotizacion", "Seguimiento", "Conversion"],
					icon: ALERT_ICON.FILE_TEXT,
					createdAt: sale.createdAt,
					action: {
						label: "Abrir Navegacion Cotizaciones",
						href: `/dashboard/navegacion-cotizacion?voucher=${sale.voucher}`,
					},
				})
			)
		}

		if (
			sale.type === "SALE" &&
			sale.expectedAmount > 0 &&
			sale.paidAmount + 1 < sale.expectedAmount
		) {
			const pendingAmount = Math.max(0, Math.round(sale.expectedAmount - sale.paidAmount))
			alerts.push(
				buildAlert({
					ruleId: "SALE_INCOMPLETE_PAYMENT",
					level: ALERT_LEVEL.WARNING,
					scope: ALERT_SCOPE.FINANCE,
					entityType: "SALE_RECORD",
					entityId: sale.id,
					title: "Venta con pagos incompletos",
					description: `Voucher ${sale.voucher} tiene saldo pendiente aprox. de CLP ${pendingAmount.toLocaleString("es-CL")}.`,
					tags: ["Venta", "Pago", "Cobranza"],
					icon: ALERT_ICON.WALLET,
					createdAt: sale.createdAt,
					action: {
						label: "Abrir Registro de Ventas",
						href: `/dashboard/registro-de-ventas?voucher=${sale.voucher}`,
					},
				})
			)
		}
	}

	for (const transfer of snapshot.transfers) {
		if (transfer.paymentStatus === "FULLY_PAID") continue

		const ageDays = Math.floor((nowTime - transfer.date.getTime()) / (24 * 60 * 60 * 1000))
		if (ageDays < TRANSFER_STALE_DAYS) continue

		alerts.push(
			buildAlert({
				ruleId: "TRANSFER_PENDING_PAYMENT",
				level: ALERT_LEVEL.WARNING,
				scope: ALERT_SCOPE.FINANCE,
				entityType: "AGENCY_TRANSFER",
				entityId: transfer.id,
				title: "Traspaso con pago pendiente",
				description: `Traspaso ${transfer.voucher} de ${transfer.agencyName} en estado ${transfer.paymentStatus} hace ${ageDays} dias.`,
				tags: ["Transfer", "Pago", "Mayorista"],
				icon: ALERT_ICON.LANDMARK,
				createdAt: transfer.date,
				action: {
					label: "Abrir Traspasos",
					href: `/dashboard/traspasos?voucher=${transfer.voucher}`,
				},
			})
		)
	}

	for (const cashBox of snapshot.cashBoxes) {
		const boxDate = cashBox.date.getTime()

		if (cashBox.status === "OPEN" && boxDate < nowTime) {
			alerts.push(
				buildAlert({
					ruleId: "CASHBOX_OPEN_PREVIOUS_DAY",
					level: ALERT_LEVEL.CRITICAL,
					scope: ALERT_SCOPE.FINANCE,
					entityType: "CASH_BOX",
					entityId: cashBox.id,
					title: "Caja abierta del dia anterior",
					description: "Existe una caja en estado OPEN con fecha anterior a hoy.",
					tags: ["Caja", "Cierre", "Control"],
					icon: ALERT_ICON.WALLET,
					createdAt: cashBox.date,
					action: {
						label: "Abrir Flujo de Caja",
						href: "/dashboard/flujo-de-caja",
					},
				})
			)
		}

		if (boxDate < nowTime && !cashBox.hasClosingCount) {
			alerts.push(
				buildAlert({
					ruleId: "CASHBOX_WITHOUT_CLOSING_COUNT",
					level: ALERT_LEVEL.WARNING,
					scope: ALERT_SCOPE.FINANCE,
					entityType: "CASH_BOX",
					entityId: cashBox.id,
					title: "Cierre de caja sin arqueo",
					description: "Caja de fecha anterior sin registro de arqueo de cierre.",
					tags: ["Caja", "Arqueo", "Control"],
					icon: ALERT_ICON.CALENDAR,
					createdAt: cashBox.date,
					action: {
						label: "Abrir Flujo de Caja",
						href: "/dashboard/flujo-de-caja",
					},
				})
			)
		}
	}

	for (const provider of snapshot.providers) {
		const expiringDocuments = getProviderExpiringDocuments(provider, now)
		if (expiringDocuments.length === 0) continue

		alerts.push(
			buildAlert({
				ruleId: "PROVIDER_DOCUMENT_EXPIRING",
				level: ALERT_LEVEL.INFO,
				scope: ALERT_SCOPE.PROVIDERS,
				entityType: "PROVIDER",
				entityId: provider.id,
				title: "Proveedor con documentos por vencer",
				description: `${provider.displayName} tiene por vencer: ${expiringDocuments.map((item) => item.label).join(", ")}.`,
				tags: ["Proveedor", "Documentos", "Vencimiento"],
				icon: ALERT_ICON.CAR,
				createdAt: now,
				action: {
					label: "Abrir Proveedores",
					href: "/dashboard/control-de-proveedores",
				},
			})
		)
	}

	for (const agency of snapshot.agencies) {
		if (agency.contactEmails.length > 0) continue

		alerts.push(
			buildAlert({
				ruleId: "AGENCY_WITHOUT_CONTACT_EMAIL",
				level: ALERT_LEVEL.WARNING,
				scope: ALERT_SCOPE.DATA,
				entityType: "AGENCY",
				entityId: agency.id,
				title: "Agencia sin correo de contacto",
				description: `${agency.name} no tiene correos de contacto registrados.`,
				tags: ["Agencia", "Datos", "Contacto"],
				icon: ALERT_ICON.MAP_PIN,
				createdAt: now,
				action: {
					label: "Abrir Gestion de Mayoristas",
					href: "/dashboard/gestion-de-mayoristas",
				},
			})
		)
	}

	for (const tour of snapshot.tours) {
		if (!tour.active) continue

		const hasImage = Boolean(tour.imageUrl)
		const hasSchedule = Boolean(tour.startTime) || Boolean(tour.endTime)
		if (hasImage && hasSchedule) continue

		alerts.push(
			buildAlert({
				ruleId: "TOUR_WITHOUT_MEDIA_OR_SCHEDULE",
				level: ALERT_LEVEL.INFO,
				scope: ALERT_SCOPE.DATA,
				entityType: "TOUR",
				entityId: tour.id,
				title: "Tour activo con datos incompletos",
				description: `${tour.name} no tiene ${!hasImage ? "imagen" : "horario"} configurado.`,
				tags: ["Tour", "Datos", "Configuracion"],
				icon: ALERT_ICON.FILE_TEXT,
				createdAt: now,
				action: {
					label: "Abrir Tours",
					href: "/dashboard/tours",
				},
			})
		)
	}

	const sortedAlerts = alerts.sort((a, b) => {
		const levelWeight = {
			[ALERT_LEVEL.CRITICAL]: 3,
			[ALERT_LEVEL.WARNING]: 2,
			[ALERT_LEVEL.INFO]: 1,
		} as const

		const byLevel = levelWeight[b.level] - levelWeight[a.level]
		if (byLevel !== 0) return byLevel

		const dateA = a.dueAt ?? a.createdAt
		const dateB = b.dueAt ?? b.createdAt
		return dateB.localeCompare(dateA)
	})

	const summaryByLevel: AlertsDashboardData["summaryByLevel"] = {
		[ALERT_LEVEL.CRITICAL]: 0,
		[ALERT_LEVEL.WARNING]: 0,
		[ALERT_LEVEL.INFO]: 0,
	}

	const summaryByScope: AlertsDashboardData["summaryByScope"] = {
		[ALERT_SCOPE.OPERATIONS]: 0,
		[ALERT_SCOPE.SALES]: 0,
		[ALERT_SCOPE.FINANCE]: 0,
		[ALERT_SCOPE.PROVIDERS]: 0,
		[ALERT_SCOPE.DATA]: 0,
	}

	const rulesCounter = new Map<string, { title: string; level: AlertLevel; count: number }>()

	for (const alert of sortedAlerts) {
		summaryByLevel[alert.level]++
		summaryByScope[alert.scope]++

		const rule = rulesCounter.get(alert.ruleId)
		if (!rule) {
			rulesCounter.set(alert.ruleId, {
				title: alert.title,
				level: alert.level,
				count: 1,
			})
			continue
		}

		rule.count++
	}

	const ruleHighlights = Array.from(rulesCounter.entries())
		.map(([ruleId, value]) => ({
			ruleId,
			title: value.title,
			level: value.level,
			count: value.count,
		}))
		.sort((a, b) => b.count - a.count)

	return {
		alerts: sortedAlerts,
		total: sortedAlerts.length,
		generatedAt: now.toISOString(),
		summaryByLevel,
		summaryByScope,
		ruleHighlights,
	}
}
