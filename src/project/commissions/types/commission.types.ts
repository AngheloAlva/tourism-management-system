import type { CommissionKind } from "@/generated/prisma/enums"

export type { CommissionKind }

export interface CommissionFilters {
	operatorId: string
	startDate: Date
	endDate: Date
}

export interface CommissionPdfFilters extends CommissionFilters {
	percentage: number
	kind: CommissionKind
}

/**
 * Per-booking commission detail — present when the booking has been marked paid.
 */
export interface CommissionDetail {
	id: string
	kind: CommissionKind
	percentage: number
	baseAmount: number
	commissionAmount: number
	totalPaid: number
	paidAt: Date
	paidBy: { id: string; name: string | null }
	notes: string | null
}

/**
 * A single EventBooking with booking-level paid state.
 * Replaces the old voucher-level commissionPaid / commissionPaidAt flags.
 */
export interface CommissionBooking {
	id: string
	eventId: string
	date: Date
	tourName: string
	tourType: string
	entries: Array<{ name: string; count: number }>
	saleAmount: number
	entranceFees: number
	tourOnlyAmount: number
	/** Derived: true when an EventBookingCommission row exists for (booking.id, kind). */
	commissionPaid: boolean
	/** Present when commissionPaid is true. */
	commission: CommissionDetail | null
}

/**
 * A voucher (SaleRecord) with its in-period, in-kind bookings embedded.
 * commissionPaid / commissionPaidAt are REMOVED — derive from bookings at render time:
 *   allPaid   = bookings.every(b => b.commissionPaid)
 *   partPaid  = bookings.some(b => b.commissionPaid)
 */
export interface CommissionSale {
	id: string
	voucher: number
	fileNumber: string | null
	createdAt: Date
	channel: string
	bookings: CommissionBooking[]
	totalSaleAmount: number
	totalEntranceFees: number
	totalTourOnly: number
	kind: CommissionKind
}

export interface CommissionSummary {
	totalSales: number
	totalSaleAmount: number
	totalEntranceFees: number
	totalTourOnly: number
	totalCommissionPaid: number
}

/**
 * Input for marking bookings as paid.
 * Previously accepted saleIds — now accepts bookingIds (EventBooking IDs).
 */
export interface MarkCommissionAsPaidInput {
	bookingIds: string[]
	percentage: number
	notes?: string
	kind: CommissionKind
}

export interface OperatorOption {
	id: string
	name: string | null
	/** Count of unpaid eligible bookings (COMPLETED + in-period + kind-matching) for this operator. */
	bookingsCount: number
}
