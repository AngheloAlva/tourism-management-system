"use client"

import { Loader2, PlusCircle } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { useRegisterWholesaleInvoicePayment } from "../hooks/use-payment-statements"

import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import {
	Dialog,
	DialogTitle,
	DialogHeader,
	DialogFooter,
	DialogContent,
	DialogTrigger,
	DialogDescription,
} from "@/shared/components/ui/dialog"
import {
	Select,
	SelectItem,
	SelectValue,
	SelectTrigger,
	SelectContent,
} from "@/shared/components/ui/select"

interface PaymentStatementRegisterPaymentDialogProps {
	invoiceId: string
	pendingAmount: number
	defaultAmount?: number
}

const paymentMethods = [
	{ value: "TRANSFER", label: "Transferencia" },
	{ value: "CASH", label: "Efectivo" },
	{ value: "CREDIT_CARD", label: "Tarjeta de Credito" },
	{ value: "DEBIT_CARD", label: "Tarjeta de Debito" },
	{ value: "PAYMENT_LINK_DEBIT", label: "Link de pago Debito" },
	{ value: "PAYMENT_LINK_CREDIT", label: "Link de pago Credito" },
] as const

function formatCurrency(amount: number) {
	return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(amount)
}

export function PaymentStatementRegisterPaymentDialog({
	invoiceId,
	pendingAmount,
	defaultAmount,
}: PaymentStatementRegisterPaymentDialogProps) {
	const [open, setOpen] = useState(false)
	const [amount, setAmount] = useState(String(defaultAmount ?? pendingAmount))
	const [method, setMethod] = useState<(typeof paymentMethods)[number]["value"]>("TRANSFER")
	const [reference, setReference] = useState("")

	const registerPaymentMutation = useRegisterWholesaleInvoicePayment()

	const amountValue = Number.parseFloat(amount) || 0

	const handleSubmit = async () => {
		if (amountValue <= 0) {
			toast.error("El monto debe ser mayor a 0")
			return
		}

		if (amountValue > pendingAmount) {
			toast.error("El monto no puede superar el saldo pendiente")
			return
		}

		const result = await registerPaymentMutation.mutateAsync({
			invoiceId,
			amount: amountValue,
			method,
			reference,
		})

		if (!result.success) {
			toast.error(("error" in result && result.error) || "No se pudo registrar el pago")
			return
		}

		toast.success("Pago registrado en factura")
		setOpen(false)
		setAmount(String(defaultAmount ?? pendingAmount))
		setReference("")
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button size="sm" variant="outline" className="gap-1.5">
					<PlusCircle className="h-3.5 w-3.5" />
					Registrar pago factura
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Registrar pago de factura</DialogTitle>
					<DialogDescription>
						Saldo pendiente actual: {formatCurrency(pendingAmount)}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-3">
					<div className="space-y-2">
						<Label htmlFor="payment-amount">Monto</Label>
						<Input
							id="payment-amount"
							type="number"
							min={0}
							step={1000}
							value={amount}
							onChange={(event) => setAmount(event.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="payment-method">Metodo</Label>
						<Select value={method} onValueChange={(value) => setMethod(value as typeof method)}>
							<SelectTrigger id="payment-method">
								<SelectValue placeholder="Seleccionar metodo" />
							</SelectTrigger>
							<SelectContent>
								{paymentMethods.map((paymentMethod) => (
									<SelectItem key={paymentMethod.value} value={paymentMethod.value}>
										{paymentMethod.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="payment-reference">Referencia (opcional)</Label>
						<Input
							id="payment-reference"
							placeholder="Nro. transferencia o comprobante"
							value={reference}
							onChange={(event) => setReference(event.target.value)}
						/>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)}>
						Cancelar
					</Button>
					<Button onClick={handleSubmit} disabled={registerPaymentMutation.isPending}>
						{registerPaymentMutation.isPending ? (
							<>
								<Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
								Registrando...
							</>
						) : (
							"Guardar pago"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
