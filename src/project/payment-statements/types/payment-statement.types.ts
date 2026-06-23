export interface PaymentStatementFilters {
	agencyIds?: string[]
	startDate: Date
	endDate: Date
	status?: "all" | "paid" | "pending" | "generated"
}

export interface PaymentStatementSale {
	id: string
	voucher: number
	fileNumber: string | null
	createdAt: Date
	invoiceId: string | null
	invoiceStatus: string | null
	agencyId: string | null
	agencyName: string | null
	firstPassengerName: string | null
	totalAmount: number
	paidAmount: number
	pendingAmount: number
	isPaid: boolean
	documentStatus: "pending" | "generated" | "sent"
	events: Array<{
		id: string
		eventId: string
		date: Date
		tourName: string
		participantCount: number
		amount: number
		transferredPassengerCount: number
		remainingPassengerCount: number
		isFullyTransferred: boolean
		isPartiallyTransferred: boolean
	}>
	payments: Array<{
		id: string
		date: Date
		method: string
		amount: number
		refund: boolean
	}>
}

export interface PaymentStatementSummary {
	totalSales: number
	totalAmount: number
	paidAmount: number
	pendingAmount: number
	generatedCount: number
	pendingGenerationCount: number
}

export interface AgencyOption {
	id: string
	name: string
	salesCount: number
}
