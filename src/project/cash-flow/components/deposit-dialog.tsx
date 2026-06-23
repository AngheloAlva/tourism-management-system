"use client"

import { Landmark } from "lucide-react"
import { useState } from "react"

import { useCreateCashDeposit, useCashFlowSummary } from "../hooks/use-cash-flow"

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

interface DepositDialogProps {
	children?: React.ReactNode
}

export function DepositDialog({ children }: DepositDialogProps) {
	const [open, setOpen] = useState(false)
	const [amount, setAmount] = useState("")
	const [bankAccount, setBankAccount] = useState("")
	const [reference, setReference] = useState("")
	const [notes, setNotes] = useState("")

	const { data: summary } = useCashFlowSummary()
	const createDeposit = useCreateCashDeposit()

	const formatCurrency = (num: number) =>
		new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(num)

	const currentBalance = summary?.currentBalance ?? 0
	const depositAmount = parseFloat(amount) || 0
	const remainingBalance = currentBalance - depositAmount

	const handleSubmit = async () => {
		if (depositAmount <= 0 || depositAmount > currentBalance) return

		await createDeposit.mutateAsync({
			amount: depositAmount,
			bankAccount: bankAccount || undefined,
			reference: reference || undefined,
			notes: notes || undefined,
		})

		setOpen(false)
		setAmount("")
		setBankAccount("")
		setReference("")
		setNotes("")
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{children || (
					<Button variant="outline" className="gap-2">
						<Landmark className="h-4 w-4" />
						Depósito Bancario
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Registrar Depósito Bancario</DialogTitle>
					<DialogDescription>Transferir efectivo de la caja al banco</DialogDescription>
				</DialogHeader>

				<Card className="bg-muted/50">
					<CardContent className="grid grid-cols-2 gap-4">
						<div>
							<p className="text-muted-foreground text-xs">Balance Actual</p>
							<p className="font-semibold">{formatCurrency(currentBalance)}</p>
						</div>
						<div>
							<p className="text-muted-foreground text-xs">Después del Depósito</p>
							<p className={`font-semibold ${remainingBalance < 0 ? "text-red-600" : ""}`}>
								{formatCurrency(remainingBalance)}
							</p>
						</div>
					</CardContent>
				</Card>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="amount">Monto a Depositar *</Label>
						<Input
							id="amount"
							type="number"
							placeholder="0"
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
						/>
						{depositAmount > currentBalance && (
							<p className="text-xs text-red-600">El monto supera el balance disponible</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="bankAccount">Cuenta Bancaria</Label>
						<Input
							id="bankAccount"
							placeholder="Nombre del banco o cuenta..."
							value={bankAccount}
							onChange={(e) => setBankAccount(e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="reference">Número de Referencia</Label>
						<Input
							id="reference"
							placeholder="Número de transferencia..."
							value={reference}
							onChange={(e) => setReference(e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="notes">Notas</Label>
						<Textarea
							id="notes"
							placeholder="Observaciones..."
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
						/>
					</div>
				</div>

				<div className="flex justify-end gap-2">
					<Button variant="outline" onClick={() => setOpen(false)}>
						Cancelar
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={
							depositAmount <= 0 || depositAmount > currentBalance || createDeposit.isPending
						}
					>
						{createDeposit.isPending ? "Registrando..." : "Registrar Depósito"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
