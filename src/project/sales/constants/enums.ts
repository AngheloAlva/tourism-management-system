export const SALE_TYPE = ["SALE", "QUOTE"] as const
export const CHANNEL_TYPE = ["ONLINE", "AGENCY", "PHYSICAL", "WHOLESALE"] as const
export const SALE_MODE = ["REGULAR", "PRIVATE"] as const
export const DIET_TYPE = ["NORMAL", "VEGETARIAN", "VEGAN", "CELIAC", "OTHER"] as const
export const PAYMENT_METHOD = [
	"CASH",
	"TRANSFER",
	"CREDIT_CARD",
	"DEBIT_CARD",
	"PAYMENT_LINK_DEBIT",
	"PAYMENT_LINK_CREDIT",
] as const
export const PAYMENT_CURRENCY = ["CLP", "USD"] as const
export const EVENT_TYPE = ["TOUR", "EVENT"] as const

export const SaleType = {
	SALE: "SALE",
	QUOTE: "QUOTE",
} as const

export const ChannelType = {
	ONLINE: "ONLINE",
	AGENCY: "AGENCY",
	PHYSICAL: "PHYSICAL",
	WHOLESALE: "WHOLESALE",
} as const

export const CHANNEL_LABELS: Record<(typeof CHANNEL_TYPE)[number], string> = {
	ONLINE: "Online",
	AGENCY: "Agencia",
	PHYSICAL: "Físico",
	WHOLESALE: "Mayoristas",
} as const

export const SaleMode = {
	REGULAR: "REGULAR",
	PRIVATE: "PRIVATE",
} as const

export const DietType = {
    NORMAL: "NORMAL",
    VEGETARIAN: "VEGETARIAN",
    VEGAN: "VEGAN",
    CELIAC: "CELIAC",
    OTHER: "OTHER",
} as const

export const PaymentMethod = {
	CASH: "CASH",
	TRANSFER: "TRANSFER",
	CREDIT_CARD: "CREDIT_CARD",
	DEBIT_CARD: "DEBIT_CARD",
	PAYMENT_LINK_DEBIT: "PAYMENT_LINK_DEBIT",
	PAYMENT_LINK_CREDIT: "PAYMENT_LINK_CREDIT",
} as const

export const PaymentCurrency = {
	CLP: "CLP",
	USD: "USD",
} as const

export const DIET_OPTIONS = [
	{ label: "Normal", value: "NORMAL" },
	{ label: "Vegetariana", value: "VEGETARIAN" },
	{ label: "Vegana", value: "VEGAN" },
	{ label: "Celiaco", value: "CELIAC" },
	{ label: "Otra", value: "OTHER" },
] as const satisfies ReadonlyArray<{ label: string; value: DietTypeValue }>

export type SaleTypeValue = (typeof SALE_TYPE)[number]
export type ChannelTypeValue = (typeof CHANNEL_TYPE)[number]
export type SaleModeValue = (typeof SALE_MODE)[number]
export type DietTypeValue = (typeof DIET_TYPE)[number]
export type PaymentMethodValue = (typeof PAYMENT_METHOD)[number]
export type PaymentCurrencyValue = (typeof PAYMENT_CURRENCY)[number]
