import type {
	SaleRecord,
	EventBookingSchema,
	PaymentDetail,
} from "../schemas/sale-record.schema"
import type { ActiveTour } from "@/project/tours/hooks/use-tours"

/**
 * Count complimentary passengers, optionally filtered to a specific category.
 * The complimentary flag is the sole gate — a false flag with a category set
 * is NOT counted (switch-off guard, REQ-04 Scenario D).
 */
export const countComplimentary = (
	passengers: SaleRecord["passengerArray"] | null | undefined,
	categoryName?: string
): number =>
	(passengers || []).filter(
		(p) =>
			p.complimentary &&
			(categoryName === undefined || p.complimentaryCategory === categoryName)
	).length

/**
 * Count complimentary passengers that carry NO category. When a REGULAR booking
 * has a single price entry the category selector is hidden and assumed, so these
 * passengers must still be deducted from that sole category to actually go free.
 */
export const countComplimentaryUncategorized = (
	passengers: SaleRecord["passengerArray"] | null | undefined
): number =>
	(passengers || []).filter((p) => p.complimentary && !p.complimentaryCategory?.trim())
		.length

export interface NegotiatedTourPricing {
	tourId: string
	categoryOverrides?: Array<{ tourPriceCategoryId: string; price: number }>
	entryOverrides?: Array<{ tourEntryId: string; price: number }>
	privatePriceTiers?: { capacity: number; price: number }[]
	privatePricing?: { capacity: number; price: number }[]
}

const roundClp = (amount: number) => Math.round(amount)

const getUsdExchangeRate = (
	payment: Partial<
		PaymentDetail & {
			exchangeRate?: number | null
		}
	>
) => Number(payment.exchange_rate ?? payment.exchangeRate ?? 0)

export const getPaymentAmountInClp = (
	payment: Partial<
		PaymentDetail & {
			exchangeRate?: number | null
		}
	>
) => {
	const amount = Number(payment.amount || 0)
	const currency = payment.currency || "CLP"

	if (currency === "USD") {
		const exchangeRate = getUsdExchangeRate(payment)
		return exchangeRate > 0 ? roundClp(amount * exchangeRate) : 0
	}

	return roundClp(amount)
}

export const calculateUsdSuggestion = (clpAmount: number, exchangeRate: number) => {
	const normalizedClpAmount = Math.abs(roundClp(clpAmount))
	if (normalizedClpAmount <= 0 || exchangeRate <= 0) return null

	const exactUsd = normalizedClpAmount / exchangeRate
	const minUsd = Math.floor(exactUsd)
	const maxUsd = Math.ceil(exactUsd)

	return {
		exactUsd,
		minUsd,
		maxUsd,
	}
}

export const calculateTourPrice = (
	event: EventBookingSchema,
	availableTours: ActiveTour[],
	passengers: SaleRecord["passengerArray"],
	negotiatedPricing?: NegotiatedTourPricing | null
) => {
	const selectedTour = availableTours.find((t) => t.id === event.tourId)
	if (!selectedTour) return { total: 0, baseTotal: 0, entranceTotal: 0 }

	const priceEntries = event.priceEntries || []
	const entrySnapshots = event.entrySnapshots || []

	// Calculate entrance total
	let entranceTotal = 0
	entrySnapshots.forEach((snap) => {
		entranceTotal += snap.price * snap.count
	})

	// Calculate base total
	let baseTotal = 0
	const normalizedNegotiatedPrivateTiers =
		negotiatedPricing?.privatePriceTiers && negotiatedPricing.privatePriceTiers.length > 0
			? negotiatedPricing.privatePriceTiers
			: negotiatedPricing?.privatePricing
	const privatePricingSource =
		normalizedNegotiatedPrivateTiers && normalizedNegotiatedPrivateTiers.length > 0
			? normalizedNegotiatedPrivateTiers
			: (selectedTour.privatePricing as { capacity: number; price: number }[] | null)

	if (event.mode === "PRIVATE" && privatePricingSource && privatePricingSource.length > 0) {
		// Tier selection uses TOTAL pax (comps occupy seats — REQ-07).
		// Billing uses only non-complimentary pax (REQ-06).
		const totalPax = passengers?.length || 0
		const compCount = countComplimentary(passengers)
		const billablePax = Math.max(0, totalPax - compCount)

		const sortedPricing = [...privatePricingSource].sort(
			(a, b) =>
				(a as { capacity: number; price: number }).capacity -
				(b as { capacity: number; price: number }).capacity
		)

		const pricingTier = sortedPricing.find((p) => p.capacity >= totalPax)

		const appliedPrice = pricingTier
			? pricingTier.price
			: sortedPricing[sortedPricing.length - 1].price

		baseTotal = appliedPrice * billablePax
	} else {
		// REGULAR branch: deduct one unit price per complimentary passenger per matching
		// category, clamped so deductions never exceed the category subtotal (REQ-05).
		// A single-entry booking has only one possible category, so the form hides the
		// selector and comps may carry no category — attribute those here too. When
		// >1 categories exist, validation forces every comp to pick one, so there are
		// no uncategorized comps and this never double-counts.
		const singleEntry = priceEntries.length === 1
		priceEntries.forEach((pe) => {
			const compForCategory =
				countComplimentary(passengers, pe.categoryName) +
				(singleEntry ? countComplimentaryUncategorized(passengers) : 0)
			const clamped = Math.min(compForCategory, pe.count)
			const billableCount = Math.max(0, pe.count - clamped)
			baseTotal += pe.price * billableCount
		})
		baseTotal = Math.max(0, baseTotal)
	}

	return { total: baseTotal + entranceTotal, baseTotal, entranceTotal }
}

export const calculateSaleTotals = (
	formData: Partial<SaleRecord>,
	availableTours: ActiveTour[],
	selectedAgencyTourPricing: NegotiatedTourPricing[] = []
) => {
	const totalPagosRaw =
		formData.paymentArray?.reduce((sum, payment) => {
			const amountInClp = getPaymentAmountInClp(payment)
			return payment.refund ? sum - amountInClp : sum + amountInClp
		}, 0) || 0
	const totalPagos = roundClp(totalPagosRaw)

	const wholesaleMarkupRate = formData.isWholesale ? formData.wholesaleMarkup || 30 : 0

	const tourPrices =
		formData.eventBookings?.map((event) => {
			const negotiatedPricing =
				selectedAgencyTourPricing.find((pricing) => pricing.tourId === event.tourId) || null
			const price = calculateTourPrice(
				event,
				availableTours,
				formData.passengerArray || [],
				negotiatedPricing
			)
			const hasNegotiatedPricing = Boolean(negotiatedPricing)
			const baseTotalWithMarkup =
				wholesaleMarkupRate > 0 && !hasNegotiatedPricing
					? price.baseTotal * (1 + wholesaleMarkupRate / 100)
					: price.baseTotal

			return {
				...price,
				baseTotalWithMarkup,
				hasNegotiatedPricing,
			}
		}) || []
	const totalBaseTours = tourPrices.reduce((sum, price) => sum + price.baseTotal, 0)
	const totalEntranceFees = tourPrices.reduce((sum, price) => sum + price.entranceTotal, 0)
	const subtotalTours = tourPrices.reduce((sum, price) => sum + price.baseTotalWithMarkup, 0)
	const wholesaleMarkupAmount = subtotalTours - totalBaseTours
	const wholesaleMarkup =
		wholesaleMarkupRate > 0 && tourPrices.some((price) => !price.hasNegotiatedPricing)
			? wholesaleMarkupRate
			: 0

	const descuentoGlobal = formData.discount || 0
	const totalToursRaw =
		Math.max(0, subtotalTours - (Number(descuentoGlobal) * subtotalTours) / 100) + totalEntranceFees
	const totalTours = roundClp(totalToursRaw)

	const diferencia = totalPagos - totalTours
	const paymentTolerance =
		formData.paymentArray?.reduce((sum, payment) => {
			if (payment.currency !== "USD") return sum
			const exchangeRate = getUsdExchangeRate(payment)
			if (exchangeRate <= 0) return sum
			return sum + roundClp(exchangeRate)
		}, 0) || 0
	const isDifferenceWithinTolerance = Math.abs(diferencia) <= paymentTolerance

	return {
		totalPagos,
		totalBaseTours,
		totalEntranceFees,
		wholesaleMarkup,
		wholesaleMarkupAmount,
		subtotalTours,
		totalTours,
		diferencia,
		paymentTolerance,
		isDifferenceWithinTolerance,
		tourPrices,
	}
}
