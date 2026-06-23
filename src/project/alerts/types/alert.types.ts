export const ALERT_LEVEL = {
	CRITICAL: "CRITICAL",
	WARNING: "WARNING",
	INFO: "INFO",
} as const

export type AlertLevel = (typeof ALERT_LEVEL)[keyof typeof ALERT_LEVEL]

export const ALERT_SCOPE = {
	OPERATIONS: "OPERATIONS",
	SALES: "SALES",
	FINANCE: "FINANCE",
	PROVIDERS: "PROVIDERS",
	DATA: "DATA",
} as const

export type AlertScope = (typeof ALERT_SCOPE)[keyof typeof ALERT_SCOPE]

export const ALERT_ICON = {
	USER_X: "USER_X",
	USERS: "USERS",
	CAR: "CAR",
	UTENSILS: "UTENSILS",
	ALERT_TRIANGLE: "ALERT_TRIANGLE",
	WALLET: "WALLET",
	FILE_TEXT: "FILE_TEXT",
	LANDMARK: "LANDMARK",
	CALENDAR: "CALENDAR",
	MAP_PIN: "MAP_PIN",
	CHECK_CIRCLE: "CHECK_CIRCLE",
} as const

export type AlertIcon = (typeof ALERT_ICON)[keyof typeof ALERT_ICON]

export interface AlertAction {
	label: string
	href: string
}

export interface DashboardAlert {
	id: string
	ruleId: string
	level: AlertLevel
	scope: AlertScope
	title: string
	description: string
	entityType: string
	entityId: string
	createdAt: string
	dueAt: string | null
	owner: string
	tags: string[]
	icon: AlertIcon
	action: AlertAction | null
}

export interface AlertRuleHighlight {
	ruleId: string
	title: string
	level: AlertLevel
	count: number
}

export interface AlertsDashboardData {
	alerts: DashboardAlert[]
	total: number
	generatedAt: string
	summaryByLevel: Record<AlertLevel, number>
	summaryByScope: Record<AlertScope, number>
	ruleHighlights: AlertRuleHighlight[]
}

export interface AlertEngineEventInput {
	id: string
	date: Date
	startTime: string | null
	status: string
	currentBookings: number
	maxCapacity: number
	tourName: string
	guideName: string | null
	driverName: string | null
	vehiclePlate: string | null
	hasCateringProvider: boolean
}

export interface AlertEngineSaleInput {
	id: string
	voucher: number
	type: "SALE" | "QUOTE"
	status: string
	discount: number
	wholesaleMarkup: number
	createdAt: Date
	passengerCount: number
	eventBookingsCount: number
	expectedAmount: number
	paidAmount: number
	hasConvertedSale: boolean
}

export interface AlertEngineTransferInput {
	id: string
	voucher: number
	date: Date
	paymentStatus: "PENDING" | "ENTRANCE_ONLY" | "TOUR_ONLY" | "FULLY_PAID"
	agencyName: string
}

export interface AlertEngineCashBoxInput {
	id: string
	date: Date
	status: string
	hasClosingCount: boolean
}

export interface AlertEngineProviderInput {
	id: string
	displayName: string
	licenseRenovationDate: Date | null
	technicalRevisionDate: Date | null
	circulationPermitDate: Date | null
	decree80Date: Date | null
	sernaturRenovationDate: Date | null
}

export interface AlertEngineAgencyInput {
	id: string
	name: string
	contactEmails: string[]
}

export interface AlertEngineTourInput {
	id: string
	name: string
	active: boolean
	imageUrl: string | null
	startTime: string | null
	endTime: string | null
}

export interface AlertEngineSnapshot {
	events: AlertEngineEventInput[]
	sales: AlertEngineSaleInput[]
	transfers: AlertEngineTransferInput[]
	cashBoxes: AlertEngineCashBoxInput[]
	providers: AlertEngineProviderInput[]
	agencies: AlertEngineAgencyInput[]
	tours: AlertEngineTourInput[]
}
