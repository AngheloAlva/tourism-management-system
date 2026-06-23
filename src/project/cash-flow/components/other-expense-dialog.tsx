"use client"

import { Receipt } from "lucide-react"
import { useState } from "react"

import { useCreateOtherExpense, useCashFlowSummary } from "../hooks/use-cash-flow"

import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { Card, CardContent } from "@/shared/components/ui/card"
import {
	Dialog,
	DialogTitle,
	DialogHeader,
	DialogTrigger,
	DialogContent,
	DialogDescription,
} from "@/shared/components/ui/dialog"
import {
	Select,
	SelectItem,
	SelectValue,
	SelectTrigger,
	SelectContent,
} from "@/shared/components/ui/select"

import type { ExpenseCategory } from "../constants/enums"

interface OtherExpenseDialogProps {
	children?: React.ReactNode
}

const categories: { value: ExpenseCategory; label: string }[] = [
	{ value: "SUPPLIES", label: "Suministros" },
	{ value: "TRANSPORTATION", label: "Transporte" },
	{ value: "FOOD", label: "Alimentación" },
	{ value: "OTHER", label: "Otros" },
]

export function OtherExpenseDialog({ children }: OtherExpenseDialogProps) {
	const [open, setOpen] = useState(false)
	const [amount, setAmount] = useState("")
	const [description, setDescription] = useState("")
	const [category, setCategory] = useState<ExpenseCategory>("OTHER")
	const [reference, setReference] = useState("")

	const { data: summary } = useCashFlowSummary()
	const createExpense = useCreateOtherExpense()

	const formatCurrency = (num: number) =>
		new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(num)

	const currentBalance = summary?.currentBalance ?? 0
	const expenseAmount = parseFloat(amount) || 0
	const remainingBalance = currentBalance - expenseAmount

	const handleSubmit = async () => {
		if (expenseAmount <= 0 || !description.trim()) return

		await createExpense.mutateAsync({
			amount: expenseAmount,
			description: description.trim(),
			category,
			reference: reference.trim() || undefined,
		})

		setOpen(false)
		setAmount("")
		setDescription("")
		setCategory("OTHER")
		setReference("")
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{children || (
					<Button variant="outline" className="gap-2">
						<Receipt className="h-4 w-4" />
						Otros Gastos
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Registrar Gasto</DialogTitle>
					<DialogDescription>Registra un gasto menor en efectivo</DialogDescription>
				</DialogHeader>

				<Card className="bg-muted/50">
					<CardContent className="grid grid-cols-2 gap-4">
						<div>
							<p className="text-muted-foreground text-xs">Balance Actual</p>
							<p className="font-semibold">{formatCurrency(currentBalance)}</p>
						</div>
						<div>
							<p className="text-muted-foreground text-xs">Después del Gasto</p>
							<p className={`font-semibold ${remainingBalance < 0 ? "text-red-600" : ""}`}>
								{formatCurrency(remainingBalance)}
							</p>
						</div>
					</CardContent>
				</Card>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="category">Categoría *</Label>
						<Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Selecciona una categoría" />
							</SelectTrigger>
							<SelectContent>
								{categories.map((cat) => (
									<SelectItem key={cat.value} value={cat.value}>
										{cat.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="description">Descripción *</Label>
						<Input
							id="description"
							placeholder="Detalle del gasto..."
							value={description}
							onChange={(e) => setDescription(e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="amount">Monto *</Label>
						<Input
							id="amount"
							type="number"
							placeholder="0"
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
						/>
						{expenseAmount > currentBalance && (
							<p className="text-xs text-red-600">El monto supera el balance disponible</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="reference">Referencia</Label>
						<Input
							id="reference"
							placeholder="N° de boleta (opcional)..."
							value={reference}
							onChange={(e) => setReference(e.target.value)}
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
							expenseAmount <= 0 ||
							!description.trim() ||
							createExpense.isPending ||
							expenseAmount > currentBalance
						}
					>
						{createExpense.isPending ? "Registrando..." : "Registrar Gasto"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
