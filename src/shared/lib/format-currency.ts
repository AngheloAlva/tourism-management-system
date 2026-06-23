const currencyFormatter = new Intl.NumberFormat("es-CL", {
	style: "currency",
	currency: "CLP",
})

export function formatCurrency(amount: number): string {
	return currencyFormatter.format(amount)
}
