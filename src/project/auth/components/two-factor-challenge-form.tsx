"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangleIcon } from "lucide-react"

import { authClient } from "@/lib/auth-client"

import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@/shared/components/ui/input-otp"

export function TwoFactorChallengeForm() {
	const router = useRouter()

	// TOTP tab state
	const [totpCode, setTotpCode] = useState("")
	const [totpError, setTotpError] = useState<string | null>(null)
	const [totpSubmitting, setTotpSubmitting] = useState(false)

	// Backup code tab state
	const [backupCode, setBackupCode] = useState("")
	const [backupError, setBackupError] = useState<string | null>(null)
	const [backupSubmitting, setBackupSubmitting] = useState(false)

	const handleVerifyTotp = async () => {
		if (totpCode.length !== 6 || totpSubmitting) return
		setTotpError(null)
		setTotpSubmitting(true)

		try {
			const result = await authClient.twoFactor.verifyTotp({ code: totpCode })

			if (result.error) {
				setTotpError("Código incorrecto. Verificá que tu app de autenticación esté sincronizada.")
				setTotpCode("")
				return
			}

			router.push("/dashboard/inicio")
		} catch {
			setTotpError("Error inesperado. Intentá de nuevo.")
		} finally {
			setTotpSubmitting(false)
		}
	}

	const handleVerifyBackupCode = async () => {
		if (!backupCode.trim() || backupSubmitting) return
		setBackupError(null)
		setBackupSubmitting(true)

		try {
			const result = await authClient.twoFactor.verifyBackupCode({ code: backupCode.trim() })

			if (result.error) {
				setBackupError("Código de respaldo inválido. Verificá que lo hayas ingresado correctamente.")
				return
			}

			router.push("/dashboard/inicio")
		} catch {
			setBackupError("Error inesperado. Intentá de nuevo.")
		} finally {
			setBackupSubmitting(false)
		}
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col items-start gap-1">
				<h1 className="text-2xl font-bold">Verificación en dos pasos</h1>
				<p className="text-muted-foreground text-sm text-balance">
					Ingresá el código de tu app de autenticación o uno de tus códigos de respaldo.
				</p>
			</div>

			<Tabs defaultValue="totp">
				<TabsList className="w-full">
					<TabsTrigger value="totp" className="flex-1">
						Código TOTP
					</TabsTrigger>
					<TabsTrigger value="backup" className="flex-1">
						Código de respaldo
					</TabsTrigger>
				</TabsList>

				<TabsContent value="totp" className="mt-5">
					<div className="flex flex-col gap-4">
						<div className="flex flex-col gap-2">
							<Label>Código de autenticación</Label>
							<p className="text-muted-foreground text-sm">
								Ingresá el código de 6 dígitos que muestra tu app de autenticación.
							</p>
							<div className="flex justify-center pt-1">
								<InputOTP
									maxLength={6}
									value={totpCode}
									onChange={(value) => {
										setTotpCode(value)
										setTotpError(null)
									}}
									onComplete={() => void handleVerifyTotp()}
									disabled={totpSubmitting}
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

						{totpError && (
							<div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
								<AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
								{totpError}
							</div>
						)}

						<Button
							className="h-10 w-full"
							onClick={() => void handleVerifyTotp()}
							disabled={totpCode.length !== 6 || totpSubmitting}
						>
							{totpSubmitting ? "Verificando..." : "Verificar"}
						</Button>
					</div>
				</TabsContent>

				<TabsContent value="backup" className="mt-5">
					<div className="flex flex-col gap-4">
						<div className="flex flex-col gap-2">
							<Label htmlFor="backup-code-input">Código de respaldo</Label>
							<p className="text-muted-foreground text-sm">
								Ingresá uno de los códigos de respaldo que guardaste al activar el 2FA.
							</p>
							<Input
								id="backup-code-input"
								type="text"
								className="h-10 font-mono"
								placeholder="xxxxxxxxxx"
								value={backupCode}
								onChange={(e) => {
									setBackupCode(e.target.value)
									setBackupError(null)
								}}
								disabled={backupSubmitting}
								autoComplete="off"
								spellCheck={false}
							/>
						</div>

						{backupError && (
							<div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
								<AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
								{backupError}
							</div>
						)}

						<Button
							className="h-10 w-full"
							onClick={() => void handleVerifyBackupCode()}
							disabled={!backupCode.trim() || backupSubmitting}
						>
							{backupSubmitting ? "Verificando..." : "Verificar"}
						</Button>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	)
}
