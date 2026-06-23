"use client"

import { useState } from "react"
import { KeyRoundIcon, CopyIcon, CheckIcon, AlertCircleIcon } from "lucide-react"
import { toast } from "sonner"

import { resetUserPasswordAction } from "../actions/reset-password.actions"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import {
	Dialog,
	DialogTitle,
	DialogHeader,
	DialogContent,
	DialogDescription,
	DialogFooter,
} from "@/shared/components/ui/dialog"
import { Label } from "@/shared/components/ui/label"

import type { UserWithStats } from "../actions/user.actions"

interface ResetPasswordDialogProps {
	user: UserWithStats
	currentUserId: string
	open: boolean
	onOpenChange: (open: boolean) => void
}

type DialogStep = "form" | "show-password"
type PasswordMode = "random" | "manual"

export function ResetPasswordDialog({
	user,
	currentUserId,
	open,
	onOpenChange,
}: ResetPasswordDialogProps) {
	const [step, setStep] = useState<DialogStep>("form")
	const [mode, setMode] = useState<PasswordMode>("random")
	const [manualPassword, setManualPassword] = useState("")
	const [temporaryPassword, setTemporaryPassword] = useState("")
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [copied, setCopied] = useState(false)

	const isSelf = user.id === currentUserId

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) {
			// Reset state on close
			setStep("form")
			setMode("random")
			setManualPassword("")
			setTemporaryPassword("")
			setCopied(false)
		}
		onOpenChange(nextOpen)
	}

	const handleSubmit = async () => {
		setIsSubmitting(true)
		try {
			const result = await resetUserPasswordAction({
				userId: user.id,
				mode,
				manualPassword: mode === "manual" ? manualPassword : undefined,
			})

			if (!result.ok) {
				toast.error("Error al resetear la contraseña", { description: result.error })
				return
			}

			setTemporaryPassword(result.data?.temporaryPassword ?? "")
			setStep("show-password")
		} catch {
			toast.error("Error inesperado al resetear la contraseña")
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(temporaryPassword)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch {
			toast.error("No se pudo copiar al portapapeles")
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-[440px]">
				{step === "form" ? (
					<>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<KeyRoundIcon className="h-5 w-5" />
								Resetear contraseña
							</DialogTitle>
							<DialogDescription>
								Vas a resetear la contraseña de <strong>{user.name}</strong> ({user.email}). El
								usuario deberá cambiarla en el próximo inicio de sesión.
							</DialogDescription>
						</DialogHeader>

						{isSelf ? (
							<div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
								<AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
								<p>
									Para cambiar tu propia contraseña, usá la sección{" "}
									<strong>Mi Cuenta</strong>.
								</p>
							</div>
						) : (
							<div className="space-y-4 py-2">
								<div className="space-y-3">
									<Label className="text-sm font-medium">Tipo de contraseña</Label>

									<div className="space-y-2">
										<label className="flex cursor-pointer items-center gap-3">
											<input
												type="radio"
												name="passwordMode"
												value="random"
												checked={mode === "random"}
												onChange={() => setMode("random")}
												className="accent-primary"
											/>
											<span className="text-sm">
												<span className="font-medium">Generar automática</span>
												<span className="text-muted-foreground ml-1">(recomendado)</span>
											</span>
										</label>

										<label className="flex cursor-pointer items-center gap-3">
											<input
												type="radio"
												name="passwordMode"
												value="manual"
												checked={mode === "manual"}
												onChange={() => setMode("manual")}
												className="accent-primary"
											/>
											<span className="text-sm font-medium">Escribir manualmente</span>
										</label>
									</div>
								</div>

								{mode === "manual" && (
									<div className="space-y-1.5">
										<Label htmlFor="manualPassword" className="text-sm">
											Nueva contraseña
										</Label>
										<Input
											id="manualPassword"
											type="password"
											className="h-10"
											placeholder="Mínimo 8 caracteres"
											value={manualPassword}
											onChange={(e) => setManualPassword(e.target.value)}
										/>
										<p className="text-muted-foreground text-xs">
											Mínimo 8 caracteres, máximo 128.
										</p>
									</div>
								)}
							</div>
						)}

						<DialogFooter>
							<Button variant="outline" onClick={() => handleOpenChange(false)}>
								Cancelar
							</Button>
							<Button
								onClick={handleSubmit}
								disabled={
									isSelf ||
									isSubmitting ||
									(mode === "manual" && manualPassword.length < 8)
								}
							>
								{isSubmitting ? "Reseteando..." : "Confirmar"}
							</Button>
						</DialogFooter>
					</>
				) : (
					<>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<KeyRoundIcon className="h-5 w-5 text-green-600" />
								Contraseña reseteada
							</DialogTitle>
							<DialogDescription>
								La contraseña de <strong>{user.name}</strong> fue reseteada exitosamente.
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-4 py-2">
							<div className="space-y-2">
								<Label className="text-sm font-medium">Contraseña temporal</Label>
								<div className="flex items-center gap-2">
									<code className="bg-muted flex-1 rounded-md px-3 py-2 font-mono text-sm tracking-wider">
										{temporaryPassword}
									</code>
									<Button
										variant="outline"
										size="icon"
										onClick={handleCopy}
										title="Copiar al portapapeles"
									>
										{copied ? (
											<CheckIcon className="h-4 w-4 text-green-600" />
										) : (
											<CopyIcon className="h-4 w-4" />
										)}
									</Button>
								</div>
							</div>

							<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
								<p className="font-medium">Importante</p>
								<p className="mt-1">
									Comunicá esta contraseña al usuario por un canal seguro. No quedará
									registrada en ningún sistema. Una vez que cerrés este diálogo, no podrás
									recuperarla.
								</p>
							</div>
						</div>

						<DialogFooter>
							<Button onClick={() => handleOpenChange(false)}>Cerrar</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	)
}
