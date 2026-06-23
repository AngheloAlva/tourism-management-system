"use client"

import { Truck } from "lucide-react"
import { useState } from "react"

import { useCreateSupplierPayment, useCashFlowSummary } from "../hooks/use-cash-flow"
import { useProviders } from "@/project/providers/hooks/use-providers"

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
import {
	Select,
	SelectItem,
	SelectValue,
	SelectContent,
	SelectTrigger,
} from "@/shared/components/ui/select"

interface SupplierPaymentDialogProps {
	children?: React.ReactNode
}

export function SupplierPaymentDialog({ children }: SupplierPaymentDialogProps) {
	const [open, setOpen] = useState(false)
	const [amount, setAmount] = useState("")
	const [supplier, setSupplier] = useState("")
	const [providerId, setProviderId] = useState<string | undefined>(undefined)
	const [concept, setConcept] = useState("")
	const [invoiceNumber, setInvoiceNumber] = useState("")
	const [notes, setNotes] = useState("")

	const { data: summary } = useCashFlowSummary()
	const { data: providers = [] } = useProviders()
	const createPayment = useCreateSupplierPayment()

	const formatCurrency = (num: number) =>
		new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(num)

	const currentBalance = summary?.currentBalance ?? 0
	const paymentAmount = parseFloat(amount) || 0
	const remainingBalance = currentBalance - paymentAmount

	const handleProviderChange = (value: string) => {
		const selectedProvider = providers.find((p) => p.id === value)
		if (selectedProvider) {
			setProviderId(value)
			const name = selectedProvider.companyName || selectedProvider.fullName || ""
			setSupplier(name)
		} else {
			setProviderId(undefined)
			setSupplier("")
		}
	}

	const handleSubmit = async () => {
		if (paymentAmount <= 0 || !supplier.trim() || !concept.trim()) return

		await createPayment.mutateAsync({
			amount: paymentAmount,
			supplier: supplier.trim(),
			concept: concept.trim(),
			invoiceNumber: invoiceNumber.trim() || undefined,
			notes: notes.trim() || undefined,
			providerId: providerId,
		})

		setOpen(false)
		setAmount("")
		setSupplier("")
		setProviderId(undefined)
		setConcept("")
		setInvoiceNumber("")
		setNotes("")
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{children || (
					<Button variant="outline" className="gap-2">
						<Truck className="h-4 w-4" />
						Pago a Proveedor
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Registrar Pago a Proveedor</DialogTitle>
					<DialogDescription>Registra un pago en efectivo a un proveedor</DialogDescription>
				</DialogHeader>

				<Card className="bg-muted/50">
					<CardContent className="grid grid-cols-2 gap-4">
						<div>
							<p className="text-muted-foreground text-xs">Balance Actual</p>
							<p className="font-semibold">{formatCurrency(currentBalance)}</p>
						</div>
						<div>
							<p className="text-muted-foreground text-xs">Después del Pago</p>
							<p className={`font-semibold ${remainingBalance < 0 ? "text-red-600" : ""}`}>
								{formatCurrency(remainingBalance)}
							</p>
						</div>
					</CardContent>
				</Card>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="provider">Proveedor *</Label>
						<Select onValueChange={handleProviderChange} value={providerId}>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Seleccionar proveedor..." />
							</SelectTrigger>
							<SelectContent>
								{providers.map((p) => (
									<SelectItem key={p.id} value={p.id}>
										{p.companyName || p.fullName || "Sin nombre"}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="concept">Concepto *</Label>
						<Input
							id="concept"
							placeholder="Motivo del pago..."
							value={concept}
							onChange={(e) => setConcept(e.target.value)}
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
						{paymentAmount > currentBalance && (
							<p className="text-xs text-red-600">El monto supera el balance disponible</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="invoiceNumber">Número de Factura</Label>
						<Input
							id="invoiceNumber"
							placeholder="N° de boleta o factura..."
							value={invoiceNumber}
							onChange={(e) => setInvoiceNumber(e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="notes">Notas</Label>
						<Textarea
							id="notes"
							placeholder="Observaciones adicionales..."
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
							paymentAmount <= 0 ||
							!supplier.trim() ||
							!concept.trim() ||
							createPayment.isPending ||
							paymentAmount > currentBalance
						}
					>
						{createPayment.isPending ? "Registrando..." : "Registrar Pago"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
