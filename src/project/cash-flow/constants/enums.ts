export const CASH_ENTRY_TYPE = [
	"INCOME",
	"DEPOSIT",
	"SUPPLIER_PAYMENT",
	"OTHER_EXPENSE",
	"CURRENCY_EXCHANGE",
] as const
export type CashEntryType = (typeof CASH_ENTRY_TYPE)[number]

export const CASH_COUNT_TYPE = ["OPENING", "CLOSING"] as const
export type CashCountType = (typeof CASH_COUNT_TYPE)[number]

export const EXPENSE_CATEGORY = ["SUPPLIES", "TRANSPORTATION", "FOOD", "OTHER"] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORY)[number]

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
	SUPPLIES: "Suministros",
	TRANSPORTATION: "Transporte",
	FOOD: "Alimentación",
	OTHER: "Otros",
}
