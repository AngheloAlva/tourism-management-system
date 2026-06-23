"use server"

import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns"
import { headers } from "next/headers"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { canCurrentUserInteractPath } from "@/project/roles/actions/role.actions"

import type { CashCountType, ExpenseCategory } from "../constants/enums"

export type CashBoxWithDetails = {
	id: string
	date: Date
	initialBalance: number
	finalBalance: number | null
	initialUsdBalance: number
	finalUsdBalance: number | null
	status: string
	createdAt: Date
	updatedAt: Date
	entries: {
		id: string
		type: string
		amount: number
		currency: "CLP" | "USD"
		originalAmount: number | null
		exchangeRate: number | null
		description: string
		reference: string | null
		category: string | null
		paymentMethod: string | null
		createdAt: Date
		createdBy: { id: string; name: string }
	}[]
	counts: {
		id: string
		type: string
		countedAmount: number
		expectedAmount: number | null
		difference: number | null
		notes: string | null
		createdAt: Date
		createdBy: { id: string; name: string }
	}[]
	deposits: {
		id: string
		amount: number
		bankAccount: string | null
		reference: string | null
		notes: string | null
		createdAt: Date
		createdBy: { id: string; name: string }
	}[]
	payments: {
		id: string
		amount: number
		supplier: string
		concept: string
		invoiceNumber: string | null
		notes: string | null
		createdAt: Date
		createdBy: { id: string; name: string }
		provider: { id: string; fullName?: string | null; companyName?: string | null } | null
	}[]
}

export type CashFlowSummary = {
	currentBalance: number
	currentUsdBalance: number
	todayIncome: number
	todayIncomeCash: number
	todayIncomeCard: number
	todayIncomeTransfer: number
	todayIncomeCreditCard: number
	todayIncomeDebitCard: number
	todayIncomeTransferCount: number
	todayExchangeClp: number
	todayExpenses: number
	todayDeposits: number
	pendingOpenCount: boolean
	pendingCloseCount: boolean
	monthlyIncome: number
	monthlyExpenses: number
	monthlyDeposits: number
	status?: string
}

const CREDIT_PAYMENT_METHODS = new Set(["CREDIT_CARD", "PAYMENT_LINK_CREDIT"])
const DEBIT_PAYMENT_METHODS = new Set(["DEBIT_CARD", "PAYMENT_LINK_DEBIT"])

function getTodayExchangeClp(entries: CashBoxWithDetails["entries"]) {
	return entries
		.filter((entry) => entry.type === "CURRENCY_EXCHANGE" && entry.currency === "CLP")
		.reduce((sum, entry) => sum + entry.amount, 0)
}

function getUsdNetMovement(entries: CashBoxWithDetails["entries"]) {
	return entries
		.filter((entry) => entry.currency === "USD")
		.reduce((sum, entry) => sum + (entry.originalAmount ?? 0), 0)
}

function getCurrentUsdBalance(cashBox: CashBoxWithDetails) {
	if (cashBox.status === "CLOSED" && cashBox.finalUsdBalance !== null) {
		return cashBox.finalUsdBalance
	}

	return cashBox.initialUsdBalance + getUsdNetMovement(cashBox.entries)
}

export type CashFlowHistoryItem = {
	id: string
	date: Date
	initialBalance: number
	finalBalance: number | null
	status: string
	totalIncome: number
	totalExpenses: number
	totalDeposits: number
}

async function getAuthUser() {
	const session = await auth.api.getSession({ headers: await headers() })
	if (!session?.user) {
		throw new Error("No autenticado")
	}
	return session.user
}

async function requireCashFlowInteraction() {
	const canInteract = await canCurrentUserInteractPath("/dashboard/flujo-de-caja")
	if (!canInteract) {
		throw new Error("No tiene permisos para interactuar con flujo de caja")
	}
}

const cashBoxInclude = {
	entries: {
		include: { createdBy: { select: { id: true, name: true } } },
		orderBy: { createdAt: "desc" as const },
	},
	counts: {
		include: { createdBy: { select: { id: true, name: true } } },
		orderBy: { createdAt: "desc" as const },
	},
	deposits: {
		include: { createdBy: { select: { id: true, name: true } } },
		orderBy: { createdAt: "desc" as const },
	},
	payments: {
		include: {
			createdBy: { select: { id: true, name: true } },
			provider: { select: { id: true, fullName: true, companyName: true } },
		},
		orderBy: { createdAt: "desc" as const },
	},
}

export async function getCashBoxByDate(date: Date): Promise<CashBoxWithDetails | null> {
	await getAuthUser()

	const targetDate = startOfDay(date)

	const cashBox = await prisma.cashBox.findUnique({
		where: { date: targetDate },
		include: cashBoxInclude,
	})

	return cashBox as CashBoxWithDetails | null
}

export async function getCurrentCashBox(): Promise<CashBoxWithDetails> {
	await getAuthUser()

	const today = startOfDay(new Date())

	let cashBox = await prisma.cashBox.findUnique({
		where: { date: today },
		include: cashBoxInclude,
	})

	if (!cashBox) {
		const previousCashBox = await prisma.cashBox.findFirst({
			where: {
				date: { lt: today },
				status: "CLOSED",
			},
			orderBy: { date: "desc" },
		})

		const initialBalance = previousCashBox?.finalBalance ?? 0
		const initialUsdBalance = previousCashBox?.finalUsdBalance ?? 0

		cashBox = await prisma.cashBox.create({
			data: {
				date: today,
				initialBalance,
				initialUsdBalance,
				status: "OPEN",
			},
			include: cashBoxInclude,
		})
	}

	return cashBox as CashBoxWithDetails
}

export async function getCashBoxById(id: string): Promise<CashBoxWithDetails | null> {
	await getAuthUser()

	const cashBox = await prisma.cashBox.findUnique({
		where: { id },
		include: cashBoxInclude,
	})

	return cashBox as CashBoxWithDetails | null
}

export async function getCashFlowHistory(
	startDate?: Date,
	endDate?: Date
): Promise<CashFlowHistoryItem[]> {
	await getAuthUser()

	const where: { date?: { gte?: Date; lte?: Date } } = {}

	if (startDate || endDate) {
		where.date = {}
		if (startDate) where.date.gte = startOfDay(startDate)
		if (endDate) where.date.lte = endOfDay(endDate)
	}

	const cashBoxes = await prisma.cashBox.findMany({
		where,
		include: {
			entries: true,
			deposits: true,
			payments: true,
		},
		orderBy: { date: "desc" },
		take: 30,
	})

	return cashBoxes.map((box) => {
		const totalIncome = box.entries
			.filter(
				(e) => e.type === "INCOME" || (e.type === "CURRENCY_EXCHANGE" && e.currency === "CLP")
			)
			.reduce((sum, e) => sum + e.amount, 0)

		const totalExpenses =
			box.entries
				.filter((e) => e.type === "OTHER_EXPENSE")
				.reduce((sum, e) => sum + Math.abs(e.amount), 0) +
			box.payments.reduce((sum, p) => sum + p.amount, 0)

		const totalDeposits = box.deposits.reduce((sum, d) => sum + d.amount, 0)

		return {
			id: box.id,
			date: box.date,
			initialBalance: box.initialBalance,
			finalBalance: box.finalBalance,
			status: box.status,
			totalIncome,
			totalExpenses,
			totalDeposits,
		}
	})
}

export async function getCashFlowSummary(date: Date = new Date()): Promise<CashFlowSummary> {
	await getAuthUser()

	const targetDate = startOfDay(date)
	const today = startOfDay(new Date())
	const isToday = targetDate.getTime() === today.getTime()

	let cashBox: CashBoxWithDetails | null = null

	if (isToday) {
		cashBox = await getCurrentCashBox()
	} else {
		cashBox = await getCashBoxByDate(date)
	}

	if (!cashBox) {
		return {
			currentBalance: 0,
			currentUsdBalance: 0,
			todayIncome: 0,
			todayIncomeCash: 0,
			todayIncomeCard: 0,
			todayIncomeTransfer: 0,
			todayIncomeCreditCard: 0,
			todayIncomeDebitCard: 0,
			todayIncomeTransferCount: 0,
			todayExchangeClp: 0,
			todayExpenses: 0,
			todayDeposits: 0,
			pendingOpenCount: true,
			pendingCloseCount: true,
			monthlyIncome: 0,
			monthlyExpenses: 0,
			monthlyDeposits: 0,
			status: "NO_DATA",
		}
	}

	const todayIncomeEntries = cashBox.entries.filter((e) => e.type === "INCOME")

	const todayIncome = todayIncomeEntries.reduce((sum, e) => sum + e.amount, 0)
	const todayIncomeCreditCard = todayIncomeEntries
		.filter((e) => e.paymentMethod && CREDIT_PAYMENT_METHODS.has(e.paymentMethod))
		.reduce((sum, e) => sum + e.amount, 0)
	const todayIncomeDebitCard = todayIncomeEntries
		.filter((e) => e.paymentMethod && DEBIT_PAYMENT_METHODS.has(e.paymentMethod))
		.reduce((sum, e) => sum + e.amount, 0)
	const todayIncomeCard = todayIncomeCreditCard + todayIncomeDebitCard
	const todayIncomeTransfer = todayIncomeEntries
		.filter((e) => e.paymentMethod === "TRANSFER")
		.reduce((sum, e) => sum + e.amount, 0)
	const todayIncomeTransferCount = todayIncomeEntries.filter(
		(e) => e.paymentMethod === "TRANSFER"
	).length
	const todayIncomeCash = todayIncome - todayIncomeCard - todayIncomeTransfer
	const todayExchangeClp = getTodayExchangeClp(cashBox.entries)

	const todayExpenses =
		cashBox.entries
			.filter((e) => e.type === "OTHER_EXPENSE")
			.reduce((sum, e) => sum + Math.abs(e.amount), 0) +
		cashBox.payments.reduce((sum, p) => sum + p.amount, 0)

	const todayDeposits = cashBox.deposits.reduce((sum, d) => sum + d.amount, 0)

	const hasOpeningCount = cashBox.counts.some((c) => c.type === "OPENING")
	const hasClosingCount = cashBox.counts.some((c) => c.type === "CLOSING")

	const currentBalance =
		cashBox.status === "CLOSED" && cashBox.finalBalance !== null
			? cashBox.finalBalance
			: cashBox.initialBalance + todayIncome + todayExchangeClp - todayExpenses - todayDeposits
	const currentUsdBalance = getCurrentUsdBalance(cashBox)

	const start = startOfMonth(date)
	const end = endOfMonth(date)

	const monthlyCashBoxes = await prisma.cashBox.findMany({
		where: {
			date: {
				gte: start,
				lte: end,
			},
		},
		include: {
			entries: true,
			payments: true,
			deposits: true,
		},
	})

	const monthlyIncome = monthlyCashBoxes
		.flatMap((box) => box.entries)
		.filter((e) => e.type === "INCOME" || (e.type === "CURRENCY_EXCHANGE" && e.currency === "CLP"))
		.reduce((sum, e) => sum + e.amount, 0)

	const monthlyExpenses =
		monthlyCashBoxes
			.flatMap((box) => box.entries)
			.filter((e) => e.type === "OTHER_EXPENSE")
			.reduce((sum, e) => sum + Math.abs(e.amount), 0) +
		monthlyCashBoxes.flatMap((box) => box.payments).reduce((sum, p) => sum + p.amount, 0)

	const monthlyDeposits = monthlyCashBoxes
		.flatMap((box) => box.deposits)
		.reduce((sum, d) => sum + d.amount, 0)

	return {
		currentBalance,
		currentUsdBalance,
		todayIncome,
		todayIncomeCash,
		todayIncomeCard,
		todayIncomeTransfer,
		todayIncomeCreditCard,
		todayIncomeDebitCard,
		todayIncomeTransferCount,
		todayExchangeClp,
		todayExpenses,
		todayDeposits,
		pendingOpenCount: !hasOpeningCount,
		pendingCloseCount: !hasClosingCount && cashBox.status === "OPEN",
		monthlyIncome,
		monthlyExpenses,
		monthlyDeposits,
		status: cashBox.status,
	}
}

export async function createCashCount(data: {
	type: CashCountType
	countedAmount: number
	notes?: string
}) {
	const user = await getAuthUser()

	await requireCashFlowInteraction()

	const cashBox = await getCurrentCashBox()

	const existingCount = cashBox.counts.find((c) => c.type === data.type)
	if (existingCount) {
		throw new Error(
			data.type === "OPENING"
				? "Ya existe un conteo de apertura para hoy"
				: "Ya existe un conteo de cierre para hoy"
		)
	}

	const todayIncome = cashBox.entries
		.filter((e) => e.type === "INCOME")
		.reduce((sum, e) => sum + e.amount, 0)
	const todayExchangeClp = getTodayExchangeClp(cashBox.entries)

	const todayExpenses =
		cashBox.entries
			.filter((e) => e.type === "OTHER_EXPENSE")
			.reduce((sum, e) => sum + Math.abs(e.amount), 0) +
		cashBox.payments.reduce((sum, p) => sum + p.amount, 0)

	const todayDeposits = cashBox.deposits.reduce((sum, d) => sum + d.amount, 0)

	const expectedAmount =
		data.type === "OPENING"
			? cashBox.initialBalance
			: cashBox.initialBalance + todayIncome + todayExchangeClp - todayExpenses - todayDeposits
	const expectedUsdAmount = getCurrentUsdBalance(cashBox)

	const difference = data.countedAmount - expectedAmount

	const count = await prisma.cashCount.create({
		data: {
			type: data.type,
			countedAmount: data.countedAmount,
			expectedAmount,
			difference,
			notes: data.notes,
			cashBoxId: cashBox.id,
			createdById: user.id,
		},
		include: {
			createdBy: { select: { id: true, name: true } },
		},
	})

	if (data.type === "CLOSING") {
		await prisma.cashBox.update({
			where: { id: cashBox.id },
			data: {
				finalBalance: expectedAmount,
				finalUsdBalance: expectedUsdAmount,
				status: "CLOSED",
			},
		})
	}

	return count
}

export async function createCashDeposit(data: {
	amount: number
	bankAccount?: string
	reference?: string
	notes?: string
}) {
	const user = await getAuthUser()

	await requireCashFlowInteraction()

	const cashBox = await getCurrentCashBox()

	const deposit = await prisma.cashDeposit.create({
		data: {
			amount: data.amount,
			bankAccount: data.bankAccount,
			reference: data.reference,
			notes: data.notes,
			cashBoxId: cashBox.id,
			createdById: user.id,
		},
		include: {
			createdBy: { select: { id: true, name: true } },
		},
	})

	await prisma.cashBoxEntry.create({
		data: {
			type: "DEPOSIT",
			amount: -data.amount,
			currency: "CLP",
			originalAmount: data.amount,
			description: `Depósito bancario${data.bankAccount ? ` - ${data.bankAccount}` : ""}`,
			reference: data.reference,
			cashBoxId: cashBox.id,
			createdById: user.id,
		},
	})

	return deposit
}

export async function createSupplierPayment(data: {
	amount: number
	supplier: string
	concept: string
	invoiceNumber?: string
	notes?: string
	providerId?: string
}) {
	const user = await getAuthUser()

	await requireCashFlowInteraction()

	const cashBox = await getCurrentCashBox()

	const payment = await prisma.supplierPayment.create({
		data: {
			amount: data.amount,
			supplier: data.supplier,
			concept: data.concept,
			invoiceNumber: data.invoiceNumber,
			notes: data.notes,
			providerId: data.providerId,
			cashBoxId: cashBox.id,
			createdById: user.id,
		},
		include: {
			createdBy: { select: { id: true, name: true } },
			provider: { select: { id: true, fullName: true, companyName: true } },
		},
	})

	await prisma.cashBoxEntry.create({
		data: {
			type: "SUPPLIER_PAYMENT",
			amount: -data.amount,
			currency: "CLP",
			originalAmount: data.amount,
			description: `Pago a ${data.supplier}: ${data.concept}`,
			reference: data.invoiceNumber,
			cashBoxId: cashBox.id,
			createdById: user.id,
		},
	})

	return payment
}

export async function createOtherExpense(data: {
	amount: number
	description: string
	category: ExpenseCategory
	reference?: string
}) {
	const user = await getAuthUser()

	await requireCashFlowInteraction()

	const cashBox = await getCurrentCashBox()

	const entry = await prisma.cashBoxEntry.create({
		data: {
			type: "OTHER_EXPENSE",
			amount: -data.amount,
			currency: "CLP",
			originalAmount: data.amount,
			description: data.description,
			category: data.category,
			reference: data.reference,
			cashBoxId: cashBox.id,
			createdById: user.id,
		},
		include: {
			createdBy: { select: { id: true, name: true } },
		},
	})

	return entry
}

export async function registerCashIncome(data: {
	amount: number
	description: string
	reference?: string
	paymentRecordId?: string
	currency?: "CLP" | "USD"
	originalAmount?: number
	exchangeRate?: number
}) {
	const user = await getAuthUser()

	await requireCashFlowInteraction()

	const cashBox = await getCurrentCashBox()

	const entry = await prisma.cashBoxEntry.create({
		data: {
			type: "INCOME",
			amount: data.amount,
			currency: data.currency || "CLP",
			originalAmount: data.originalAmount ?? data.amount,
			exchangeRate: data.exchangeRate || null,
			description: data.description,
			reference: data.reference,
			paymentRecordId: data.paymentRecordId,
			cashBoxId: cashBox.id,
			createdById: user.id,
		},
		include: {
			createdBy: { select: { id: true, name: true } },
		},
	})

	return entry
}

export async function registerUsdExchange(data: {
	usdAmount: number
	clpAmount: number
	reference?: string
	notes?: string
}) {
	const user = await getAuthUser()

	await requireCashFlowInteraction()

	const cashBox = await getCurrentCashBox()

	const usdAmount = Number(data.usdAmount || 0)
	const clpAmount = Number(data.clpAmount || 0)

	if (usdAmount <= 0 || clpAmount <= 0) {
		throw new Error("Los montos de cambio deben ser mayores a 0")
	}

	const availableUsd = getCurrentUsdBalance(cashBox)
	if (usdAmount > availableUsd) {
		throw new Error("No hay saldo USD suficiente para realizar este cambio")
	}

	const exchangeRate = clpAmount / usdAmount
	const exchangeReference = data.reference?.trim() || `FX-${Date.now()}`
	const noteSuffix = data.notes?.trim() ? ` (${data.notes.trim()})` : ""

	const [clpEntry, usdEntry] = await prisma.$transaction([
		prisma.cashBoxEntry.create({
			data: {
				type: "CURRENCY_EXCHANGE",
				amount: clpAmount,
				currency: "CLP",
				originalAmount: clpAmount,
				exchangeRate,
				description: `Cambio USD a CLP: USD ${usdAmount.toFixed(2)} -> CLP ${Math.round(clpAmount).toLocaleString("es-CL")}${noteSuffix}`,
				reference: exchangeReference,
				cashBoxId: cashBox.id,
				createdById: user.id,
			},
		}),
		prisma.cashBoxEntry.create({
			data: {
				type: "CURRENCY_EXCHANGE",
				amount: 0,
				currency: "USD",
				originalAmount: -usdAmount,
				exchangeRate,
				description: `Salida USD por cambio: USD ${usdAmount.toFixed(2)}${noteSuffix}`,
				reference: exchangeReference,
				cashBoxId: cashBox.id,
				createdById: user.id,
			},
		}),
	])

	return {
		clpEntry,
		usdEntry,
		exchangeRate,
	}
}

export async function getExpensesByCategory(startDate?: Date, endDate?: Date) {
	await getAuthUser()

	const dateFilter: { gte?: Date; lte?: Date } = {}
	if (startDate) dateFilter.gte = startOfDay(startDate)
	if (endDate) dateFilter.lte = endOfDay(endDate)

	const entries = await prisma.cashBoxEntry.findMany({
		where: {
			type: "OTHER_EXPENSE",
			...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
		},
	})

	const byCategory = entries.reduce(
		(acc, entry) => {
			const category = entry.category || "OTHER"
			acc[category] = (acc[category] || 0) + Math.abs(entry.amount)
			return acc
		},
		{} as Record<string, number>
	)

	return byCategory
}

export async function getExpectedClosingBalance(date: Date = new Date()): Promise<{
	expectedAmount: number
	initialBalance: number
	totalIncome: number
	totalExpenses: number
	totalDeposits: number
	hasOpeningCount: boolean
	hasClosingCount: boolean
} | null> {
	await getAuthUser()

	const targetDate = startOfDay(date)
	const today = startOfDay(new Date())
	const isToday = targetDate.getTime() === today.getTime()

	let cashBox: CashBoxWithDetails | null = null

	if (isToday) {
		cashBox = await getCurrentCashBox()
	} else {
		cashBox = await getCashBoxByDate(date)
	}

	if (!cashBox) return null

	const totalSalesIncome = cashBox.entries
		.filter((e) => e.type === "INCOME")
		.reduce((sum, e) => sum + e.amount, 0)
	const totalExchangeClp = getTodayExchangeClp(cashBox.entries)
	const totalIncome = totalSalesIncome + totalExchangeClp

	const totalExpenses =
		cashBox.entries
			.filter((e) => e.type === "OTHER_EXPENSE")
			.reduce((sum, e) => sum + Math.abs(e.amount), 0) +
		cashBox.payments.reduce((sum, p) => sum + p.amount, 0)

	const totalDeposits = cashBox.deposits.reduce((sum, d) => sum + d.amount, 0)

	const expectedAmount = cashBox.initialBalance + totalIncome - totalExpenses - totalDeposits

	return {
		expectedAmount,
		initialBalance: cashBox.initialBalance,
		totalIncome,
		totalExpenses,
		totalDeposits,
		hasOpeningCount: cashBox.counts.some((c) => c.type === "OPENING"),
		hasClosingCount: cashBox.counts.some((c) => c.type === "CLOSING"),
	}
}
