export type Estado = "PENDING" | "ENTRANCE_ONLY" | "TOUR_ONLY" | "FULLY_PAID"

export type CGStatusFilter = "ALL" | Estado

export type CGRow = {
	id?: string
	fecha: string
	voucher: number | string
	pax: number
	tour: string
	entrada: number
	valor: number
	total: number
	estado: Estado
	type?: "RECEPTION" | "TRANSFER"
	proofOfPayment?: string | null
}

export type CGData = {
	recepciones: CGRow[]
	traspasos: CGRow[]
}

export type CGBalanceRow = {
	id: string
	label: string
	recepcionado: number
	traspasado: number
	diferencia: number
	estado: "POSITIVE" | "NEGATIVE" | "ZERO"
	descripcion: string
}

export type CGParams = {
	agencyId: string
	from?: Date
	to?: Date
	includePaid?: boolean
}

export const clp = (value: number) => new Intl.NumberFormat("es-CL").format(Math.round(value))

export const inRange = (isoDate: string, from?: Date, to?: Date) => {
	const timestamp = new Date(isoDate).getTime()
	if (from && timestamp < from.getTime()) return false
	if (to && timestamp > to.getTime()) return false
	return true
}

export const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0)

export const calculateBalance = (row: CGRow) => {
	if (row.estado === "FULLY_PAID") return 0
	if (row.estado === "ENTRANCE_ONLY") return row.valor
	if (row.estado === "TOUR_ONLY") return row.entrada
	return row.total
}

export const computeResumen = (data: CGData) => {
	const nosDeben = sum(
		data.recepciones.filter((row) => row.estado !== "FULLY_PAID").map((row) => row.total)
	)
	const debemos = sum(
		data.traspasos.filter((row) => row.estado !== "FULLY_PAID").map((row) => row.total)
	)
	return { nosDeben, debemos, diferencia: nosDeben - debemos }
}

const mapEstado = (difference: number): CGBalanceRow["estado"] => {
	if (difference > 0) return "POSITIVE"
	if (difference < 0) return "NEGATIVE"
	return "ZERO"
}

const describeEstado = (estado: CGBalanceRow["estado"]) => {
	if (estado === "POSITIVE") return "Saldo a recuperar"
	if (estado === "NEGATIVE") return "Pago pendiente por cubrir"
	return "Sin diferencias"
}

const BALANCE_CONFIGURATIONS = [
	{
		id: "pending",
		label: "Pendiente",
		matches: (estado: Estado) =>
			estado === "PENDING" || estado === "ENTRANCE_ONLY" || estado === "TOUR_ONLY",
	},
	{
		id: "paid",
		label: "Pagado",
		matches: (estado: Estado) => estado === "FULLY_PAID",
	},
	{
		id: "global",
		label: "Total general",
		matches: () => true,
	},
] as const

export const computeBalanceRows = (data: CGData): CGBalanceRow[] =>
	BALANCE_CONFIGURATIONS.map((config) => {
		const recepcionado = sum(
			data.recepciones.filter((row) => config.matches(row.estado)).map((row) => row.total)
		)
		const traspasado = sum(
			data.traspasos.filter((row) => config.matches(row.estado)).map((row) => row.total)
		)

		const diferencia = recepcionado - traspasado
		const estado = mapEstado(diferencia)

		return {
			id: config.id,
			label: config.label,
			recepcionado,
			traspasado,
			diferencia,
			estado,
			descripcion: describeEstado(estado),
		}
	})
