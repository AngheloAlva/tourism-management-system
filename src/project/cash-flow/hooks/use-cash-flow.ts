import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { isToday } from "date-fns"
import { toast } from "sonner"

import {
	getCashBoxById,
	createCashCount,
	createCashDeposit,
	getCurrentCashBox,
	getCashBoxByDate,
	createOtherExpense,
	registerCashIncome,
	registerUsdExchange,
	getCashFlowHistory,
	getCashFlowSummary,
	getExpensesByCategory,
	createSupplierPayment,
	getExpectedClosingBalance,
} from "../actions/cash-flow.actions"

import type { CashCountType, ExpenseCategory } from "../constants/enums"

export const cashFlowKeys = {
	all: ["cash-flow"] as const,
	current: () => [...cashFlowKeys.all, "current"] as const,
	daily: (date?: Date) => [...cashFlowKeys.all, "daily", date?.toISOString()] as const,
	detail: (id: string) => [...cashFlowKeys.all, "detail", id] as const,
	history: (startDate?: Date, endDate?: Date) =>
		[...cashFlowKeys.all, "history", startDate?.toISOString(), endDate?.toISOString()] as const,
	summary: (date?: Date) => [...cashFlowKeys.all, "summary", date?.toISOString()] as const,
	expectedBalance: (date?: Date) =>
		[...cashFlowKeys.all, "expected-balance", date?.toISOString()] as const,
	expensesByCategory: (startDate?: Date, endDate?: Date) =>
		[
			...cashFlowKeys.all,
			"expenses-by-category",
			startDate?.toISOString(),
			endDate?.toISOString(),
		] as const,
}

export function useDailyCashBox(date?: Date) {
	return useQuery({
		queryKey: cashFlowKeys.daily(date),
		queryFn: async () => {
			if (date && !isToday(date)) {
				return getCashBoxByDate(date)
			}
			return getCurrentCashBox()
		},
	})
}

export function useCurrentCashBox() {
	return useDailyCashBox()
}

export function useCashBox(id: string) {
	return useQuery({
		queryKey: cashFlowKeys.detail(id),
		queryFn: () => getCashBoxById(id),
		enabled: !!id,
	})
}

export function useCashFlowHistory(startDate?: Date, endDate?: Date) {
	return useQuery({
		queryKey: cashFlowKeys.history(startDate, endDate),
		queryFn: () => getCashFlowHistory(startDate, endDate),
	})
}

export function useCashFlowSummary(date?: Date) {
	return useQuery({
		queryKey: cashFlowKeys.summary(date),
		queryFn: () => getCashFlowSummary(date),
	})
}

export function useExpectedClosingBalance(date?: Date) {
	return useQuery({
		queryKey: cashFlowKeys.expectedBalance(date),
		queryFn: () => getExpectedClosingBalance(date),
	})
}

export function useExpensesByCategory(startDate?: Date, endDate?: Date) {
	return useQuery({
		queryKey: cashFlowKeys.expensesByCategory(startDate, endDate),
		queryFn: () => getExpensesByCategory(startDate, endDate),
	})
}

export function useCreateCashCount() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (data: { type: CashCountType; countedAmount: number; notes?: string }) =>
			createCashCount(data),
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: cashFlowKeys.all })
			toast.success(
				variables.type === "OPENING" ? "Apertura de caja registrada" : "Cierre de caja registrado"
			)
		},
		onError: (error: Error) => {
			toast.error(error.message || "Error al registrar conteo de caja")
			console.error(error)
		},
	})
}

export function useCreateCashDeposit() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (data: {
			amount: number
			bankAccount?: string
			reference?: string
			notes?: string
		}) => createCashDeposit(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: cashFlowKeys.all })
			toast.success("Depósito bancario registrado")
		},
		onError: (error) => {
			toast.error("Error al registrar depósito")
			console.error(error)
		},
	})
}

export function useCreateSupplierPayment() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (data: {
			amount: number
			supplier: string
			concept: string
			invoiceNumber?: string
			notes?: string
			providerId?: string
		}) => createSupplierPayment(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: cashFlowKeys.all })
			toast.success("Pago a proveedor registrado")
		},
		onError: (error) => {
			toast.error("Error al registrar pago")
			console.error(error)
		},
	})
}

export function useCreateOtherExpense() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (data: {
			amount: number
			description: string
			category: ExpenseCategory
			reference?: string
		}) => createOtherExpense(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: cashFlowKeys.all })
			toast.success("Gasto registrado")
		},
		onError: (error) => {
			toast.error("Error al registrar gasto")
			console.error(error)
		},
	})
}

export function useRegisterCashIncome() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (data: {
			amount: number
			description: string
			reference?: string
			paymentRecordId?: string
		}) => registerCashIncome(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: cashFlowKeys.all })
			toast.success("Ingreso en efectivo registrado")
		},
		onError: (error) => {
			toast.error("Error al registrar ingreso")
			console.error(error)
		},
	})
}

export function useRegisterUsdExchange() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (data: { usdAmount: number; clpAmount: number; reference?: string; notes?: string }) =>
			registerUsdExchange(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: cashFlowKeys.all })
			toast.success("Cambio USD registrado")
		},
		onError: (error: Error) => {
			toast.error(error.message || "Error al registrar cambio USD")
			console.error(error)
		},
	})
}
