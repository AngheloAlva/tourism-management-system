"use client"

import { useState } from "react"
import { ShieldOffIcon, AlertTriangleIcon } from "lucide-react"
import { toast } from "sonner"

import { disableTwoFactorAction } from "../../actions/two-factor.actions"

import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import {
	Dialog,
	DialogTitle,
	DialogHeader,
	DialogContent,
	DialogDescription,
	DialogFooter,
} from "@/shared/components/ui/dialog"
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@/shared/components/ui/input-otp"

interface DisableTwoFactorDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onSuccess?: () => void
}

export function DisableTwoFactorDialog({
	open,
	onOpenChange,
	onSuccess,
}: DisableTwoFactorDialogProps) {
	const [password, setPassword] = useState("")
	const [otpCode, setOtpCode] = useState("")
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const resetState = () => {
		setPassword("")
		setOtpCode("")
		setIsSubmitting(false)
		setError(null)
	}

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) {
			resetState()
		}
		onOpenChange(nextOpen)
	}

	const handleSubmit = async () => {
		setError(null)
		setIsSubmitting(true)

		try {
			const result = await disableTwoFactorAction({ password, code: otpCode })

			if (!result.ok) {
				setError(result.error ?? "Error al desactivar 2FA")
				// Clear the OTP code on error so user can retry
				setOtpCode("")
				return
			}

			toast.success("Autenticación de dos factores desactivada")
			onSuccess?.()
			handleOpenChange(false)
		} catch {
			setError("Error inesperado. Intentá de nuevo.")
		} finally {
			setIsSubmitting(false)
		}
	}

	const canSubmit = password.length > 0 && otpCode.length === 6 && !isSubmitting

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-[440px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<ShieldOffIcon className="h-5 w-5" />
						Desactivar autenticación de dos factores
					</DialogTitle>
					<DialogDescription>
						Confirmá tu contraseña y el código de tu app de autenticación para desactivar 2FA.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-5 py-2">
					<div className="space-y-1.5">
						<Label htmlFor="disable-2fa-password">Contraseña actual</Label>
						<Input
							id="disable-2fa-password"
							type="password"
							className="h-10"
							placeholder="Tu contraseña actual"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							autoFocus
						/>
					</div>

					<div className="space-y-2">
						<Label>Código de autenticación</Label>
						<p className="text-muted-foreground text-sm">
							Ingresá el código de 6 dígitos que muestra tu app de autenticación.
						</p>
						<div className="flex justify-center pt-1">
							<InputOTP
								maxLength={6}
								value={otpCode}
								onChange={(value) => {
									setOtpCode(value)
									setError(null)
								}}
								onComplete={() => {
									if (password.length > 0) {
										void handleSubmit()
									}
								}}
							>
								<InputOTPGroup>
									<InputOTPSlot index={0} />
									<InputOTPSlot index={1} />
									<InputOTPSlot index={2} />
									<InputOTPSlot index={3} />
									<InputOTPSlot index={4} />
									<InputOTPSlot index={5} />
								</InputOTPGroup>
							</InputOTP>
						</div>
					</div>

					{error && (
						<div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
							<AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
							{error}
						</div>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => handleOpenChange(false)}>
						Cancelar
					</Button>
					<Button
						variant="destructive"
						onClick={handleSubmit}
						disabled={!canSubmit}
					>
						{isSubmitting ? "Desactivando..." : "Desactivar 2FA"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
