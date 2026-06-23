"use client"

import { Clock, Sunrise, Sunset, AlertCircle, CheckCircle2 } from "lucide-react"
import { useEffect, useState } from "react"

import { useCreateCashCount, useExpectedClosingBalance } from "../hooks/use-cash-flow"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"
import { Alert, AlertDescription } from "@/shared/components/ui/alert"
import { Card, CardContent } from "@/shared/components/ui/card"
import { Textarea } from "@/shared/components/ui/textarea"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import {
	Dialog,
	DialogTitle,
	DialogHeader,
	DialogTrigger,
	DialogContent,
	DialogDescription,
} from "@/shared/components/ui/dialog"

interface CashCountDialogProps {
	children?: React.ReactNode
}

export function CashCountDialog({ children }: CashCountDialogProps) {
	const [open, setOpen] = useState(false)
	const [countedAmount, setCountedAmount] = useState("")
	const [notes, setNotes] = useState("")
	const [tab, setTab] = useState<"OPENING" | "CLOSING">("OPENING")

	const { data: balanceInfo, refetch } = useExpectedClosingBalance()
	const createCashCount = useCreateCashCount()

	const formatCurrency = (amount: number) =>
		new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(amount)

	useEffect(() => {
		if (open) {
			refetch()
		}
	}, [open, refetch])

	useEffect(() => {
		if (open && tab === "CLOSING" && balanceInfo?.expectedAmount !== undefined) {
			setCountedAmount(balanceInfo.expectedAmount.toString())
		} else if (tab === "OPENING") {
			setCountedAmount("")
		}
	}, [open, tab, balanceInfo?.expectedAmount])

	useEffect(() => {
		if (open && balanceInfo) {
			if (balanceInfo.hasOpeningCount && !balanceInfo.hasClosingCount) {
				setTab("CLOSING")
			} else if (!balanceInfo.hasOpeningCount) {
				setTab("OPENING")
			}
		}
	}, [open, balanceInfo])

	const handleSubmit = async () => {
		const amount = parseFloat(countedAmount)
		if (isNaN(amount) || amount < 0) return

		try {
			await createCashCount.mutateAsync({
				type: tab,
				countedAmount: amount,
				notes: notes || undefined,
			})

			setOpen(false)
			setCountedAmount("")
			setNotes("")
		} catch {}
	}

	const expectedAmount =
		tab === "OPENING" ? (balanceInfo?.initialBalance ?? 0) : (balanceInfo?.expectedAmount ?? 0)

	const hasOpeningCount = balanceInfo?.hasOpeningCount ?? false
	const hasClosingCount = balanceInfo?.hasClosingCount ?? false

	const isTabDisabled = (tabValue: "OPENING" | "CLOSING") => {
		if (tabValue === "OPENING") return hasOpeningCount
		if (tabValue === "CLOSING") return hasClosingCount
		return false
	}

	const canSubmit = countedAmount && !createCashCount.isPending && !isTabDisabled(tab)

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{children || (
					<Button variant="outline" className="gap-2">
						<Clock className="h-4 w-4" />
						Conteo de Caja
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Conteo de Caja</DialogTitle>
					<DialogDescription>Registra el conteo físico del efectivo en caja</DialogDescription>
				</DialogHeader>

				<Tabs value={tab} onValueChange={(v) => setTab(v as "OPENING" | "CLOSING")}>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="OPENING" className="gap-2" disabled={hasOpeningCount}>
							{hasOpeningCount ? (
								<CheckCircle2 className="h-4 w-4 text-green-600" />
							) : (
								<Sunrise className="h-4 w-4" />
							)}
							Apertura
						</TabsTrigger>
						<TabsTrigger value="CLOSING" className="gap-2" disabled={hasClosingCount}>
							{hasClosingCount ? (
								<CheckCircle2 className="h-4 w-4 text-green-600" />
							) : (
								<Sunset className="h-4 w-4" />
							)}
							Cierre
						</TabsTrigger>
					</TabsList>

					<TabsContent value="OPENING" className="space-y-4">
						{hasOpeningCount ? (
							<Alert>
								<CheckCircle2 className="h-4 w-4" />
								<AlertDescription>Ya se registró el conteo de apertura para hoy</AlertDescription>
							</Alert>
						) : (
							<Card className="bg-muted/50">
								<CardContent className="pt-4">
									<p className="text-sm">
										<span className="text-muted-foreground">Monto esperado:</span>{" "}
										<span className="font-semibold">{formatCurrency(expectedAmount)}</span>
									</p>
									<p className="text-muted-foreground text-xs">
										Basado en el cierre del último día registrado
									</p>
								</CardContent>
							</Card>
						)}
					</TabsContent>

					<TabsContent value="CLOSING" className="space-y-4">
						{hasClosingCount ? (
							<Alert>
								<CheckCircle2 className="h-4 w-4" />
								<AlertDescription>Ya se registró el conteo de cierre para hoy</AlertDescription>
							</Alert>
						) : (
							<Card className="bg-muted/50">
								<CardContent className="space-y-2 pt-4">
									<p className="text-sm">
										<span className="text-muted-foreground">Monto esperado:</span>{" "}
										<span className="font-semibold">{formatCurrency(expectedAmount)}</span>
									</p>
									<div className="text-muted-foreground space-y-1 text-xs">
										<p>Apertura: {formatCurrency(balanceInfo?.initialBalance ?? 0)}</p>
										<p className="text-green-600">
											+ Ingresos: {formatCurrency(balanceInfo?.totalIncome ?? 0)}
										</p>
										<p className="text-red-600">
											- Egresos: {formatCurrency(balanceInfo?.totalExpenses ?? 0)}
										</p>
										<p className="text-amber-600">
											- Depósitos: {formatCurrency(balanceInfo?.totalDeposits ?? 0)}
										</p>
									</div>
								</CardContent>
							</Card>
						)}
					</TabsContent>
				</Tabs>

				{!isTabDisabled(tab) && (
					<div className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="countedAmount">Monto Contado</Label>
							<Input
								id="countedAmount"
								type="number"
								placeholder="0"
								value={countedAmount}
								onChange={(e) => setCountedAmount(e.target.value)}
							/>
							{countedAmount && parseFloat(countedAmount) !== expectedAmount && (
								<p
									className={`text-xs ${
										parseFloat(countedAmount) > expectedAmount ? "text-green-600" : "text-red-600"
									}`}
								>
									<AlertCircle className="mr-1 inline h-3 w-3" />
									Diferencia: {formatCurrency(parseFloat(countedAmount) - expectedAmount)}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="notes">Notas (opcional)</Label>
							<Textarea
								id="notes"
								placeholder="Observaciones del conteo..."
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
							/>
						</div>
					</div>
				)}

				<div className="flex justify-end gap-2">
					<Button variant="outline" onClick={() => setOpen(false)}>
						Cancelar
					</Button>
					<Button onClick={handleSubmit} disabled={!canSubmit}>
						{createCashCount.isPending
							? "Registrando..."
							: tab === "OPENING"
								? "Registrar Apertura"
								: "Registrar Cierre"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
