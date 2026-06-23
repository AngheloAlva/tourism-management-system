import { ArrowUpRightIcon, ArrowDownLeftIcon, WalletIcon } from "lucide-react"

import { clp } from "./types"

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"

type BalanceCardsProps = {
	receivables: number
	payables: number
	balance: number
}

export function BalanceCards({ receivables, payables, balance }: BalanceCardsProps) {
	return (
		<div className="grid gap-4 md:grid-cols-2">
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0">
					<CardTitle className="text-sm font-medium">Por Pagar (Recepciones)</CardTitle>
					<ArrowUpRightIcon className="h-4 w-4 text-amber-500" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold text-amber-600">{clp(payables)}</div>
					<p className="text-muted-foreground text-xs">Pendiente de transferir a la agencia</p>
				</CardContent>
			</Card>
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0">
					<CardTitle className="text-sm font-medium">Por Cobrar (Traspasos)</CardTitle>
					<ArrowDownLeftIcon className="h-4 w-4 text-emerald-500" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold text-emerald-600">{clp(receivables)}</div>
					<p className="text-muted-foreground text-xs">
						Pendiente de recibir por parte de la agencia
					</p>
				</CardContent>
			</Card>
			<Card className="md:col-span-2">
				<CardHeader className="flex flex-row items-center justify-between space-y-0">
					<CardTitle className="text-sm font-medium">Balance Actual</CardTitle>
					<WalletIcon className="h-4 w-4 text-green-500" />
				</CardHeader>
				<CardContent>
					<div
						className={`text-2xl font-bold ${
							balance > 0 ? "text-green-600" : balance < 0 ? "text-red-500" : "text-gray-900"
						}`}
					>
						{clp(balance)}
					</div>
					<p className="text-muted-foreground text-xs">
						{balance > 0
							? "La agencia te debe dinero"
							: balance < 0
								? "Debes dinero a la agencia"
								: "Cuentas saldadas"}
					</p>
				</CardContent>
			</Card>
		</div>
	)
}
