const PAYMENT_METHOD_LABELS = {
	CASH: "Efectivo",
	TRANSFER: "Transferencia",
	CREDIT_CARD: "Tarjeta de Credito",
	DEBIT_CARD: "Tarjeta de Debito",
	PAYMENT_LINK_DEBIT: "Link de pago Debito",
	PAYMENT_LINK_CREDIT: "Link de pago Credito",
	// Compatibilidad historica
	CARD: "Tarjeta",
	PAYMENT_LINK: "Link de pago",
	OTHER: "Otro",
} as const

type PaymentMethodKey = keyof typeof PAYMENT_METHOD_LABELS

export type PaymentMethod = (typeof PAYMENT_METHOD_LABELS)[PaymentMethodKey]

export const paymentMethodLabels: Record<string, string> = PAYMENT_METHOD_LABELS

export function getPaymentMethodLabel(method: string): string {
	return paymentMethodLabels[method] || method
}
