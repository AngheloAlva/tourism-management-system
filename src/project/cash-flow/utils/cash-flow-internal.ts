import { startOfDay } from "date-fns"

import { prisma } from "@/lib/prisma"
import type { PrismaClient } from "@/generated/prisma/client"

/**
 * Internal cash-flow helpers — NOT server actions.
 *
 * These functions are called from already-authenticated server-side code
 * (sale, transfer, and reception actions). They live here, outside any
 * `"use server"` file, so they are not exposed as public endpoints.
 */

type PaymentMethodType =
	| "CASH"
	| "TRANSFER"
	| "CREDIT_CARD"
	| "DEBIT_CARD"
	| "PAYMENT_LINK_DEBIT"
	| "PAYMENT_LINK_CREDIT"

/**
 * Prisma transaction client type — same shape used in sale-record.actions.ts.
 * Omitting top-level methods that are not available inside a $transaction callback.
 */
type PrismaTxClient = Omit<
	PrismaClient,
	"$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>

/**
 * Floating-point epsilon: differences smaller than this are treated as zero.
 * Avoids spurious near-zero reversal rows caused by IEEE-754 summation drift.
 */
const EPSILON = 0.005

const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
	CASH: "Efectivo",
	TRANSFER: "Transferencia",
	CREDIT_CARD: "Tarjeta de Credito",
	DEBIT_CARD: "Tarjeta de Debito",
	PAYMENT_LINK_DEBIT: "Link de pago Debito",
	PAYMENT_LINK_CREDIT: "Link de pago Credito",
}

/**
 * Obtiene o crea la caja de hoy. Lógica compartida por todos los helpers de registro.
 *
 * Accepts an optional transaction client (tx) so callers inside a $transaction
 * can pass it through. Defaults to the global prisma client so all existing
 * call sites (createSaleRecord, transfers, receptions) remain unaffected.
 *
 * NOTE (W3 — do NOT fix here): this function returns today's box even when
 * status === "CLOSED". Entries appended to a closed box are excluded from live
 * balance calculations. This pre-existing behaviour also affects createSaleRecord
 * and registerCashFlowFromTransfer. Tracked separately for a follow-up fix.
 */
async function getOrCreateTodayCashBox(db: PrismaTxClient = prisma) {
	const today = startOfDay(new Date())

	let cashBox = await db.cashBox.findUnique({
		where: { date: today },
	})

	if (!cashBox) {
		const previousCashBox = await db.cashBox.findFirst({
			where: {
				date: { lt: today },
				status: "CLOSED",
			},
			orderBy: { date: "desc" },
		})

		const initialBalance = previousCashBox?.finalBalance ?? 0
		const initialUsdBalance = previousCashBox?.finalUsdBalance ?? 0

		cashBox = await db.cashBox.create({
			data: {
				date: today,
				initialBalance,
				initialUsdBalance,
				status: "OPEN",
			},
		})
	}

	return cashBox
}

/**
 * Registra un ingreso en el flujo de caja desde un pago de venta.
 *
 * Accepts an optional transaction client (tx) so it can participate in the
 * atomic recalculation transaction in recalculateSaleCashFlowOnEdit. Defaults
 * to the global prisma client so all existing callers (createSaleRecord) are
 * unaffected — no change needed at those call sites.
 */
export async function registerCashIncomeFromPayment(
	paymentId: string,
	amount: number,
	voucherNumber: number,
	userId: string,
	paymentMethod: PaymentMethodType = "CASH",
	paymentCurrency: "CLP" | "USD" = "CLP",
	originalAmount?: number,
	exchangeRate?: number,
	db: PrismaTxClient = prisma
) {
	const cashBox = await getOrCreateTodayCashBox(db)

	const methodLabel = PAYMENT_METHOD_LABELS[paymentMethod]
	const currencyLabel = paymentCurrency === "USD" ? "USD" : "CLP"
	const normalizedOriginalAmount =
		paymentCurrency === "USD"
			? (originalAmount ?? (exchangeRate && exchangeRate > 0 ? amount / exchangeRate : amount))
			: amount

	const entry = await db.cashBoxEntry.create({
		data: {
			type: "INCOME",
			amount,
			currency: paymentCurrency,
			originalAmount: normalizedOriginalAmount,
			exchangeRate: paymentCurrency === "USD" ? (exchangeRate ?? null) : null,
			description: `Pago ${methodLabel} (${currencyLabel}) - Voucher V${voucherNumber}`,
			reference: `V-${voucherNumber}`,
			paymentRecordId: paymentId,
			paymentMethod: paymentMethod,
			cashBoxId: cashBox.id,
			createdById: userId,
		},
	})

	return entry
}

/**
 * Registra un ingreso/egreso en el flujo de caja desde un traspaso
 * OUTGOING = ingreso (nos pagan), INCOMING = egreso (pagamos)
 */
export async function registerCashFlowFromTransfer(data: {
	transferId: string
	transferVoucher: number
	amount: number
	paymentMethod: PaymentMethodType
	transferType: "OUTGOING" | "INCOMING"
	agencyName: string
	userId: string
}) {
	const cashBox = await getOrCreateTodayCashBox()

	const isIncome = data.transferType === "OUTGOING"
	const methodLabel = PAYMENT_METHOD_LABELS[data.paymentMethod]
	const actionLabel = isIncome ? "Cobro" : "Pago"

	const entry = await prisma.cashBoxEntry.create({
		data: {
			type: isIncome ? "INCOME" : "SUPPLIER_PAYMENT",
			amount: isIncome ? data.amount : -data.amount,
			currency: "CLP",
			originalAmount: data.amount,
			description: `${actionLabel} traspaso ${methodLabel} - ${data.agencyName} (T-${data.transferVoucher})`,
			reference: `T-${data.transferVoucher}`,
			transferId: data.transferId,
			paymentMethod: data.paymentMethod,
			cashBoxId: cashBox.id,
			createdById: data.userId,
		},
	})

	return entry
}

/**
 * Recalcula el flujo de caja de una venta editada usando estrategia net-reversal.
 *
 * Algoritmo:
 * 1. Suma todas las entradas INCOME con reference = "V-{voucher}" POR MONEDA,
 *    separando CLP y USD (incluye reversales previos y entradas huérfanas — self-heal).
 * 2. Si |netClp| > EPSILON, crea UNA entrada de reversión CLP en la caja de HOY.
 * 3. Si |netUsdOriginal| > EPSILON, crea UNA entrada de reversión USD en la caja de HOY.
 * 4. Re-registra cada pago nuevo cash-affecting.
 *
 * Todo el proceso (pasos 2-4) ocurre en una sola $transaction, garantizando
 * atomicidad: o se aplican todos los cambios o ninguno (C2).
 *
 * La reversal USD usa currency:"USD" con originalAmount = -netUsdOriginal para
 * que getUsdNetMovement la contabilice correctamente (C1).
 *
 * La entrada de reversión aterriza siempre en la caja de HOY (nunca mutamos una
 * caja de un día pasado, sea abierta o cerrada — eso es intencional por diseño).
 *
 * NOTE (W3 — do NOT fix here): if today's box has status === "CLOSED", entries
 * written here are excluded from live balance queries. Pre-existing issue, tracked
 * separately.
 *
 * Retorna un resumen para auditoría.
 */
export async function recalculateSaleCashFlowOnEdit(params: {
	voucher: number
	newPayments: Array<{
		id: string
		amount: number
		method: string
		currency: string
		originalAmount: number | null
		exchangeRate: number | null
		refund: boolean
	}>
	userId: string
}): Promise<{
	reversedNetClp: number
	reversedNetUsd: number
	reRegisteredCount: number
	newIncomeTotal: number
}> {
	const { voucher, newPayments, userId } = params
	const reference = `V-${voucher}`

	// 1. Calcular nets existentes POR MONEDA para este voucher
	//    (incluye entradas de reversales anteriores — eso permite self-heal)
	const existingEntries = await prisma.cashBoxEntry.findMany({
		where: { reference, type: "INCOME" },
		select: { amount: true, currency: true, originalAmount: true },
	})

	// CLP dimension: sum of amount for all CLP entries
	const netClpAmount = existingEntries
		.filter((e) => e.currency === "CLP")
		.reduce((sum, e) => sum + e.amount, 0)

	// USD dimension: sum of amount (CLP-equivalent) and originalAmount (USD) for USD entries
	const netUsdAmount = existingEntries
		.filter((e) => e.currency === "USD")
		.reduce((sum, e) => sum + e.amount, 0)
	const netUsdOriginal = existingEntries
		.filter((e) => e.currency === "USD")
		.reduce((sum, e) => sum + (e.originalAmount ?? 0), 0)

	const cashAffectingPayments = newPayments.filter((p) => !p.refund && p.amount > 0)
	const newIncomeTotal = cashAffectingPayments.reduce((sum, p) => sum + p.amount, 0)

	// 2-4. Reversal + re-registration — all in ONE transaction (C2)
	await prisma.$transaction(async (tx) => {
		const cashBox = await getOrCreateTodayCashBox(tx)

		// 2. CLP reversal (only when |netClpAmount| > EPSILON)
		if (Math.abs(netClpAmount) > EPSILON) {
			await tx.cashBoxEntry.create({
				data: {
					type: "INCOME",
					amount: -netClpAmount,
					currency: "CLP",
					originalAmount: -netClpAmount,
					exchangeRate: null,
					description: `[REVERSAL] Ajuste por edición (CLP) - Voucher V${voucher}`,
					reference,
					paymentRecordId: null,
					paymentMethod: null,
					cashBoxId: cashBox.id,
					createdById: userId,
				},
			})
		}

		// 3. USD reversal (only when |netUsdOriginal| > EPSILON)
		//    amount = -(CLP-equivalent sum), currency = "USD", originalAmount = -(USD sum)
		//    This reverses BOTH the CLP income total AND the USD balance tracked by
		//    getUsdNetMovement (which filters on currency === "USD").
		if (Math.abs(netUsdOriginal) > EPSILON) {
			await tx.cashBoxEntry.create({
				data: {
					type: "INCOME",
					amount: -netUsdAmount,
					currency: "USD",
					originalAmount: -netUsdOriginal,
					exchangeRate: null,
					description: `[REVERSAL] Ajuste por edición (USD) - Voucher V${voucher}`,
					reference,
					paymentRecordId: null,
					paymentMethod: null,
					cashBoxId: cashBox.id,
					createdById: userId,
				},
			})
		}

		// 4. Re-register new cash-affecting payments
		for (const payment of cashAffectingPayments) {
			const paymentCurrency = (payment.currency as "CLP" | "USD") || "CLP"
			const paymentOriginalAmount = payment.originalAmount ?? undefined
			const paymentExchangeRate = payment.exchangeRate ?? undefined

			await registerCashIncomeFromPayment(
				payment.id,
				payment.amount,
				voucher,
				userId,
				payment.method as PaymentMethodType,
				paymentCurrency,
				paymentOriginalAmount,
				paymentExchangeRate,
				tx
			)
		}
	})

	return {
		reversedNetClp: netClpAmount,
		reversedNetUsd: netUsdOriginal,
		reRegisteredCount: cashAffectingPayments.length,
		newIncomeTotal,
	}
}
