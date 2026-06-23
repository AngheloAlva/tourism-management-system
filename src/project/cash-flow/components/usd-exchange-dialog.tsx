"use client"

import { ArrowRightLeft } from "lucide-react"
import { useMemo, useState } from "react"

import { useCashFlowSummary, useRegisterUsdExchange } from "../hooks/use-cash-flow"

import { Card, CardContent } from "@/shared/components/ui/card"
import { Textarea } from "@/shared/components/ui/textarea"
import { Button } from "@/shared/components/ui/button"
import { Label } from "@/shared/components/ui/label"
import { Input } from "@/shared/components/ui/input"
import {
	Dialog,
	DialogTitle,
	DialogHeader,
	DialogTrigger,
	DialogContent,
	DialogDescription,
} from "@/shared/components/ui/dialog"

interface UsdExchangeDialogProps {
	children?: React.ReactNode
}

export function UsdExchangeDialog({ children }: UsdExchangeDialogProps) {
	const [open, setOpen] = useState(false)
	const [usdAmount, setUsdAmount] = useState("")
	const [clpAmount, setClpAmount] = useState("")
	const [reference, setReference] = useState("")
	const [notes, setNotes] = useState("")

	const { data: summary } = useCashFlowSummary()
	const registerExchange = useRegisterUsdExchange()

	const availableUsd = summary?.currentUsdBalance ?? 0
	const usdValue = Number(usdAmount) || 0
	const clpValue = Number(clpAmount) || 0
	const rate = useMemo(() => {
		if (usdValue <= 0 || clpValue <= 0) return 0
		return clpValue / usdValue
	}, [usdValue, clpValue])

	const formatClp = (amount: number) =>
		new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(amount)
	const formatUsd = (amount: number) =>
		new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)

	const canSubmit =
		usdValue > 0 && clpValue > 0 && usdValue <= availableUsd && !registerExchange.isPending

	const handleSubmit = async () => {
		if (!canSubmit) return

		await registerExchange.mutateAsync({
			usdAmount: usdValue,
			clpAmount: clpValue,
			reference: reference.trim() || undefined,
			notes: notes.trim() || undefined,
		})

		setOpen(false)
		setUsdAmount("")
		setClpAmount("")
		setReference("")
		setNotes("")
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{children || (
					<Button variant="outline" className="gap-2">
						<ArrowRightLeft className="h-4 w-4" />
						Cambio USD
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Registrar Cambio USD a CLP</DialogTitle>
					<DialogDescription>
						Registra la conversión de dólares disponibles a pesos chilenos
					</DialogDescription>
				</DialogHeader>

				<Card className="bg-muted/50">
					<CardContent className="grid grid-cols-2 gap-4">
						<div>
							<p className="text-muted-foreground text-xs">USD Disponibles</p>
							<p className="font-semibold">{formatUsd(availableUsd)}</p>
						</div>
						<div>
							<p className="text-muted-foreground text-xs">Tipo de Cambio</p>
							<p className="font-semibold">
								{rate > 0 ? `$${rate.toLocaleString("es-CL", { maximumFractionDigits: 2 })}` : "-"}
							</p>
						</div>
					</CardContent>
				</Card>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="usd-amount">USD Vendidos *</Label>
						<Input
							id="usd-amount"
							type="number"
							placeholder="100"
							value={usdAmount}
							onChange={(e) => setUsdAmount(e.target.value)}
						/>
						{usdValue > availableUsd && (
							<p className="text-xs text-red-600">El monto supera el saldo USD disponible</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="clp-amount">CLP Recibidos *</Label>
						<Input
							id="clp-amount"
							type="number"
							placeholder="89000"
							value={clpAmount}
							onChange={(e) => setClpAmount(e.target.value)}
						/>
						{clpValue > 0 && (
							<p className="text-muted-foreground text-xs">Monto esperado en caja: {formatClp(clpValue)}</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="exchange-reference">Referencia</Label>
						<Input
							id="exchange-reference"
							placeholder="Ej: Banco Estado / Caja"
							value={reference}
							onChange={(e) => setReference(e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="exchange-notes">Notas</Label>
						<Textarea
							id="exchange-notes"
							placeholder="Detalle opcional del cambio"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
						/>
					</div>
				</div>

				<div className="flex justify-end gap-2">
					<Button variant="outline" onClick={() => setOpen(false)}>
						Cancelar
					</Button>
					<Button onClick={handleSubmit} disabled={!canSubmit}>
						{registerExchange.isPending ? "Registrando..." : "Registrar Cambio"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
