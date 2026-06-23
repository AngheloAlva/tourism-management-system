"use client"

import { useState } from "react"
import { ShieldCheckIcon, AlertTriangleIcon } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { toast } from "sonner"

import { enableTwoFactorAction } from "../../actions/two-factor.actions"
import { verifyTwoFactorSetupAction } from "../../actions/two-factor.actions"
import { BackupCodesDisplay } from "./backup-codes-display"

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

type WizardStep = "password" | "qr" | "verify" | "backup"

interface EnableTwoFactorDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onSuccess?: () => void
}

export function EnableTwoFactorDialog({
	open,
	onOpenChange,
	onSuccess,
}: EnableTwoFactorDialogProps) {
	const [step, setStep] = useState<WizardStep>("password")
	const [password, setPassword] = useState("")
	const [totpURI, setTotpURI] = useState("")
	const [backupCodes, setBackupCodes] = useState<string[]>([])
	const [otpCode, setOtpCode] = useState("")
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Extract the secret from the TOTP URI for manual entry
	const totpSecret = (() => {
		try {
			const url = new URL(totpURI)
			return url.searchParams.get("secret") ?? ""
		} catch {
			return ""
		}
	})()

	const resetState = () => {
		setStep("password")
		setPassword("")
		setTotpURI("")
		setBackupCodes([])
		setOtpCode("")
		setIsSubmitting(false)
		setError(null)
	}

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen && step !== "backup") {
			// User closed before completing — reset without committing
			resetState()
		} else if (!nextOpen) {
			resetState()
		}
		onOpenChange(nextOpen)
	}

	// Step 1: validate password and get TOTP URI
	const handlePasswordSubmit = async () => {
		setError(null)
		setIsSubmitting(true)

		try {
			const result = await enableTwoFactorAction({ password })

			if (!result.ok) {
				setError(result.error ?? "Error al activar 2FA")
				return
			}

			setTotpURI(result.data!.totpURI)
			setBackupCodes(result.data!.backupCodes)
			setStep("qr")
		} catch {
			setError("Error inesperado. Intentá de nuevo.")
		} finally {
			setIsSubmitting(false)
		}
	}

	// Step 3: verify the TOTP code from the authenticator app
	const handleVerifySubmit = async () => {
		setError(null)
		setIsSubmitting(true)

		try {
			const result = await verifyTwoFactorSetupAction({ code: otpCode })

			if (!result.ok) {
				setError(result.error ?? "Código incorrecto")
				setOtpCode("")
				return
			}

			setStep("backup")
		} catch {
			setError("Error inesperado al verificar el código.")
		} finally {
			setIsSubmitting(false)
		}
	}

	// Step 4 finish
	const handleFinish = () => {
		toast.success("Autenticación de dos factores activada correctamente")
		onSuccess?.()
		handleOpenChange(false)
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-[480px]">
				{step === "password" && (
					<>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<ShieldCheckIcon className="h-5 w-5" />
								Activar autenticación de dos factores
							</DialogTitle>
							<DialogDescription>
								Confirmá tu contraseña actual para comenzar la configuración.
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-4 py-2">
							<div className="space-y-1.5">
								<Label htmlFor="2fa-password">Contraseña actual</Label>
								<Input
									id="2fa-password"
									type="password"
									className="h-10"
									placeholder="Tu contraseña actual"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && password.length > 0) {
											void handlePasswordSubmit()
										}
									}}
									autoFocus
								/>
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
								onClick={handlePasswordSubmit}
								disabled={password.length === 0 || isSubmitting}
							>
								{isSubmitting ? "Verificando..." : "Continuar"}
							</Button>
						</DialogFooter>
					</>
				)}

				{step === "qr" && (
					<>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<ShieldCheckIcon className="h-5 w-5" />
								Escanear código QR
							</DialogTitle>
							<DialogDescription>
								Abrí tu app de autenticación (Google Authenticator, Authy, etc.) y escaneá el código.
							</DialogDescription>
						</DialogHeader>

						<div className="flex flex-col items-center gap-4 py-2">
							<div className="rounded-lg border bg-white p-4">
								<QRCodeSVG value={totpURI} size={180} />
							</div>

							<div className="w-full space-y-1">
								<p className="text-muted-foreground text-center text-xs">
									¿No podés escanear el código? Ingresá esta clave manualmente:
								</p>
								<code className="bg-muted block w-full break-all rounded-md px-3 py-2 text-center font-mono text-xs tracking-widest">
									{totpSecret}
								</code>
							</div>
						</div>

						<DialogFooter>
							<Button variant="outline" onClick={() => setStep("password")}>
								Atrás
							</Button>
							<Button onClick={() => setStep("verify")}>Continuar</Button>
						</DialogFooter>
					</>
				)}

				{step === "verify" && (
					<>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<ShieldCheckIcon className="h-5 w-5" />
								Verificar código
							</DialogTitle>
							<DialogDescription>
								Ingresá el código de 6 dígitos que muestra tu app de autenticación.
							</DialogDescription>
						</DialogHeader>

						<div className="flex flex-col items-center gap-4 py-4">
							<InputOTP
								maxLength={6}
								value={otpCode}
								onChange={(value) => {
									setOtpCode(value)
									setError(null)
								}}
								onComplete={() => void handleVerifySubmit()}
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

							{error && (
								<div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
									<AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
									{error}
								</div>
							)}
						</div>

						<DialogFooter>
							<Button variant="outline" onClick={() => setStep("qr")}>
								Atrás
							</Button>
							<Button
								onClick={handleVerifySubmit}
								disabled={otpCode.length !== 6 || isSubmitting}
							>
								{isSubmitting ? "Verificando..." : "Verificar"}
							</Button>
						</DialogFooter>
					</>
				)}

				{step === "backup" && (
					<>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<ShieldCheckIcon className="h-5 w-5 text-green-600" />
								Códigos de respaldo
							</DialogTitle>
							<DialogDescription>
								Guardá estos códigos antes de cerrar. Son tu única forma de acceder si perdés tu dispositivo.
							</DialogDescription>
						</DialogHeader>

						<div className="py-2">
							<BackupCodesDisplay codes={backupCodes} />
						</div>

						<DialogFooter>
							<Button onClick={handleFinish}>Finalizar</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	)
}
